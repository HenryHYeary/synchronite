import { z } from "zod";
import fs from "fs";
import { APP_PATHS } from "./paths.js";

export const DirRecordSchema = z.object({ path: z.string(), label: z.string(), extensions: z.array(z.string()).default([]), includeStateSlots: z.boolean().default(false), });
export type DirRecord = z.infer<typeof DirRecordSchema>

export const ConfigSchema = z.object({
  retroarchSaveDir: z.string(),
  retroarchStateDir: z.string(),
  additionalDirs: z.array(DirRecordSchema).default([]),
  cloudProvider: z.enum(["s3", "gdrive", "dropbox"]),
  syncIntervalMs: z.number().positive().default(5000),
  modificationStrategy: z.enum(["latest-wins", "prompt"]).default("latest-wins"),
  propagateDeletes: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;


export function loadConfig(filePath: string = APP_PATHS.config): Config {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    throw new Error("Invalid config.", { cause: z.treeifyError(result.error) });
  }

  return result.data;
}