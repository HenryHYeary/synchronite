import { DirRecord, loadConfig } from "../config.js";
import { DEFAULT_SAVE_SUFFIXES, DEFAULT_STATE_SUFFIXES } from "../state/index.js";

export async function runListDirectories(): Promise<void> {
  const config = loadConfig();

  const watchedDirs: DirRecord[] = [
    { path: config.retroarchSaveDir, label: "saves", extensions: DEFAULT_SAVE_SUFFIXES, includeStateSlots: false },
    { path: config.retroarchStateDir, label: "states", extensions: DEFAULT_STATE_SUFFIXES, includeStateSlots: true },
    ...config.additionalDirs,
  ];

  for (const { path, label, extensions, includeStateSlots } of watchedDirs) {
    console.log(`LOCAL PATH: ${path}, LABEL: ${label}, EXTENSIONS: (${extensions.join(", ")}), STATE SLOTS WATCHED: ${includeStateSlots}`);
  }
}