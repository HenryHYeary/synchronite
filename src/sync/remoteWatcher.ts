import { DropboxAdapter } from "../cloud/dropbox.js";
import { FileRecord } from "../state/index.js";
import crypto from "crypto";
import { promises as fsPromises } from "fs";
import { loadIndex, saveIndex, SyncIndex } from "../state/index.js";
import { withPathLock } from "./pathLock.js";

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
    
    try {
      const { entries, cursor: newCursor } = await adapter.listFolderContinue(cursor);
      cursor = newCursor;

      for (const entry of entries) {
        try {
          await processRemoteChange(adapter, entry, localRootMap);
        } catch (error) {
          console.error(`Failed to process remote change for ${entry.path}:`, error)
        }
      }
    } catch (error) {
      console.error("Failed to process remote changes:", error);
    }
  } 
}

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

    await adapter.download(entry.path, localPath);

    const content = await fsPromises.readFile(localPath);
    const stat = await fsPromises.stat(localPath);

    const updatedRecord: FileRecord = {
      hash: crypto.createHash("sha256").update(content).digest("hex"),
      lastModified: stat.mtimeMs,
      lastSynced: Date.now(),
      size: stat.size,
      remotePath: entry.path,
      remoteContentHash: entry.contentHash,
    };

    const updated: SyncIndex = { ...index, [localPath]: updatedRecord };
    saveIndex(updated);
  });
}