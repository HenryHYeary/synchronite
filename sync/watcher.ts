import chokidar from "chokidar";
import { loadConfig } from "../src/config";

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