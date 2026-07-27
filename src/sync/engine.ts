
import { diffIndex, SyncIndex } from "../state/index.js";
import { CloudAdapter } from "../cloud/adapter.js";
import { PathRecord } from "../state/index.js";

export interface SyncResult {
  path: string;
  success: boolean;
  error?: unknown;
}

async function uploadEntry(adapter: CloudAdapter, entry: PathRecord): Promise<SyncResult> {
  try {
    await adapter.upload(entry.path, entry.record.remotePath);
    return { path: entry.path, success: true };
  } catch(error) {
    return { path: entry.path, success: false, error };
  }
}

async function deleteEntry(adapter: CloudAdapter, filePath: string): Promise<SyncResult> {
  try {
    await adapter.deleteRemote(filePath);
    return { path: filePath, success: true };
  } catch (error) {
    return { path: filePath, success: false, error };
  }
}
 
export default async function syncFile(adapter: CloudAdapter, oldIndex: SyncIndex, newIndex: SyncIndex): Promise<SyncResult[]> {
    
  const { added, modified, deleted } = diffIndex(oldIndex, newIndex);

  const results = await Promise.all([ 
    added.map(addedEntry => uploadEntry(adapter, addedEntry)),
    modified.map(modEntry => uploadEntry(adapter, modEntry)),
    deleted.map(deletedPath => deleteEntry(adapter, deletedPath))
  ].flat());

  return results;
}