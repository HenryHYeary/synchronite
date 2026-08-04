
import { diffIndex, SyncIndex } from "../state/index.js";
import { CloudAdapter } from "../cloud/adapter.js";
import { PathRecord } from "../state/index.js";
import { Config } from "../config.js";
import { DropboxAdapter } from "../cloud/dropbox.js";

export interface SyncResult {
  isUpload: boolean;
  path: string;
  success: boolean;
  error?: unknown;
  skipped?: boolean;
  contentHash?: string;
}

export async function uploadEntry(adapter: CloudAdapter, entry: PathRecord): Promise<SyncResult> {
  try {
    const { contentHash } = await adapter.upload(entry.path, entry.record.remotePath);
    return { isUpload: true, path: entry.path, success: true, contentHash };
  } catch(error) {
    return { isUpload: true, path: entry.path, success: false, error };
  }
}

export async function deleteEntry(adapter: CloudAdapter, filePath: string, config: Config): Promise<SyncResult> {
  if (!config.propagateDeletes) {
    return { isUpload: false, path: filePath, success: true, skipped: true };
  }

  try {
    await adapter.deleteRemote(filePath);
    return { isUpload: false, path: filePath, success: true };
  } catch (error) {
    return { isUpload: false, path: filePath, success: false, error };
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithDelay<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  delayMs: number,  
): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) {
    results.push(await fn(item));
    await delay(delayMs);
  }

  return results;
}

// TODO: another location to eventually switch back to CloudAdapter
export default async function syncFile(adapter: DropboxAdapter, oldIndex: SyncIndex, newIndex: SyncIndex, config: Config): Promise<{ results: SyncResult[], confirmedIndex: SyncIndex }> {
    
  const { added, modified, deleted } = diffIndex(oldIndex, newIndex);
  
  const uploadEntries = [...added, ...modified];
  const DELAY_MS = 500;

  const uploadResults = await runWithDelay(uploadEntries, (entry) => uploadEntry(adapter, entry), DELAY_MS);
  const deleteResults = await runWithDelay(deleted, (entry) => deleteEntry(adapter, entry, config), DELAY_MS);

  const results = [...uploadResults, ...deleteResults];

  const successes = results.filter(r => r.success);
  let confirmedIndex: SyncIndex = Object.assign({}, oldIndex);
  for (const success of successes) {
    const path = success.path;
    if (success.isUpload) {
      confirmedIndex[path] = newIndex[path];
      confirmedIndex[path].lastSynced = Date.now();
      confirmedIndex[path].remoteContentHash = success.contentHash ?? newIndex[path].remoteContentHash;
    } else {
      delete confirmedIndex[path]
    }
  }

  return { results, confirmedIndex };
}