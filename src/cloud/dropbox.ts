import { CloudAdapter, RemoteFileRecord } from "./adapter"
import { promises as fs } from "fs" 

export class DropboxAdapter implements CloudAdapter {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const file = await fs.readFile(localPath);
  
    const response = await fetch("https://content.dropboxapi.com/2/files/upload", { method: "POST", headers: {
      "Authorization": `Bearer ${this.token}`,
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
    const response = await fetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers: {
      "Authorization": `Bearer ${this.token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: remotePath }),
    }});

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.arrayBuffer();

    await fs.writeFile(localPath, Buffer.from(data));
  }

  async listRemote(prefix: string): Promise<RemoteFileRecord[]> {
    const response = await fetch("https://api.dropboxapi.com/2/files/list_folder", { method: "POST", headers: {
      "Authorization": `Bearer ${this.token}`,
      "Content-Type": "application/json",
      },
      body: 
        JSON.stringify({ path: prefix, recursive: true }),
      });

      if (!response.ok) {
      throw new Error(`List failed: ${response.status} ${await response.text()}`);
    }
    const json = await response.json();
    return json.entries
      .filter((entry: any) => entry[".tag"] === "file")
      .map((entry: any) => ({
        path: entry.path_display,
        size: entry.size,
        lastModified: new Date(entry.server_modified).getTime(),
        contentHash: entry.content_hash,
      })
    );
  }

  async deleteRemote(remotePath: string): Promise<void> {
    const response = await fetch("https://api.dropboxapi.com/2/files/delete_v2", { method: "POST", headers: {
      "Authorization": `Bearer ${this.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: remotePath })
    });

    if (!response.ok) {
      throw new Error(`Deletion failed: ${response.status} ${await response.text()}`);
    }
  }
}
