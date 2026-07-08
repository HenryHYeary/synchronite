
import { diffIndex, SyncIndex } from "../state";
import { CloudAdapter } from "../cloud/adapter";

export default async function syncFile(adapter: CloudAdapter, oldIndex: SyncIndex, newIndex: SyncIndex): Promise<boolean> {
  const { added, modified, deleted } = diffIndex(oldIndex, newIndex);

  try {
    Promise.all([ 
      added.map(addedEntry => adapter.upload(addedEntry[0], addedEntry[1].remotePath)),
      modified.map(modEntry => adapter.upload(modEntry[0], modEntry[1].remotePath)),
      deleted.map(deletedPath => adapter.deleteRemote(deletedPath))
    ].flat());

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}