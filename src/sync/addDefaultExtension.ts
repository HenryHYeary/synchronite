import * as p from "@clack/prompts";
import fs from "fs";
import { ConfigSchema, loadConfig } from "../config.js";
import { APP_PATHS } from "../paths.js";

export async function runAddDefaultExtension(): Promise<void> {
  const config = loadConfig();

  const targetDir = await p.select({
    message: "Which default directory would you like to add an extension to?",
    options: [
      { value: "saves", label: `saves (${config.retroarchSaveDir})` },
      { value: "states", label: `states (${config.retroarchStateDir})` }
    ],
  });

  if (p.isCancel(targetDir)) { p.cancel("Cancelled"); process.exit(0) }

  const currAddExts = targetDir === "saves" ? config.additionalSaveExtensions : config.additionalStateExtensions;

  const newExt = await p.text({
    message: "What new extension would you like to add to this default directory? (comma separated, e.g. .json)",
    validate(value) {
      if (!value) return "Additional extensions required";
      if (!/\.[a-zA-Z0-9]+$/.test(value)) return "Invalid file extension (must start with a period)";
      if (currAddExts.includes(value)) return "This extension is already watched in this directory.";
    }
  });

  if (p.isCancel(newExt)) { p.cancel("Cancelled"); process.exit(0) }

  const newExts = [...currAddExts, newExt];
  const propName = targetDir === "saves" ? "additionalSaveExtensions" : "additionalStateExtensions";

  const newConfig = {
    ...config,
    [propName]: newExts
  };

  const result = ConfigSchema.safeParse(newConfig);
  if (!result.success) { console.error("Failed to build a valid config:", result.error); process.exit(1); }

  fs.writeFileSync(APP_PATHS.config, JSON.stringify(result.data, null, 2));
  p.outro(`Added ${newExt} to ${targetDir}. Restart Synchronite to pick up the change.`);
}