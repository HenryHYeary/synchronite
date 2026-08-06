import * as p from "@clack/prompts";
import path from "path";
import fs from "fs";
import { authenticate } from "../auth/oauth.js";
import { getDefaultRetroarchPaths, Paths } from "../retroarch.js";
import { APP_PATHS } from "../paths.js";
import { ConfigSchema } from "../config.js";

export async function runInit(): Promise<void> {
  p.intro("Synchronite setup");

  const defaults: Paths = getDefaultRetroarchPaths();

  const saves = await p.text({
    message: "RetroArch saves directory",
    placeholder: defaults.saves ?? "No defaults found - enter path manually",
    initialValue: defaults.saves ?? "",
    validate(value) {
      if (!value) return "Saves path is required";
      if (!fs.existsSync(value)) return "Directory does not exist";
    },
  });

  const states = await p.text({
    message: "RetroArch states directory",
    placeholder: defaults.states ?? "No defaults found - enter path manually",
    initialValue: defaults.states ?? "",
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

  if (provider !== "dropbox") {
    p.cancel("Only Dropbox is currently supported right now. Google Drive and S3 support are coming soon.");
    process.exit(0);
  }

  const spinner = p.spinner();
  spinner.start("Waiting for dropbox authorization in your browser...");

  try {
    await authenticate();
    spinner.stop("Dropbox connected.");
  } catch (error) {
    spinner.stop("Dropbox authentication failed.");
    console.error(error);
    process.exit(1);
  }

  const config = {
    retroarchSaveDir: path.resolve(saves),
    retroarchStateDir: path.resolve(states),
    cloudProvider: provider,
    syncIntervalMs: 5000,
    modificationStrategy: "latest-wins",
  };

  const result = ConfigSchema.safeParse(config);

  fs.writeFileSync(APP_PATHS.config, JSON.stringify(result.data, null, 2));
  p.outro(`Config saved to ${APP_PATHS.config}`);
}