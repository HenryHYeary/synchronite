import * as p from "@clack/prompts";
import fs from "fs";
import { loadConfig } from "../config.js";
import { APP_PATHS } from "../paths.js";

export async function runAddDirectory(): Promise<void> {
  const config = loadConfig();

  const newDir = await p.text({
    message: "Directory to watch",
    validate(value) {
      if (!value) return "Path is required";
      if (!fs.existsSync(value)) return "Directory does not exist";
    },
  });

  if (p.isCancel(newDir)) { p.cancel("Cancelled"); process.exit(0) }

  const label = await p.text({
    message: "What should this be called in the cloud? (e.g. \"memcards\") - use the SAME label on every device",
    validate(value) {
      if (!value) return "Label is required";
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) return "Use only letters, numbers, dashes, underscores";
    },
  });

  if (p.isCancel(label)) { p.cancel("Cancelled"); process.exit(0) }

  const newExtensions = await p.text({
    message: "File extensions to watch in this directory (comma-separated, e.g. .mcd,.mcr)",
  });

  if (p.isCancel(newExtensions)) { p.cancel("Cancelled"); process.exit(0); }

  const updatedConfig = {
    ...config,
    additionalDirs: [...config.additionalDirs, { path: newDir, label }],
    additionalExtensions: [...config.additionalExtensions, ...newExtensions.split(",").map(e => e.trim())],
  };

  fs.writeFileSync(APP_PATHS.config, JSON.stringify(updatedConfig, null, 2));
  p.outro("Directory added. Restart synchronite to pick up the change");
}