// Where the seek loop lives and where its data lives — the one place that
// knows. Every script reads and writes through these instead of hardcoding a
// home directory, so the same loop runs from any clone.
//
//   REPO     the checkout (SEEK_REPO overrides)
//   SCRIPTS  this script folder
//   DATA     the private data folder: SEEK_HOME, else <repo>/seek, else the
//            original <repo>/jobs. Relative to the repo when the loop runs from
//            it (as loop.sh does), so every path it records keeps its old shape.
//   DATA_ABS DATA as an absolute path, for prompts handed to `claude -p`.

import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const SCRIPTS = resolve(here, "..");
export const REPO = process.env.SEEK_REPO ? resolve(process.env.SEEK_REPO) : resolve(here, "../../..");

export const DATA_ABS = process.env.SEEK_HOME
  ? resolve(process.env.SEEK_HOME)
  : existsSync(join(REPO, "seek", "profile.json"))
    ? join(REPO, "seek")
    : join(REPO, "jobs");

const rel = relative(process.cwd(), DATA_ABS);
export const DATA = rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : DATA_ABS;
