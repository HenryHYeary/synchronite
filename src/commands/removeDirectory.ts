import { APP_PATHS } from "../paths.js";
import fs from "fs";
import { ConfigSchema, loadConfig } from "../config.js";
import path from "path";
import * as p from "@clack/prompts";
import { loadIndex, saveIndex, SyncIndex } from "../state/index.js";

export async function runRemoveDirectory(): Promise<void> {
  const config = loadConfig();

  if (config.additionalDirs.length === 0) {
    p.cancel("No additional directories configured.");
    process.exit(0);
  }

  const targetLabel = await p.select({
    message: "Which directory do you want to stop watching?",
    options: config.additionalDirs.map(({ label, path }) => ({
      value: label,
      label: `${label} (${path})`,
    })),
  });
  if (p.isCancel(targetLabel)) { p.cancel("Cancelled"); process.exit(0); }

  const confirmed = await p.confirm({
    message: `Stop watching "${targetLabel}"? This only affects this device — files already in the cloud under this label won't be deleted.`,
    initialValue: false,
  });
  if (p.isCancel(confirmed)) { p.cancel("Cancelled"); process.exit(0); }
  if (!confirmed) { p.cancel("No changes made."); process.exit(0); }

  const targetDir = config.additionalDirs.find((d) => d.label === targetLabel)!;

  // Prune index entries under this directory
  const index = loadIndex();
  const prunedIndex: SyncIndex = {};
  for (const [localPath, record] of Object.entries(index)) {
    const relative = path.relative(targetDir.path, localPath);
    const isInside = !relative.startsWith("..") && !path.isAbsolute(relative);
    if (!isInside) prunedIndex[localPath] = record;
  }
  saveIndex(prunedIndex);

  const updatedConfig = {
    ...config,
    additionalDirs: config.additionalDirs.filter((d) => d.label !== targetLabel),
  };

  const result = ConfigSchema.safeParse(updatedConfig);
  if (!result.success) {
    console.error("Failed to build a valid config:", result.error);
    process.exit(1);
  }

  fs.writeFileSync(APP_PATHS.config, JSON.stringify(result.data, null, 2));
  p.outro(`Stopped watching "${targetLabel}". Restart Synchronite to pick up the change.`);
}