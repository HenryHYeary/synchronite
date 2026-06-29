import chokidar from "chokidar";
import { Config } from "../config";
import { loadIndex } from "../state";
import fs from "fs";

const WATCH_PATTERNS = [
    "**/*.srm",
    "**/*.sav",
    "**/*.srm.bak",
    "**/*.state",
    "**/*.state[0-9]",
];

export async function runWatcher(config: Config) {
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

  watcher.on("add", (path) => {
    const index = loadIndex();
  });
}