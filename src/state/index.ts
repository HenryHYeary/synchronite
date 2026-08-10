import { APP_PATHS } from "../paths.js";
import fs from "fs";
import { computeDiskDerivedFields } from "./fileStats.js";
import { Config, constructAllDirs, DirRecord, loadConfig } from "../config.js";
import path from "path";


export interface FileRecord {
  hash: string;
  lastModified: number;
  lastSynced: number | null;
  size: number;
  remotePath: string;
  remoteContentHash: string | null;
}

export interface PathRecord {
  path: string;
  record: FileRecord;
}
export interface IndexDiff {
  added: PathRecord[];
  modified: PathRecord[];
  deleted: PathRecord[];
}

export const DEFAULT_SAVE_SUFFIXES = [".srm", ".sav", ".srm.bak", ".ps2", ".raw", ".gci"];
export const DEFAULT_STATE_SUFFIXES = [".state"];

export const STATE_SLOT_PATTERN = /\.state\d+$/;

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

async function findFiles(
  dir: string,
  extensions: string[],
  includeStateSlots: boolean = false,
): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true, recursive: true });
  if (extensions.includes("*")) {
    return entries
            .filter((entry) => entry.isFile())
            .map((entry) => path.resolve(entry.parentPath, entry.name))
  }
  return entries.filter((entry) => {
    if (!entry.isFile()) return false;
    const matchesExtension = extensions.some((ext) => entry.name.endsWith(ext));
    const matchesStateSlot = includeStateSlots && STATE_SLOT_PATTERN.test(entry.name);
    return matchesExtension || matchesStateSlot;
  }).map((entry) => path.resolve(entry.parentPath, entry.name));
}

export async function generateIndex(config: Config): Promise<SyncIndex> {
  const watchedDirs: DirRecord[] = constructAllDirs(config);
  const allPaths: string[][] = await Promise.all(
    watchedDirs.map(({ path, extensions, includeStateSlots }) => {
      return findFiles(path, extensions, includeStateSlots);
    })
  );

  let index = loadIndex();
  for (const p of allPaths.flat()) {
    index = await updateIndex(index, p);
  }

  return index;
}

function computeRemotePath(file: string, config: Config): string {
  const watchedDirs = constructAllDirs(config);

  for (const { path: dir, label } of watchedDirs) {
    const relative = path.relative(dir, file);
    const isInside = !relative.startsWith("..") && !path.isAbsolute(relative);
    if (isInside) {
      const normalizedRelative = relative.split(path.sep).join("/");
      return `/${label}/${normalizedRelative}`;
    }
  }

  throw new Error(`File ${file} is not inside any configured watched directory`);
}

export async function updateIndex(index: SyncIndex, file: string): Promise<SyncIndex> {
  const config = loadConfig();
  const remotePath = computeRemotePath(file, config);

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

    const diskDerivedFields = await computeDiskDerivedFields(file);

    const fileData = {
      ...diskDerivedFields,
      lastSynced: existing?.lastSynced ?? null,
      remotePath,
      remoteContentHash: existing?.remoteContentHash ?? null,
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
  const deleted: PathRecord[] = [];

  for (const [path, record] of Object.entries(newIndex)) {
    if (!oldIndex[path]) {
      added.push({ path, record });
    } else if (oldIndex[path].hash !== record.hash) {
      modified.push({ path, record });
    }
  }

  for (const [path, record] of Object.entries(oldIndex)) {
    if (!newIndex[path]) {
      deleted.push({ path, record });
    }
  }

  return { added, modified, deleted };
}