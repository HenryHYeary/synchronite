import chokidar from "chokidar";
import { loadConfig } from "../config.js";
import { generateIndex, loadIndex, removeFromIndex, saveIndex, updateIndex } from "../state/index.js";
import syncFile from "./engine.js";
import { CloudAdapter } from "../cloud/adapter.js";
import { SyncResult } from "./engine.js";

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



export async function runWatcher(adapter: CloudAdapter) {
  const config = loadConfig();
  const existing = loadIndex();

  try {
    const newIndex = await generateIndex(config.retroarchSaveDir, config.retroarchStateDir);

    const { results, confirmedIndex } = await syncFile(adapter, existing, newIndex, config);
    saveIndex(confirmedIndex);

    logResults("initialSync", results);
  } catch (error) {
    throw new Error("Failed initial sync", { cause: error });
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
  }

  watcher.on("ready", () => console.log("Watcher ready, watching:", watcher.getWatched()));

  watcher.on("add", (filePath) => processOnEvent(filePath, "add"));

  watcher.on("change", (filePath) => processOnEvent(filePath, "change"));

  watcher.on("unlink", (filePath) => processOnEvent(filePath, "unlink"));
}