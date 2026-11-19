import path from "path";

export const RESERVED_LABELS = new Set(["saves", "states"]);
const defaultCaseSensitive = process.platform === "win32" || process.platform === "darwin";

export function validateLabel(value: string, existing: { label: string }[]): string | undefined {
  if (!value) return "Label is required";
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) return "Use only letters, numbers, dashes, underscores";
  const lower = value.toLowerCase();
  if (RESERVED_LABELS.has(lower)) return "That label is reserved";
  if (existing.some(d => d.label.toLowerCase() === lower)) return "That label is already in use";
}

export function isInside(
  parent: string,
  child: string,
  lib: typeof path = path,
  caseInsensitive = defaultCaseSensitive
): boolean {
  const norm = (s: string) => (caseInsensitive ? s.toLowerCase() : s);
  const rel = lib.relative(norm(parent), norm(child));
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + lib.sep) && !lib.isAbsolute(rel));
}

export function validateDirectoryOverlap(
  value: string,
  existing: { path: string }[],
  lib: typeof path = path,
  caseInsensitive = defaultCaseSensitive,
): string | undefined {
  const resolved = lib.resolve(value);
  for (const { path: e } of existing) {
    const re = lib.resolve(e);
    const same = caseInsensitive ? resolved.toLowerCase() === re.toLowerCase() : resolved === re;
    if (same) return "Directory already watched";
    if (isInside(re, resolved, lib, caseInsensitive) || isInside(resolved, re, lib, caseInsensitive)) return "Overlaps with already watched directory";
  }
}

export function validateExtensions(value: string): string | undefined {
  if (!value) return "Extensions are required";
  if (value.trim() === "*") return;
  const invalid = value.split(",").map(e => e.trim()).find(e => !/^\.[a-zA-Z0-9]+$/.test(e));
  if (invalid) return `Invalid extension "${invalid} - each must start with a period, e.g. .mcd`;
}

export function matchesExtensions(fileName: string, extensions: string[]): boolean {
  if (extensions.some(e => e.trim() === "*")) return true;
  const lower = fileName.toLowerCase();
  return extensions.some(e => lower.endsWith(e.trim().toLowerCase()));
}