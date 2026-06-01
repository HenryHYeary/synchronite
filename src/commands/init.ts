import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import { detectRetroarchPaths } from "../retroarch";
import { APP_PATHS } from "../paths";

export async function runInit(): Promise<void> {
  p.intro("Synchronite setup");

  const detected = detectRetroarchPaths();

  const saves = await p.text({
    message: "RetroArch saves directory",
    placeholder: detected.saves ?? "No default found - enter path manually",
    initialValue: detected.saves ?? "",
    validate(value) {
      if (!value) return "Saves path is required";
      if (!fs.existsSync(value)) return "Directory does not exist";
    },
  });

  const states = await p.text({
    message: "RetroArch states directory",
    placeholder: detected.states ?? "No default found - enter path manually",
    initialValue: detected.saves ?? "",
    validate(value) {
      if (!value) return "States path is required";
      if (!fs.existsSync(value)) return "Directory does not exist";
    },
  });

  const provider = await p.select({
    message: "Cloud provider",
    options: [
      { value: "dropbox", label: "Dropbox" },
      { value: "gdrive", label: "Google Drive"},
      { value: "s3", label: "S3 Compatible" },
    ],
  });

  if (p.isCancel(saves) || p.isCancel(states) || p.isCancel(provider)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }

  const config = {
    retroarchSaveDir: saves,
    retroarchStateDir: states,
    cloudProvider: provider,
    cloudConfig: {},
    syncIntervalMs: 5000,
    conflictStrategy: "latest-wins",
  };

  fs.writeFileSync(APP_PATHS.config, JSON.stringify(config, null, 2));
  p.outro(`Config saved to ${APP_PATHS.config}`);
}