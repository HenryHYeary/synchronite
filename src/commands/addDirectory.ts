import * as p from "@clack/prompts";
import path from "path" ;
import fs from "fs";
import { Config, constructAllDirs, loadConfig } from "../config.js";
import { APP_PATHS } from "../paths.js";

export async function runAddDirectory(): Promise<void> {
  const config = loadConfig();
  const { retroarchSaveDir, retroarchStateDir, additionalDirs } = config
  const watchedDirs = constructAllDirs(config);

  const newDir = await p.text({
    message: "Directory to watch",
    validate(value) {
      if (!value) return "Path is required";
      if (!fs.existsSync(value)) return "Directory does not exist";

      const resolvedValue = path.resolve(value);
    
      for (const { path: existing } of watchedDirs) {
        const resolvedExisting = path.resolve(existing)
        if (resolvedValue === resolvedExisting) return "Directory already watched";
        if (!path.relative(resolvedExisting, resolvedValue).startsWith("..") || !path.relative(resolvedValue, resolvedExisting).startsWith("..")) {
          return "Overlaps with already watched directory";
        }
      }
    },
  });

  if (p.isCancel(newDir)) { p.cancel("Cancelled"); process.exit(0) }

  const label = await p.text({
    message: "What should this be called in the cloud? (e.g. \"memcards\") - use the SAME label on every device",
    validate(value) {
      if (!value) return "Label is required";
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) return "Use only letters, numbers, dashes, underscores";
      if (value === "saves" || value === "states") return "That label is reserved";
      if (watchedDirs.some(({ label: existingLabel }) => existingLabel === value)) return "That label is already in use";
    },
  });

  if (p.isCancel(label)) { p.cancel("Cancelled"); process.exit(0) }

  const extensions = await p.text({
    message: "File extensions to watch in this directory (comma-separated, e.g. .mcd,.mcr) or * for all files",
    validate(value) {
      if (!value) return "Extensions are required";
      if (value.trim() === "*") return;
      const exts = value.split(",").map(e => e.trim());
      const invalid = exts.find(e => !/^\.[a-zA-Z0-9]+$/.test(e));
      if (invalid) return `Invalid extension: "${invalid}" - each must start with a period, e.g. .mcd`;
    }
  });

  if (p.isCancel(extensions)) { p.cancel("Cancelled"); process.exit(0); }

  const includesStateSlots = await p.confirm({
    message: "Should this directory watch for state slots? (e.g. .state0, .state1, .state2)? [Y/N]",
    initialValue: false
  });

  if (p.isCancel(includesStateSlots)) { p.cancel("Cancelled"); process.exit(0); }

  const updatedConfig: Config = {
  ...config,
  additionalDirs: [...config.additionalDirs, { path: path.resolve(newDir), label, extensions: extensions.split(",").map(s => s.trim()), includeStateSlots: !!includesStateSlots }],
};

  fs.writeFileSync(APP_PATHS.config, JSON.stringify(updatedConfig, null, 2));
  p.outro("Directory added. Restart synchronite to pick up the change");
}