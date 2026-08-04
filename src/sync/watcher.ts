import chokidar from "chokidar";
import * as p from "@clack/prompts";
import { detectConflicts } from "./conflicts.js";
import { downloadAndRecordFile } from "./remoteWatcher.js";
import { loadConfig } from "../config.js";
import { generateIndex, loadIndex, removeFromIndex, saveIndex, SyncIndex, updateIndex } from "../state/index.js";
import { makeLocalRootMap, runRemoteSyncLoop } from "./remoteWatcher.js";
import syncFile from "./engine.js";
// import { CloudAdapter } from "../cloud/adapter.js";
import { SyncResult } from "./engine.js";
import { withPathLock } from "./pathLock.js";
import { DropboxAdapter } from "../cloud/dropbox.js";

const FIXED_SUFFIXES = [".srm", ".sav", ".srm.bak", ".state"];
const STATE_SLOT_PATTERN = /\.state\d$/;

function isWatchedFile(filePath: string): boolean {
  return (
    FIXED_SUFFIXES.some(suffix => filePath.endsWith(suffix)) ||
    STATE_SLOT_PATTERN.test(filePath)
  )
}

function determineStatuses(results: SyncResult[]) {
  return {
    successes: results.filter(res => res.success),
    skipped: results.filter(res => res.skipped),
    failures: results.filter(res => !res.success),
  }
}

function logResults(eventType: "initialSync" | "add" | "change" | "unlink", results: SyncResult[]) {
  const { successes, skipped, failures } = determineStatuses(results);

  const resultWord = { initialSync: "synced", add: "uploaded", change: "uploaded", unlink: "deleted" }[eventType];
  const resultWordPres = { initialSync: "sync", add: "upload", change: "upload", unlink: "delete" }[eventType];

  const skippedNote = skipped.length > 0
    ? `\n${skipped.length} file(s) not deleted remotely (propagateDeletes is off):\n${skipped.map(s => s.path).join("\n")}`
    : "";

  if (failures.length === 0) {
    console.log(`Success. ${results.length} file(s) ${resultWord} successfully.\n${results.map(res => res.path).join("\n")}${skippedNote}`);
  } else {
    console.log(`Failure. ${successes.length} file(s) ${resultWord} successfully. ${failures.length} file(s) failed to ${resultWordPres}.\nSUCCESSES:\n${successes.map(su => su.path).join("\n")}\nFAILURES:\n${failures.map(fail => `${fail.path}: ${fail.error}`).join("\n")}${skippedNote}`);
  }
}


// TODO: refactor when the app supports multiple adapters
export async function runWatcher(adapter: DropboxAdapter) {
  const config = loadConfig();
  const localRootMap = makeLocalRootMap(config);

  const localIndex = loadIndex();
  const currentLocalFiles = await generateIndex(config.retroarchSaveDir, config.retroarchStateDir);
  const remoteEntries = await adapter.listRemote("/");

  const diffs = await detectConflicts(localIndex, currentLocalFiles, remoteEntries, localRootMap);
  const conflicts = diffs.filter(d => d.localChanged && d.remoteChanged);
  const remoteOnly = diffs.filter(d => !d.localChanged && d.remoteChanged);

  for (const conflict of conflicts) {
    const choice = await p.select({
      message: `Conflict: ${conflict.localPath} changed both locally and in the cloud. Which version do you want to keep?`,
      options: [
        { value: "local", label: "Keep local version (overwrite cloud)", },
        { value: "remote", label: "Keep remote version (overwrite local)", },
      ]
    });

    if (p.isCancel(choice)) {
      p.cancel("Setup cancelled");
      process.exit(0);
    }

    await withPathLock(conflict.localPath, async () => {
      if (choice === "local") {
        const record = currentLocalFiles[conflict.localPath];
        const { contentHash } = await adapter.upload(conflict.localPath, record.remotePath);

        const updated: SyncIndex = {
          ...loadIndex(),
          [conflict.localPath]: {
            ...record,
            remoteContentHash: contentHash,
            lastSynced: Date.now(),  
          },
        };
        saveIndex(updated);
      } else {
        const remoteEntry = conflict.remoteEntry!;
        await downloadAndRecordFile(adapter, remoteEntry.path, conflict.localPath, remoteEntry.contentHash);
      }
    });
  }

  const indexAfterConflicts = loadIndex();

  const localFilesForSync: SyncIndex = { ...currentLocalFiles };
  for (const conflict of conflicts) {
    if (indexAfterConflicts[conflict.localPath]) {
      localFilesForSync[conflict.localPath] = indexAfterConflicts[conflict.localPath];
    } else {
      delete localFilesForSync[conflict.localPath];
    }
  }

  const { results, confirmedIndex } = await syncFile(adapter, indexAfterConflicts, localFilesForSync, config);
  saveIndex(confirmedIndex);
  logResults("initialSync", results)

  for (const diff of remoteOnly) {
    const entry = diff.remoteEntry!;
    try {
      await withPathLock(diff.localPath, async () => {
        await downloadAndRecordFile(adapter, entry.path, diff.localPath, entry.contentHash);
      });
    } catch (error) {
      console.error(`Failed to download ${entry.path}:`, error);
    }
  }

  const watcher = chokidar.watch(
    [config.retroarchSaveDir, config.retroarchStateDir],
    { 
      persistent: true,
      ignoreInitial: true,
      alwaysStat: true,
      ignored: (filePath) => {
        const hasExtension = /\.[^./\\]+$/.test(filePath);
        if (!hasExtension) return false;
        return !isWatchedFile(filePath);
      },
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    },
  );

  async function processOnEvent(filePath: string, eventType: "add" | "change" | "unlink"): Promise<void> {
    await withPathLock(filePath, async () => {
      const actionWord = { add: "sync", change: "sync", unlink: "unlink" }[eventType];

      try {
        const index = loadIndex();
        const updated = eventType === "unlink" ? removeFromIndex(index, filePath) : await updateIndex(index, filePath);

        const { results, confirmedIndex } = await syncFile(adapter, index, updated, config);
        saveIndex(confirmedIndex);

        logResults(eventType, results);
      } catch (error) {
        console.error(`Failed to ${actionWord} ${filePath}`, error);
      }
    });
  }

  watcher.on("ready", () => console.log("Watcher ready, watching:", watcher.getWatched()));

  watcher.on("add", (filePath) => processOnEvent(filePath, "add"));

  watcher.on("change", (filePath) => processOnEvent(filePath, "change"));

  watcher.on("unlink", (filePath) => processOnEvent(filePath, "unlink"));

  // const localRootMap = makeLocalRootMap(config);
  runRemoteSyncLoop(adapter, "/", localRootMap).catch((error) => {
    console.error("Remote sync loop crashed:", error);
  });
}