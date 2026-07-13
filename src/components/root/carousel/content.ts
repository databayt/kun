import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { deckSchema, type Deck } from "./schema";

const CAROUSELS_DIR = path.join(process.cwd(), "content", "carousels");
const SAFE_SEGMENT = /^[a-z0-9-]+$/;

/**
 * Read and validate a deck. Throws loudly on a missing file or an invalid
 * deck — the render route surfacing that error is the deep-validation
 * backstop behind the CLI's --validate flag.
 */
export async function readDeck(brand: string, slug: string): Promise<Deck> {
  if (!SAFE_SEGMENT.test(brand) || !SAFE_SEGMENT.test(slug)) {
    throw new Error(`carousel: invalid deck path "${brand}/${slug}"`);
  }
  const file = path.join(CAROUSELS_DIR, brand, `${slug}.json`);
  const raw = await fs.readFile(file, "utf8");
  return deckSchema.parse(JSON.parse(raw));
}

export async function listDecks(): Promise<{ brand: string; slug: string }[]> {
  const decks: { brand: string; slug: string }[] = [];
  let brands: string[];
  try {
    brands = await fs.readdir(CAROUSELS_DIR);
  } catch {
    return decks;
  }
  for (const brand of brands) {
    const dir = path.join(CAROUSELS_DIR, brand);
    if (!(await fs.stat(dir)).isDirectory()) continue;
    for (const entry of await fs.readdir(dir)) {
      if (entry.endsWith(".json")) {
        decks.push({ brand, slug: entry.replace(/\.json$/, "") });
      }
    }
  }
  return decks;
}
