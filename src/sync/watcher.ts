import chokidar from "chokidar";
import { Config } from "../config";
import { loadIndex, updateIndex } from "../state";

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

  watcher.on("change", async (filePath) => {
    const index = loadIndex();
    const updated = await updateIndex(index, filePath);

    if (!updated) {
      throw new Error("Failed to update index.");
    }

    // TODO: implement syncFile in sync engine module
    // Messy code below, need to find a better way to do this
    // await syncFile(filePath, path.relative(path.normalize(`${config.retroarchSaveDir}/..`), filePath));
  });
}