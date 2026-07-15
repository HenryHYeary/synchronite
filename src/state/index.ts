import { APP_PATHS } from "../paths";
import crypto from "crypto";
import fg from "fast-glob";
import fs from "fs";
import { loadConfig } from "../config";
import path from "path";


export interface FileRecord {
  hash: string;
  lastModified: number;
  lastSynced: number | null;
  size: number;
  remotePath: string;
}

export interface PathRecord {
  path: string;
  record: FileRecord;
}
export interface IndexDiff {
  added: PathRecord[];
  modified: PathRecord[];
  deleted: string[];
}

const SAVE_PATTERNS = ["**/*.srm", "**/*.sav", "**/*.srm.bak"];
const STATE_PATTERNS = ["**/*.state", "**/*.state[0-9]", "**/*.state[0-9][0-9]"];

export type SyncIndex = Record<string, FileRecord>

export function loadIndex(): SyncIndex {
  try {
    return JSON.parse(fs.readFileSync(APP_PATHS.index, "utf-8"));
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    } else {
      throw new Error("Failed to load index.", { cause: error });
    }
  }
}

export function saveIndex(index: SyncIndex) {
  fs.writeFileSync(APP_PATHS.index, JSON.stringify(index, null, 2));
}

async function findFiles(dir: string, patterns: string[]): Promise<string[]> {
  return fg(patterns.map(p => `${dir}/${p}`), { onlyFiles: true });
}

export async function generateIndex(savesDir: string, statesDir: string): Promise<SyncIndex> {
  const [saveFilePaths, stateFilePaths] = await Promise.all([
    findFiles(savesDir, SAVE_PATTERNS),
    findFiles(statesDir, STATE_PATTERNS),
  ]);

  let index = loadIndex();

  for (const p of [...saveFilePaths, ...stateFilePaths]) {
    index = await updateIndex(index, p);
  }

  return index;
}

export async function updateIndex(index: SyncIndex, file: string): Promise<SyncIndex> {
  const config = loadConfig();
  const relativeToSave = path.relative(config.retroarchSaveDir, file);
  const relativeToState = path.relative(config.retroarchStateDir, file);
  const inSaveDir = !relativeToSave.startsWith("..");
  const inStateDir = !relativeToState.startsWith("..");
  
  let baseDir = "";

  if (inSaveDir !== inStateDir) {
    baseDir = inSaveDir ? config.retroarchSaveDir : config.retroarchStateDir;
  } else {
    throw new Error(`File ${file} is not inside a configured save or state directory`);
  }

  try {
    const stat = await fs.promises.stat(file);
    const existing = index[file];

    if (
      existing &&
      stat.mtimeMs === existing.lastModified &&
      stat.size === existing.size
    ) {
      return index;
    }

    const content = await fs.promises.readFile(file);
    const fileData = {
      hash: crypto.createHash("sha256").update(content).digest("hex"),
      lastModified: stat.mtimeMs,
      lastSynced: existing?.lastSynced ?? null,
      size: stat.size,
      remotePath: inSaveDir ? relativeToSave : relativeToState,
    };

    return { ...index, [file]: fileData };
  } catch (error) {
    throw new Error("Failed to update file.", { cause: error });
  }
}

export function removeFromIndex(index: SyncIndex, file: string): SyncIndex {
  const newIndex = Object.assign({}, index);
  delete newIndex[file];
  return newIndex;
}

export function diffIndex(oldIndex: SyncIndex, newIndex: SyncIndex): IndexDiff {
  const added: PathRecord[] = [];
  const modified: PathRecord[] = [];
  const deleted: string[] = [];

  for (const [path, record] of Object.entries(newIndex)) {
    if (!oldIndex[path]) {
      added.push({ path, record });
    } else if (oldIndex[path].hash !== record.hash) {
      modified.push({ path, record });
    }
  }

  for (const path of Object.keys(oldIndex)) {
    if (!newIndex[path]) {
      deleted.push(path);
    }
  }

  return { added, modified, deleted };
}