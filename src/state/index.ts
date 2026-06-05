import { APP_PATHS } from "../paths";
import crypto from "crypto";
import fg from "fast-glob";
import fs from "fs";


interface FileRecord {
  hash: string;
  lastModified: number;
  lastSynced: number | null;
  size: number
}

export interface IndexDiff {
  added: string[];
  modified: string[];
  deleted: string[];
}

const SAVE_PATTERNS = ["**/*.srm", "**/*.sav", "**/*.srm.bak"];
const STATE_PATTERNS = ["**/*.state", "**/*.state[0-9]", "**/*.state[0-9][0-9]"];

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

async function findFiles(dir: string, patterns: string[]): Promise<string[]> {
  return fg(patterns.map(p => `${dir}/${p}`), { onlyFiles: true });
}

export async function generateIndex(savesDir: string, statesDir: string): Promise<SyncIndex> {
  const [saveFilePaths, stateFilePaths] = await Promise.all([
    findFiles(savesDir, SAVE_PATTERNS),
    findFiles(statesDir, STATE_PATTERNS),
  ]);

  const existingIndex = loadIndex();
  const index: SyncIndex = {};

  for (const file of [...saveFilePaths, ...stateFilePaths]) {
    const stat = await fs.promises.stat(file);
    const existing = existingIndex[file];

    if (
      existing &&
      stat.mtimeMs === existing.lastModified &&
      stat.size === existing.size
    ) {
      index[file] = existing;
      continue;
    }

    const content = await fs.promises.readFile(file);
    index[file] = {
      hash: crypto.createHash("sha256").update(content).digest("hex"),
      lastModified: stat.mtimeMs,
      lastSynced: existing?.lastSynced ?? null,
      size: stat.size,
    };
  }

  return index;
}

export function diffIndex(oldIndex: SyncIndex, newIndex: SyncIndex): IndexDiff {
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const [path, record] of Object.entries(newIndex)) {
    if (!oldIndex[path]) {
      added.push(path);
    } else if (oldIndex[path].hash !== record.hash) {
      modified.push(path);
    }
  }

  for (const path of Object.keys(newIndex)) {
    if (!newIndex[path]) {
      deleted.push(path);
    }
  }

  return { added, modified, deleted };
}