import chokidar from "chokidar";
import { loadConfig } from "../config.js";
import { generateIndex, loadIndex, removeFromIndex, updateIndex } from "../state/index.js";
import syncFile from "./engine.js";
import { CloudAdapter } from "../cloud/adapter.js";
import { SyncResult } from "./engine.js";

const WATCH_PATTERNS = [
    "**/*.srm",
    "**/*.sav",
    "**/*.srm.bak",
    "**/*.state",
    "**/*.state[0-9]",
];

function determineStatuses(results: SyncResult[]) {
  return {
    successes: results.filter(res => res.success),
    failures: results.filter(res => !res.success),
  }
}

function logResults(eventType: "initialSync" | "add" | "change" | "unlink", results: SyncResult[]) {
  const { successes, failures } = determineStatuses(results);

  const resultWord = { initialSync: "synced", add: "uploaded", change: "uploaded", unlink: "deleted" }[eventType];
  const resultWordPres = { initialSync: "sync", add: "upload", change: "upload", unlink: "delete" }[eventType];

  if (failures.length === 0) {
    console.log(`Success. ${results.length} file(s) ${resultWord} successfully.\n${results.map(res => res.path).join("\n")}`);
  } else {
    console.log(`Failure. ${successes.length} file(s) ${resultWord} successfully. ${failures.length} file(s) failed to ${resultWordPres}.\nSUCCESSES:\n${successes.map(su => su.path).join("\n")}\nFAILURES:\n${failures.map(fail => `${fail.path}: ${fail.error}`).join("\n")}`);
  }
}

export async function runWatcher(adapter: CloudAdapter) {
  const config = loadConfig();
  const existing = loadIndex();

  try {
    const newIndex = await generateIndex(config.retroarchSaveDir, config.retroarchStateDir);

    const results = await syncFile(adapter, existing, newIndex);

    logResults("initialSync", results);
  } catch (error) {
    throw new Error("Failed initial sync", { cause: error });
  }

  const watcher = chokidar.watch(
    WATCH_PATTERNS.flatMap(pattern => [
      `${config.retroarchSaveDir}/${pattern}`,
      `${config.retroarchStateDir}/${pattern}`,
    ]),
    { 
      persistent: true,
      ignoreInitial: true,
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

      const results = await syncFile(adapter, index, updated);

      logResults(eventType, results);
    } catch (error) {
      console.error(`Failed to ${actionWord} ${filePath}`, error);
    }
  }

  watcher.on("add", (filePath) => processOnEvent(filePath, "add"));

  watcher.on("change", (filePath) => processOnEvent(filePath, "change"));

  watcher.on("unlink", (filePath) => processOnEvent(filePath, "unlink"));
}