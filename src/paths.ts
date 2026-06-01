import envPaths from "env-paths";
import path from "path";
import fs from "fs";

const paths = envPaths("synchronite");

export const APP_PATHS = {
  config: path.join(paths.config, "config.json"),
  index: path.join(paths.data, "sync-index.json"),
  log: path.join(paths.log, "synchronite.log"),
};

export function ensureAppDirs() {
  fs.mkdirSync(paths.config, { recursive: true });
  fs.mkdirSync(paths.data, { recursive: true });
  fs.mkdirSync(paths.log, { recursive: true });
}