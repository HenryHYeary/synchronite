import { constructAllDirs, DirRecord, loadConfig } from "../config.js";

export async function runListDirectories(): Promise<void> {
  const config = loadConfig();

  const watchedDirs: DirRecord[] = constructAllDirs(config);

  for (const { path, label, extensions, includeStateSlots } of watchedDirs) {
    console.log(`LOCAL PATH: ${path}, LABEL: ${label}, EXTENSIONS: (${extensions.join(", ")}), STATE SLOTS WATCHED: ${includeStateSlots}`);
  }
}