import chokidar from "chokidar";
import { Config } from "../config";
import { loadIndex, removeFromIndex, updateIndex } from "../state";
import syncFile from "./engine";
import { CloudAdapter } from "../cloud/adapter";

const WATCH_PATTERNS = [
    "**/*.srm",
    "**/*.sav",
    "**/*.srm.bak",
    "**/*.state",
    "**/*.state[0-9]",
];

export async function runWatcher(config: Config, adapter: CloudAdapter) {
  const watcher = chokidar.watch(
    WATCH_PATTERNS.flatMap(pattern => [
      `${config.retroarchSaveDir}/${pattern}`,
      `${config.retroarchStateDir}/${pattern}`,
    ]),
    { 
        persistent: true,
        awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      }
    },
  );

  // Should consolidate these into one shared helper.
  watcher.on("change", async (filePath) => {
    try {
      const index = loadIndex();
      const updated = await updateIndex(index, filePath);

      const results = await syncFile(adapter, index, updated);

      const successes = results.filter(res => res.success);
      const failures = results.filter(res => !res.success);

      if (results.length === successes.length) {
        console.log(`Success. ${results.length} file(s) uploaded successfully.\n${results.map(res => res.path).join("\n")}`);
      } else {
        console.log(`Failure. ${successes.length} file(s) uploaded successfully. ${failures.length} file(s) failed to upload.\nSUCCESSES:\n${successes.map(su => su.path).join("\n")}\nFAILURES:\n${failures.map(fail => `${fail.path}: ${fail.error}`).join("\n")}`);
      }
    } catch (error) {
      console.error(`Failed to sync ${filePath}:`, error);
    }
  });

  watcher.on("unlink", async (filePath) => {
    try {
      const index = loadIndex();
      const updated = removeFromIndex(index, filePath);

      const results = await syncFile(adapter, index, updated);

      const successes = results.filter(res => res.success);
      const failures = results.filter(res => !res.success);

      if (results.length === successes.length) {
        console.log(`Success. ${results.length} file(s) deleted successfully.\n${results.map(res => res.path).join("\n")}`);
      } else {
        console.log(`Failure. ${successes.length} file(s) deleted successfully. ${failures.length} file(s) failed to delete.\nSUCCESSES:\n${successes.map(su => su.path).join("\n")}\nFAILURES:\n${failures.map(fail => `${fail.path}: ${fail.error}`).join("\n")}`);
      }
    } catch (error) {
      console.error(`Failed to unlink ${filePath}`, error);
    }
  });
}