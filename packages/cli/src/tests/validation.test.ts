import path from "path";
import { describe, it, expect } from "vitest";
import {
  validateLabel, isInside, validateDirectoryOverlap, validateExtensions, matchesExtensions,
} from "../validation.js";

describe("validateLabel", () => {
  const existing = [{ label: "memcards" }];

  it("accepts a fresh valid label", () => expect(validateLabel("roms-2", existing)).toBeUndefined());
  it("requires a value", () => expect(validateLabel("", existing)).toBe("Label is required"));
  it("rejects invalid characters", () => expect(validateLabel("my label", existing)).toMatch(/only letters/));

  it.each(["saves", "states", "Saves", "STATES", "sAvEs"])("rejects reserved label %s in any case", (l) => {
    expect(validateLabel(l, existing)).toBe("That label is reserved");
  });

  it("rejects an exact duplicate", () => expect(validateLabel("memcards", existing)).toBe("That label is already in use"));
  it("rejects a duplicate that differs only by case", () => {
    expect(validateLabel("Memcards", existing)).toBe("That label is already in use");
    expect(validateLabel("MEMCARDS", existing)).toBe("That label is already in use");
  });
});

describe("isInside (posix)", () => {
  const lib = path.posix;
  it("treats identical paths as inside", () => expect(isInside("/a/b", "/a/b", lib, false)).toBe(true));
  it("detects a nested child", () => expect(isInside("/a/b", "/a/b/c/d", lib, false)).toBe(true));
  it("does not match siblings", () => expect(isInside("/a/b", "/a/c", lib, false)).toBe(false));
  it("does not match a shared name prefix", () => expect(isInside("/a/b", "/a/bc", lib, false)).toBe(false));
  it("does not treat a '..foo' folder as outside", () => expect(isInside("/a", "/a/..foo", lib, false)).toBe(true));
  it("does not treat the parent as inside the child", () => expect(isInside("/a/b", "/a", lib, false)).toBe(false));
  it("is case-sensitive when told to be", () => expect(isInside("/a/B", "/a/b/c", lib, false)).toBe(false));
  it("is case-insensitive when told to be", () => expect(isInside("/a/B", "/a/b/c", lib, true)).toBe(true));
});

describe("validateDirectoryOverlap", () => {
  const posix = path.posix;
  const existing = [{ path: "/games/saves" }];

  it("accepts an unrelated directory", () => {
    expect(validateDirectoryOverlap("/games/other", existing, posix, false)).toBeUndefined();
  });
  it("rejects the same directory", () => {
    expect(validateDirectoryOverlap("/games/saves", existing, posix, false)).toBe("Directory already watched");
  });
  it("rejects a trailing-slash or unnormalized duplicate", () => {
    expect(validateDirectoryOverlap("/games/saves/", existing, posix, false)).toBe("Directory already watched");
    expect(validateDirectoryOverlap("/games/x/../saves", existing, posix, false)).toBe("Directory already watched");
  });
  it("rejects a directory nested inside a watched one", () => {
    expect(validateDirectoryOverlap("/games/saves/psx", existing, posix, false)).toMatch(/Overlaps/);
  });
  it("rejects a directory that contains a watched one", () => {
    expect(validateDirectoryOverlap("/games", existing, posix, false)).toMatch(/Overlaps/);
  });
  it("accepts a sibling with a shared name prefix", () => {
    expect(validateDirectoryOverlap("/games/saves-old", existing, posix, false)).toBeUndefined();
  });
  it("accepts a directory literally named '..foo' next to a watched one", () => {
    expect(validateDirectoryOverlap("/games/..foo", existing, posix, false)).toBeUndefined();
  });

  describe("Windows paths", () => {
    const win = path.win32;
    const winExisting = [{ path: "C:\\Games\\Saves" }];

    it("accepts the same folder name on a different drive", () => {
      expect(validateDirectoryOverlap("D:\\Games\\Saves", winExisting, win, true)).toBeUndefined();
    });
    it("accepts any directory on a different drive", () => {
      expect(validateDirectoryOverlap("D:\\Other", winExisting, win, true)).toBeUndefined();
    });
    it("rejects the same directory differing only by case", () => {
      expect(validateDirectoryOverlap("c:\\games\\saves", winExisting, win, true)).toBe("Directory already watched");
    });
    it("rejects a nested directory with different casing", () => {
      expect(validateDirectoryOverlap("c:\\GAMES\\saves\\psx", winExisting, win, true)).toMatch(/Overlaps/);
    });
  });
});

describe("validateExtensions", () => {
  it("requires a value", () => expect(validateExtensions("")).toBe("Extensions are required"));
  it("accepts '*'", () => expect(validateExtensions("*")).toBeUndefined());
  it("accepts '*' with surrounding whitespace", () => expect(validateExtensions("  *  ")).toBeUndefined());
  it("accepts a comma-separated list with spaces", () => expect(validateExtensions(".mcd, .mcr")).toBeUndefined());
  it("accepts uppercase extensions", () => expect(validateExtensions(".MCD")).toBeUndefined());
  it("rejects an extension without a leading period", () => expect(validateExtensions("mcd")).toMatch(/Invalid extension: "mcd - each must start with a period, e.g. .mcd"/));
  it("rejects a trailing comma", () => expect(validateExtensions(".mcd,")).toMatch(/Invalid extension/));
  it("rejects glob-style '*.mcd'", () => expect(validateExtensions("*.mcd")).toMatch(/Invalid extension/));
});

describe("matchesExtensions", () => {
  it("'*' matches any file, including ones with no extension", () => {
    expect(matchesExtensions("slot1.mcd", ["*"])).toBe(true);
    expect(matchesExtensions("README", ["*"])).toBe(true);
    expect(matchesExtensions(".hidden", ["*"])).toBe(true);
  });
  it("matches listed extensions only", () => {
    expect(matchesExtensions("a.mcd", [".mcd", ".mcr"])).toBe(true);
    expect(matchesExtensions("a.txt", [".mcd", ".mcr"])).toBe(false);
  });
  it("is case-insensitive in both directions", () => {
    expect(matchesExtensions("A.MCD", [".mcd"])).toBe(true);
    expect(matchesExtensions("a.mcd", [".MCD"])).toBe(true);
  });
  it("does not match a file that merely contains the extension", () => {
    expect(matchesExtensions("a.mcd.bak", [".mcd"])).toBe(false);
  });
});