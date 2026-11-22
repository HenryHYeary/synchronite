import * as p from "@clack/prompts";
import path from "path" ;
import fs, { watch } from "fs";
import { Config, constructAllDirs, loadConfig } from "@synchronite/core";
import { APP_PATHS } from "@synchronite/core";
import { validateLabel, validateDirectoryOverlap, validateExtensions } from "@synchronite/core";

export async function runAddDirectory(): Promise<void> {
  const config = loadConfig();
  const watchedDirs = constructAllDirs(config);

  const newDir = await p.text({
    message: "Directory to watch",
    validate(value) {
      return validateDirectoryOverlap(value!, watchedDirs);
    }
  });

  if (p.isCancel(newDir)) { p.cancel("Cancelled"); process.exit(0) }

  const label = await p.text({
    message: "What should this be called in the cloud? (e.g. \"memcards\") - use the SAME label on every device",
    validate(value) {
      return validateLabel(value!, watchedDirs);
    },
  });

  if (p.isCancel(label)) { p.cancel("Cancelled"); process.exit(0) }

  const extensions = await p.text({
    message: "File extensions to watch in this directory (comma-separated, e.g. .mcd,.mcr) or * for all files",
    validate(value) {
      return validateExtensions(value!)
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