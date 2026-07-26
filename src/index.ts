#!/usr/bin/env node

import { ensureAppDirs, APP_PATHS } from "./paths";
import { Config, loadConfig } from "./config";
import { runInit } from "./commands/init";
import fs from "fs";
import { CloudAdapter } from "./cloud/adapter";
import { DropboxAdapter } from "./cloud/dropbox";
import { Credentials, loadCredentials } from "./credentials";
import { runWatcher } from "./sync/watcher";

const command = process.argv[2];

ensureAppDirs();

async function main() {
  if (command == "init") {
    await runInit();
  } else {
    if (!fs.existsSync(APP_PATHS.config)) {
      console.error("No config found. Run `synchronite init` first.");
      process.exit(1);
    } else if (!fs.existsSync(APP_PATHS.credentials)) {
      console.error("No credentials found. Run `synchronite init` first.");
      process.exit(1);
    }

    let config: Config;
    let credentials: Credentials;

    try {
      config = loadConfig();
    } catch (error) {
      console.error("Failed to load config: ", error);
      process.exit(1)
    }

    try {
      credentials = loadCredentials();
    } catch (error) {
      console.error("Failed to load credentials: ", error);
      process.exit(1);
    }
    
    // TODO: dynamically create adapter based on config once other adapters are supported.
    const adapter: CloudAdapter = new DropboxAdapter(credentials.accessToken);

    try {
      await runWatcher(adapter);
    } catch (error) {
      console.error("Error running watcher: ", error);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error("Error running main: ", error);
  process.exit(1);
});