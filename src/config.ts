import { z } from "zod";
import fs from "fs";

export const ConfigSchema = z.object({
  retroarchSaveDir: z.string(),
  retroarchStateDir: z.string(),
  cloudProvider: z.enum(["s3", "gdrive", "dropbox"]),
  cloudConfig: z.record(z.string(), z.string()),
  syncIntervalMs: z.number().positive().default(5000),
  conflictStrategy: z.enum(["latest-wins", "prompt"]).default("latest-wins"),
});

export type Config = z.infer<typeof ConfigSchema>;


export function loadConfig(filePath: string): Config {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    console.error("Invalid config:\n", result.error.format());
    process.exit(1);
  }

  return result.data;
}