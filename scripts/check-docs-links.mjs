#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = "content/docs"

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, files)
    else if (p.endsWith(".mdx")) files.push(p)
  }
  return files
}

const files = walk(ROOT)

// Build the set of valid /docs/* slugs from disk
const slugs = new Set(["/docs"])
for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, "/")
  const slug = "/docs/" + rel.replace(/\/index\.mdx$/, "").replace(/\.mdx$/, "")
  // Root index.mdx → /docs (already added)
  if (slug === "/docs/index") {
    continue
  }
  slugs.add(slug)
}

// Scan each file for markdown links to /docs/*
const LINK_RE = /\]\((\/docs\/[^)\s#]*)/g
let broken = 0
for (const f of files) {
  const content = readFileSync(f, "utf8")
  for (const m of content.matchAll(LINK_RE)) {
    const target = m[1].replace(/\/$/, "")
    if (!slugs.has(target)) {
      console.log(`BROKEN ${f}: ${target}`)
      broken++
    }
  }
}

if (broken > 0) {
  console.error(`\n${broken} broken docs link${broken === 1 ? "" : "s"}.`)
  process.exit(1)
}
console.log(`OK: ${files.length} files, ${slugs.size} slugs, 0 broken links.`)
