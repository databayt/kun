import { readFile } from "node:fs/promises";
import { DATA_TS_PATH } from "./config.js";

export async function loadSeenSourceUrls(): Promise<Set<string>> {
  const txt = await readFile(DATA_TS_PATH, "utf-8");
  const seen = new Set<string>();
  const re = /a\(\s*"[^"]+"\s*,\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    seen.add(m[1]!);
  }
  return seen;
}

export async function loadExistingKeys(): Promise<Set<string>> {
  const txt = await readFile(DATA_TS_PATH, "utf-8");
  const keys = new Set<string>();
  const re = /a\(\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    keys.add(m[1]!);
  }
  return keys;
}
