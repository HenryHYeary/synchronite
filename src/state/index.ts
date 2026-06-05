import { APP_PATHS } from "../paths";
import crypto from "crypto";
import fg from "fast-glob";
import fs from "fs";


interface FileRecord {
  hash: string;
  lastModified: string;
  lastSynced: number | null;
}

type SyncIndex = Record<string, FileRecord>

export function loadIndex(): SyncIndex {
  try {
    return JSON.parse(fs.readFileSync(APP_PATHS.index, "utf-8"));
  } catch {
    return {};
  }
}

export function saveIndex(index: SyncIndex) {
  fs.writeFileSync(APP_PATHS.index, JSON.stringify(index, null, 2));
}

async function findFilesByExt(dir: string, ext: string): Promise<string[]> {
  return fg(`${dir}/**/*${ext}`, { onlyFiles: true });
}

export async function generateIndex(savesDir: string, statesDir: string): Promise<SyncIndex> {
  const [saveFilePaths, stateFilePaths] = await Promise.all([
    findFilesByExt(savesDir, ".srm"),
    findFilesByExt(statesDir, ".state"),
  ]);

  const existingIndex = loadIndex();
  const index: SyncIndex = {};

  for (const file of [...saveFilePaths, ...stateFilePaths]) {
    const [stat, content] = await Promise.all([
      fs.promises.stat(file),
      fs.promises.readFile(file),
    ]);

    index[file] = {
      hash: crypto.createHash("sha256").update(content).digest("hex"),
      lastModified: stat.mtime.toISOString(),
      lastSynced: existingIndex[file]?.lastSynced ?? null,
    };
  }

  return index;
}