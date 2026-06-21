export type RemoteFileRecord = {
  contentHash: string;
  lastModified: number;
  size: number;
  path: string;
}

export interface CloudAdapter {
  upload(localPath: string, remotePath: string, contentHash?: string): Promise<void>;
  download(remotePath: string, localPath: string): Promise<void>;
  listRemote(prefix: string): Promise<RemoteFileRecord[]>;
  deleteRemote(remotePath: string): Promise<void>;
}