import os from "os";
import path from "path";
import fs from "fs";

function getDefaultRetroarchPaths(): {
  saves: string,
  states: string,
} {
  const home = os.homedir();

  switch (process.platform) {
    case "win32":
      return {
        saves: path.join(process.env.APPDATA!, "RetroArch", "saves"),
        states: path.join(process.env.APPDATA!, "RetroArch", "states"),
      };
    case "darwin": {
      return {
        saves: path.join(home, "Documents", "RetroArch", "saves"),
        states: path.join(home, "Documents", "RetroArch", "states"),
      }
    } default: {
      return {
        saves: path.join(home, ".config", "retroarch", "saves"),
        states: path.join(home, ".config", "retroarch", "states"),
      }
    }
  }
}

export function detectRetroarchPaths(): {
  saves: string | null,
  states: string | null,
} {
  const defaults = getDefaultRetroarchPaths();

  return {
    saves: fs.existsSync(defaults.saves) ? defaults.saves : null,
    states: fs.existsSync(defaults.states) ? defaults.states : null,
  };
}