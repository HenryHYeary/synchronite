import { Config } from "../config.js";
import { DropboxAdapter } from "../cloud/dropbox.js";
import { loadIndex, saveIndex, SyncIndex } from "../state/index.js";
import { withPathLock } from "./pathLock.js";
import { computeDiskDerivedFields } from "../state/fileStats.js";
import path from "path";

async function processRemoteChange(
  adapter: DropboxAdapter,
  entry: { path: string; contentHash: string },
  localRootMap: (remotePath: string) => string | null,
): Promise<void> {
  const localPath = localRootMap(entry.path);
  if (!localPath) return;

  await withPathLock(localPath, async () => {
    const index = loadIndex();
    const existing = index[localPath];

    if (existing?.remoteContentHash === entry.contentHash) return;

    await downloadAndRecordFile(adapter, entry.path, localPath, entry.contentHash);
  });
}

export async function runRemoteSyncLoop(
  adapter: DropboxAdapter,
  remoteRoot: string,
  localRootMap: (remotePath: string) => string | null,
) : Promise<void> {
  let cursor = await adapter.getLatestCursor(remoteRoot);

  while (true) {
    let changed: boolean;
    try {
      changed = await adapter.longpoll(cursor);
    } catch(error) {
      console.error("Longpoll failed, retrying in 5s:", error);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    if (!changed) continue;
    
    let entries;
    try {
      const result = await adapter.listFolderContinue(cursor);
      entries = result.entries;
      cursor = result.cursor;
    } catch (error) {
      console.error("Failed to fetch remote changes", error);
      continue;
    }

    for (const entry of entries) {
      try {
        await processRemoteChange(adapter, entry, localRootMap);
      } catch (error) {
        console.error(`Failed to process remote change for ${entry.path}:`, error);
      }
    }
  }
}

export function makeLocalRootMap(config: Config): (remotePath: string) => string | null {
  const labelToDir = new Map<string, string>([
    ["saves", config.retroarchSaveDir],
    ["states", config.retroarchStateDir],
    ...config.additionalDirs.map(({ path, label }): [string, string] => [label, path]),
  ]);

  return (remotePath): string | null => {
    const parts = remotePath.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const [folderLabel, ...rest] = parts;
    const relativePath = rest.join("/");

    const rootDir = labelToDir.get(folderLabel);
    if (!rootDir) return null;

    return path.join(rootDir, relativePath);
  };
}

export async function downloadAndRecordFile(
  adapter: DropboxAdapter,
  remotePath: string,
  localPath: string,
  contentHash: string,
): Promise<void> {
  await adapter.download(remotePath, localPath);
  console.log(`Pulled remote change: ${remotePath} -> ${localPath}`);
  const diskFields = await computeDiskDerivedFields(localPath);

  const updated: SyncIndex = {
    ...loadIndex(),
    [localPath]: {
      ...diskFields,
      lastSynced: Date.now(),
      remotePath,
      remoteContentHash: contentHash,
    },
  };
  saveIndex(updated);
}