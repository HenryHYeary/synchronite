import chokidar from "chokidar";
import { loadConfig } from "../config";
import { generateIndex, saveIndex } from "../state";

const WATCH_PATTERNS = [
    "**/*.srm",
    "**/*.sav",
    "**/*.srm.bak",
    "**/*.state",
    "**/*.state[0-9]",
];

const config = loadConfig();

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


// Unsure of this
watcher.on("add", async () => {
    const index = await generateIndex(config.retroarchSaveDir, config.retroarchStateDir);
    saveIndex(index);
})