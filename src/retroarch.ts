import os from "os";
import path from "path";

export interface Paths {
  saves: string,
  states: string,
}

export function getDefaultRetroarchPaths(): Paths {
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