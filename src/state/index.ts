import { APP_PATHS } from "../paths";
import fs from "fs";

interface FileRecord {
  hash: string;
  lastModified: string;
  lastSynced: number;
}

type SyncIndex = Record<string, FileRecord>

export function loadIndex(): SyncIndex {
  if (!fs.existsSync(APP_PATHS.index)) return {};
  return JSON.parse(fs.readFileSync(APP_PATHS.index, "utf-8"));
}

export function saveIndex(index: SyncIndex) {
  fs.writeFileSync(APP_PATHS.index, JSON.stringify(index, null, 2));
}