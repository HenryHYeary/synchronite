import { DropboxAdapter } from "../cloud/dropbox.js";
import { loadIndex, saveIndex, SyncIndex } from "../state/index.js";

export async function runRemoteSyncLoop(
  adapter: DropboxAdapter,
  remoteRoot: string,
  localRootMap: (remotePath: string) => string | null,
) : Promise<void> {
  let cursor = await adapter.getLatestCursor(remoteRoot);
}