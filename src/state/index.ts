import { APP_PATHS } from "../paths";
import crypto from "crypto";
import fg from "fast-glob";
import fs from "fs";


export interface FileRecord {
  hash: string;
  lastModified: number;
  lastSynced: number | null;
  size: number;
  remotePath: string;
}

export interface IndexDiff {
  added: [string, FileRecord][];
  modified: [string, FileRecord][];
  deleted: string[];
}

const SAVE_PATTERNS = ["**/*.srm", "**/*.sav", "**/*.srm.bak"];
const STATE_PATTERNS = ["**/*.state", "**/*.state[0-9]", "**/*.state[0-9][0-9]"];

export type SyncIndex = Record<string, FileRecord>

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

async function findFiles(dir: string, patterns: string[]): Promise<string[]> {
  return fg(patterns.map(p => `${dir}/${p}`), { onlyFiles: true });
}

export async function generateIndex(savesDir: string, statesDir: string): Promise<SyncIndex> {
  const [saveFilePaths, stateFilePaths] = await Promise.all([
    findFiles(savesDir, SAVE_PATTERNS),
    findFiles(statesDir, STATE_PATTERNS),
  ]);

  const index = loadIndex();

  await Promise.all([...saveFilePaths, ...stateFilePaths].map(p => updateIndex(index, p)));

  return index;
}

export async function updateIndex(index: SyncIndex, file: string): Promise<boolean> {
  const stat = await fs.promises.stat(file);
  const existing = index[file];

  if (
    existing &&
    stat.mtimeMs === existing.lastModified &&
    stat.size === existing.size
  ) {
    return false;
  }

  const content = await fs.promises.readFile(file);
  index[file] = {
    hash: crypto.createHash("sha256").update(content).digest("hex"),
    lastModified: stat.mtimeMs,
    lastSynced: existing?.lastSynced ?? null,
    size: stat.size,
    remotePath: file.slice(file.indexOf("retroarch") + "retroarch".length),
  };

  return true;
}

export function diffIndex(oldIndex: SyncIndex, newIndex: SyncIndex): IndexDiff {
  const added: [string, FileRecord][] = [];
  const modified: [string, FileRecord][] = [];
  const deleted: string[] = [];

  for (const [path, record] of Object.entries(newIndex)) {
    if (!oldIndex[path]) {
      added.push([path, record]);
    } else if (oldIndex[path].hash !== record.hash) {
      modified.push([path, record]);
    }
  }

  for (const path of Object.keys(oldIndex)) {
    if (!newIndex[path]) {
      deleted.push(path);
    }
  }

  return { added, modified, deleted };
}