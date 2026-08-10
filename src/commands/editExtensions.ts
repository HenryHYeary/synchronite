import { APP_PATHS } from "../paths.js";
import { ConfigSchema } from "../config.js";
import fs from "fs";
import { loadConfig } from "../config.js";
import * as p from "@clack/prompts";

export async function runEditExtensions(): Promise<void> {
  const config = loadConfig();

  if (config.additionalDirs.length === 0) {
    p.cancel("No additional directories configured. Run `synchronite add-directory` first.");
    process.exit(0);
  }

  const targetLabel = await p.select({
    message: "Which directory do you want to edit?",
    options: config.additionalDirs.map(({ label: dirLabel, path }) => {
      return {
        value: dirLabel,
        label: `${dirLabel} (${path})`,
      }
    }),
  });

  if (p.isCancel(targetLabel)) { p.cancel("Cancelled"); process.exit(0); }

  const currentDir = config.additionalDirs.find((d) => d.label === targetLabel);

  const newExtensions = await p.text({
    message: "File extensions to watch (comma-separated, e.g. .mcd,.mcr, or * for all files)",
    initialValue: currentDir?.extensions.join(","),
    validate(value) {
      if (!value) return "Extensions are required.";
      const exts = value.split(",").map((e) => e.trim());
      if (exts.includes("*") && exts.length > 1) return "Use \"*\" on its own to watch all files, not combined with other extensions";
      if (exts.includes("*")) return;
      const invalid = exts.find((e) => !/^\.[a-zA-Z0-9]+$/.test(e));
      if (invalid) return `Invalid extension: "${invalid}" - each must start with a period, e.g. .mcd`;
    }
  });

  if (p.isCancel(newExtensions)) { p.cancel("Cancelled"); process.exit(0) }

  const includeStateSlots = await p.confirm({
    message: "Should this directory watch for state slots? (e.g. .state0, .state1, .state2)",
    initialValue: currentDir!.includeStateSlots,
  });

  if (p.isCancel(includeStateSlots)) { p.cancel("Cancelled"); process.exit(0); }

  const updatedConfig = {
    ...config,
    additionalDirs: config.additionalDirs.map((dir) =>
      dir.label === targetLabel
        ? {
            ...dir,
            extensions: newExtensions.split(",").map((e) => e.trim()),
            includeStateSlots,
          }
        : dir
    ),
  };

  const result = ConfigSchema.safeParse(updatedConfig);
  if (!result.success) {
    console.error("Failed to build a valid config:", result.error);
    process.exit(1);
  }

  fs.writeFileSync(APP_PATHS.config, JSON.stringify(result.data, null, 2));
  p.outro("Directory updated. Restart Synchronite to pick up the change.");
}