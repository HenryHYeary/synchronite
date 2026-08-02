import { getValidAccessToken } from "../auth/oauth.js";
import { CloudAdapter, RemoteFileRecord } from "./adapter.js"
import { promises as fs } from "fs";

interface DropboxEntry {
  ".tag": string;
  path_display: string;
  size: number;
  server_modified: string;
  content_hash: string;
}

function formatFileEntries(entries: DropboxEntry[]): RemoteFileRecord[] {
  return entries.filter((entry) => entry[".tag"] === "file")
                .map((entry) => ({
                  path: entry.path_display,
                  size: entry.size,
                  lastModified: new Date(entry.server_modified).getTime(),
                  contentHash: entry.content_hash,
                }));
}

export class DropboxAdapter implements CloudAdapter {
  async upload(localPath: string, remotePath: string): Promise<void> {
    const token = getValidAccessToken();
    const file = await fs.readFile(localPath);
  
    const response = await fetch("https://content.dropboxapi.com/2/files/upload", { method: "POST", headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({ path: remotePath, mode: { ".tag": "overwrite" } }),
    },
    body: file,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    }
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const token = getValidAccessToken();
    const response = await fetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers: {
      "Authorization": `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: remotePath }),
    }});

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.arrayBuffer();

    await fs.writeFile(localPath, Buffer.from(data));
  }

  async listRemote(prefix: string): Promise<RemoteFileRecord[]> {
    const token = getValidAccessToken();
    const response = await fetch("https://api.dropboxapi.com/2/files/list_folder", { method: "POST", headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      },
      body: 
        JSON.stringify({ path: prefix, recursive: true }),
      });

      if (!response.ok) {
      throw new Error(`List failed: ${response.status} ${await response.text()}`);
    }
    const json = await response.json();
    return formatFileEntries(json.entries);
    // TODO: check has_more for pagination after GUI is created for this app.
  }

  async deleteRemote(remotePath: string): Promise<void> {
    const token = getValidAccessToken();
    const response = await fetch("https://api.dropboxapi.com/2/files/delete_v2", { method: "POST", headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: remotePath })
    });

    if (!response.ok) {
      throw new Error(`Deletion failed: ${response.status} ${await response.text()}`);
    }
  }

  async getLatestCursor(prefix: string): Promise<string> {
    const token = getValidAccessToken();
    const response = await fetch("https://api.dropboxapi.com/2/files/list_folder/get_latest_cursor", {
      method: "POST",
      headers: {
        "Authorization": `Bearer  ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: prefix, recursive: true }),
    });

    if (!response.ok) {
      throw new Error(`Get cursor failed ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    return json.cursor;
  }

  async longpoll(cursor: string, timeoutSeconds: number = 30): Promise<boolean> {
    const token = getValidAccessToken();
    const response = await fetch("https://notify.dropboxapi.com/2/files/list_folder/longpoll", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursor, timeout: timeoutSeconds}),
    });

    if (!response.ok) {
      throw new Error(`Longpoll failed: ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    return json.changes;
  }

  async listFolderContinue(cursor: string): Promise<{ entries: RemoteFileRecord[]; cursor: string; hasMore: boolean }> {
    const token = getValidAccessToken();
    const response = await fetch("https://api.dropboxapi.com/2/files/list_folder/continue", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursor }),
    });

    if (!response.ok) {
      throw new Error(`List continue failed: ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    return {
      entries: formatFileEntries(json.entries),
      cursor: json.cursor,
      hasMore: json.has_more
    }
  }
}
