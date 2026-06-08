#!/usr/bin/env node

import { ensureAppDirs, APP_PATHS } from "./paths";
import { loadConfig } from "./config";
import { runInit } from "./commands/init";
import fs from "fs";

const command = process.argv[2];

ensureAppDirs();

if (command == "init") {
  runInit();
} else {
  if (!fs.existsSync(APP_PATHS.config)) {
    console.error("No config found. Run `synchronite init` first.");
    process.exit(1);
  }

  const config = loadConfig(APP_PATHS.config);
}