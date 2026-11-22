import crypto from "crypto";
import { promises as fs } from "fs";

export interface DiskDerivedFields {
  hash: string;
  lastModified: number;
  size: number;
}

export async function computeDiskDerivedFields(localPath: string): Promise<DiskDerivedFields> {
  const content = await fs.readFile(localPath);
  const stat = await fs.stat(localPath);

  return {
    hash: crypto.createHash("sha256").update(content).digest("hex"),
    lastModified: stat.mtimeMs,
    size: stat.size,
  };
}