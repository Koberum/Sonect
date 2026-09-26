import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readAppVersion(cwd: string = process.cwd()): string {
  try {
    const value = readFileSync(join(cwd, ".version"), "utf-8").trim();
    return value || "dev";
  } catch {
    return "dev";
  }
}
