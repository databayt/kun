import "server-only";
import { BRANDS } from "./brands";
import { deckSchema, type Deck } from "./schema";
import { CAROUSEL_DECKS } from "@/generated/kun-bundle";

const SAFE_SEGMENT = /^[a-z0-9-]+$/;

/**
 * Decks live with their product: `BRANDS[brand].deckDir/<slug>.json` (e.g.
 * ~/hogwarts/carousels/) — a path on the Mac, so only readable where there is a
 * filesystem (local dev, the render CLI). Brands without a repo use kun's own
 * content/carousels/<brand>/<slug>.json, which scripts/gen-bundle.mjs bundles at
 * build time (src/generated/kun-bundle.ts) so it also works on Workers.
 */
function deckDirOf(brand: string): string | undefined {
  return (BRANDS as Record<string, { deckDir?: string }>)[brand]?.deckDir;
}

// Brand-repo deckDirs are local-only by design: on Workers (CF_WORKERS) there is no disk.
const hasDisk = () => !process.env.CF_WORKERS;

/**
 * Read and validate a deck. Throws loudly on a missing file or an invalid
 * deck — the render route surfacing that error is the deep-validation
 * backstop behind the CLI's --validate flag.
 */
export async function readDeck(brand: string, slug: string): Promise<Deck> {
  if (!SAFE_SEGMENT.test(brand) || !SAFE_SEGMENT.test(slug)) {
    throw new Error(`carousel: invalid deck path "${brand}/${slug}"`);
  }
  const dir = deckDirOf(brand);
  let raw: string | undefined;
  if (dir && hasDisk()) {
    const [{ promises: fs }, path] = await Promise.all([import("fs"), import("path")]);
    raw = await fs.readFile(path.join(dir, `${slug}.json`), "utf8");
  } else if (!dir) {
    // Local dev reads the live file (edit a deck, refresh); Workers use the bundled copy.
    if (hasDisk()) {
      try {
        const [{ promises: fs }, path] = await Promise.all([import("fs"), import("path")]);
        raw = await fs.readFile(path.join(process.cwd(), "content", "carousels", brand, `${slug}.json`), "utf8");
      } catch {
        /* fall through to the bundled copy */
      }
    }
    raw ??= CAROUSEL_DECKS[`${brand}/${slug}`];
  }
  if (raw === undefined) {
    throw new Error(`carousel: deck "${brand}/${slug}" is not available in this runtime`);
  }
  return deckSchema.parse(JSON.parse(raw));
}

export async function listDecks(): Promise<{ brand: string; slug: string }[]> {
  const decks: { brand: string; slug: string }[] = [];
  for (const [brand, info] of Object.entries(BRANDS)) {
    if (info.deckDir) {
      if (!hasDisk()) continue;
      const { promises: fs } = await import("fs");
      let entries: string[];
      try {
        entries = await fs.readdir(info.deckDir);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.endsWith(".json")) decks.push({ brand, slug: entry.replace(/\.json$/, "") });
      }
    } else {
      const prefix = `${brand}/`;
      for (const key of Object.keys(CAROUSEL_DECKS)) {
        if (key.startsWith(prefix)) decks.push({ brand, slug: key.slice(prefix.length) });
      }
    }
  }
  return decks;
}
