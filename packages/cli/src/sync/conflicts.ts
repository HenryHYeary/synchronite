import { RemoteFileRecord } from "../cloud/adapter.js";
import { SyncIndex } from "../state/index.js";

interface FileDiff {
  localPath: string;
  localChanged: boolean;
  remoteChanged: boolean;
  remoteEntry?: RemoteFileRecord;
}

export async function detectConflicts(
  localIndex: SyncIndex,
  currentLocalFiles: SyncIndex, // fresh generateIndex() result
  remoteEntries: RemoteFileRecord[],
  localRootMap: (remotePath: string) => string | null,
): Promise<FileDiff[]> {
  const diffs = new Map<string, FileDiff>();

  for (const [localPath, current] of Object.entries(currentLocalFiles)) {
    const known = localIndex[localPath];
    if (!known || known.hash !== current.hash) {
      diffs.set(localPath, { localPath, localChanged: true, remoteChanged: false });
    }
  }

  for (const entry of remoteEntries) {
    const localPath = localRootMap(entry.path);
    if (!localPath) continue;
    const known = localIndex[localPath];
    if (!known || known.remoteContentHash !== entry.contentHash) {
      const existing = diffs.get(localPath);
      if (existing) existing.remoteChanged = true, existing.remoteEntry = entry;
      else diffs.set(localPath, { localPath, localChanged: false, remoteChanged: true, remoteEntry: entry });
    }
  }

  return Array.from(diffs.values());
}