import { ConfigSchema, loadConfig } from "../config.js";
import fs from "fs";
import * as p from "@clack/prompts";
import { APP_PATHS } from "../paths.js";

export async function runRemoveDefaultExtension(): Promise<void> {
  const config = loadConfig();
  
  const targetDir = await p.select({
    message: "Which default directory would you like to remove an extension from?",
    options: [
      { value: "saves", label: `saves (${config.retroarchSaveDir})` },
      { value: "states", label: `states (${config.retroarchStateDir})`},
    ],
  });

  if (p.isCancel(targetDir)) { p.cancel("Cancelled"); process.exit(0) }

  const currAddExts = targetDir === "saves" ? config.additionalSaveExtensions : config.additionalStateExtensions;

  const extToRemove = await p.select({
    message: "Which extension would you like to remove?",
    options: currAddExts.map(ext => ({
      value: ext, 
      label: ext,
    })),
  });

  if (p.isCancel(targetDir)) { p.cancel("Cancelled"); process.exit(0) }

  const propName = targetDir === "saves" ? "additionalSaveExtensions" : "additionalStateExtensions";

  const newConfig = {
    ...config,
    [propName]: currAddExts.filter(ext => ext !== extToRemove),
  };

  const result = ConfigSchema.safeParse(newConfig);
  if (!result.success) { console.error("Failed to build a valid config:", console.error); process.exit(1); }

  fs.writeFileSync(APP_PATHS.config, JSON.stringify(result.data, null, 2));
  p.outro(`Removed ${String(extToRemove)} from ${targetDir}. Restart Synchronite to pick up the change.`);
}