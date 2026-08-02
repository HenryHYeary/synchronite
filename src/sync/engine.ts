
import { diffIndex, SyncIndex } from "../state/index.js";
import { CloudAdapter } from "../cloud/adapter.js";
import { PathRecord } from "../state/index.js";
import { Config } from "../config.js";

export interface SyncResult {
  isUpload: boolean;
  path: string;
  success: boolean;
  error?: unknown;
  skipped?: boolean;
  contentHash?: string;
}

async function uploadEntry(adapter: CloudAdapter, entry: PathRecord): Promise<SyncResult> {
  try {
    const { contentHash } = await adapter.upload(entry.path, entry.record.remotePath);
    return { isUpload: true, path: entry.path, success: true, contentHash };
  } catch(error) {
    return { isUpload: true, path: entry.path, success: false, error };
  }
}

async function deleteEntry(adapter: CloudAdapter, filePath: string, config: Config): Promise<SyncResult> {
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
 
export default async function syncFile(adapter: CloudAdapter, oldIndex: SyncIndex, newIndex: SyncIndex, config: Config): Promise<{ results: SyncResult[], confirmedIndex: SyncIndex }> {
    
  const { added, modified, deleted } = diffIndex(oldIndex, newIndex);

  const results = await Promise.all([ 
    added.map(addedEntry => uploadEntry(adapter, addedEntry)),
    modified.map(modEntry => uploadEntry(adapter, modEntry)),
    deleted.map(deletedPath => deleteEntry(adapter, deletedPath, config))
  ].flat());

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