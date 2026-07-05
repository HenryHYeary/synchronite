
import { diffIndex, SyncIndex } from "../state";
import { CloudAdapter } from "../cloud/adapter";

export default async function syncFile(adapter: CloudAdapter, oldIndex: SyncIndex, newIndex: SyncIndex): Promise<boolean> {
  const { added, modified, deleted } = diffIndex(oldIndex, newIndex);

  // TODO: Need to find relative path using path module for remotePath parameter
  Promise.all(added.map(addedFile => adapter.upload(addedFile, addedFile)));

  return true;
}