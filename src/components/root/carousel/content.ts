import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { BRANDS } from "./brands";
import { deckSchema, type Deck } from "./schema";

const FALLBACK_DIR = path.join(process.cwd(), "content", "carousels");
const SAFE_SEGMENT = /^[a-z0-9-]+$/;

/**
 * Decks live with their product: `BRANDS[brand].deckDir/<slug>.json` (e.g.
 * ~/hogwarts/carousels/). Brands without a repo fall back to kun's
 * content/carousels/<brand>/<slug>.json.
 */
function deckPath(brand: string, slug: string): string {
  const dir = (BRANDS as Record<string, { deckDir?: string }>)[brand]?.deckDir;
  return dir
    ? path.join(dir, `${slug}.json`)
    : path.join(FALLBACK_DIR, brand, `${slug}.json`);
}

/**
 * Read and validate a deck. Throws loudly on a missing file or an invalid
 * deck — the render route surfacing that error is the deep-validation
 * backstop behind the CLI's --validate flag.
 */
export async function readDeck(brand: string, slug: string): Promise<Deck> {
  if (!SAFE_SEGMENT.test(brand) || !SAFE_SEGMENT.test(slug)) {
    throw new Error(`carousel: invalid deck path "${brand}/${slug}"`);
  }
  const raw = await fs.readFile(deckPath(brand, slug), "utf8");
  return deckSchema.parse(JSON.parse(raw));
}

export async function listDecks(): Promise<{ brand: string; slug: string }[]> {
  const decks: { brand: string; slug: string }[] = [];
  for (const [brand, info] of Object.entries(BRANDS)) {
    const dir = info.deckDir ?? path.join(FALLBACK_DIR, brand);
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.endsWith(".json")) {
        decks.push({ brand, slug: entry.replace(/\.json$/, "") });
      }
    }
  }
  return decks;
}
