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

  async function processOnEvent(filePath: string, eventType: "add" | "change" | "unlink"): Promise<void> {
    const actionWord = { add: "sync", change: "sync", unlink: "unlink" }[eventType];
    const resultWord = { add: "uploaded", change: "uploaded", unlink: "deleted" }[eventType];
    const resultWordPres = { add: "upload", change: "upload", unlink: "delete" }[eventType];
    try {
      const index = loadIndex();
      const updated = eventType === "unlink" ? removeFromIndex(index, filePath) : await updateIndex(index, filePath);

      const results = await syncFile(adapter, index, updated);

      const successes = results.filter(res => res.success);
      const failures = results.filter(res => !res.success);

      if (results.length === successes.length) {
        console.log(`Success. ${results.length} file(s) ${resultWord} successfully.\n${results.map(res => res.path).join("\n")}`)
      } else {
        console.log(`Failure. ${successes.length} file(s) ${resultWord} successfully. ${failures.length} file(s) failed to ${resultWordPres}.\nSUCCESSES:\n${successes.map(su => su.path).join("\n")}\nFAILURES:\n${failures.map(fail => `${fail.path}: ${fail.error}`).join("\n")}`);
      }
    } catch (error) {
      console.error(`Failed to ${actionWord} ${filePath}`, error);
    }
  }

  watcher.on("change", (filePath) => processOnEvent(filePath, "change"));

  watcher.on("unlink", (filePath) => processOnEvent(filePath, "unlink"));
}