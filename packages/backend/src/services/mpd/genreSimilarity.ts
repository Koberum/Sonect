import { genresDb } from "@repo/db";

export function normalizeGenre(name: string): string {
  return name.trim().toLowerCase();
}

// Curated similarity clusters for common MPD Genre tags.
// Keys are normalized genre names, values are similar genres in priority order.
// Covers electronic, rock, pop, hip-hop, jazz, classical, metal etc.
// Additions should keep priority: most similar first.
export const CURATED_SIMILAR: Record<string, string[]> = {
  techno: [
    "tech house",
    "minimal techno",
    "minimal",
    "detroit techno",
    "acid techno",
    "acid",
    "house",
    "deep house",
    "progressive house",
    "electronic",
    "electronica",
    "trance",
    "dub techno",
    "melodic techno",
  ],
  "tech house": [
    "house",
    "techno",
    "deep house",
    "minimal",
    "progressive house",
    "electronic",
    "electronica",
  ],
  house: [
    "tech house",
    "deep house",
    "progressive house",
    "disco",
    "techno",
    "electronic",
    "electronica",
    "minimal",
  ],
  "deep house": [
    "house",
    "tech house",
    "disco",
    "minimal",
    "techno",
    "electronic",
  ],
  "minimal techno": [
    "techno",
    "minimal",
    "tech house",
    "detroit techno",
    "house",
  ],
  minimal: ["minimal techno", "techno", "tech house", "house", "electronic"],
  electronic: ["electronica", "techno", "house", "trance", "idm", "ambient"],
  electronica: ["electronic", "techno", "house", "trance", "ambient"],
  trance: ["progressive trance", "electronic", "techno", "house", "psytrance"],
  disco: ["house", "deep house", "funk", "soul"],
  rock: ["hard rock", "alternative rock", "indie rock", "classic rock", "punk"],
  "hard rock": ["rock", "metal", "alternative rock"],
  pop: ["dance pop", "indie pop", "electropop", "synth-pop"],
  "hip hop": ["rap", "trap", "r&b"],
  rap: ["hip hop", "trap"],
  jazz: ["smooth jazz", "fusion", "bebop"],
  classical: ["orchestral", "neoclassical"],
  metal: ["heavy metal", "hard rock", "death metal", "black metal"],
  ambient: ["downtempo", "chillout", "electronic", "electronica"],
  drum: ["drum & bass", "jungle"],
  "drum & bass": ["jungle", "drum", "electronic"],
};

export function getCuratedSimilar(seedGenre: string): string[] {
  const key = normalizeGenre(seedGenre);
  return CURATED_SIMILAR[key] ?? [];
}

/**
 * Fallback for arbitrary MPD tags not in CURATED_SIMILAR.
 * Uses substring / token matching via genres table.
 * Returns genre names that contain any token from seed or vice versa.
 */
export function getTokenSimilarGenres(seedGenre: string): string[] {
  const normalized = normalizeGenre(seedGenre);
  if (!normalized) return [];
  const seedTokens = normalized
    .split(/[\s/;,|&-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  if (seedTokens.length === 0) return [];

  const all = genresDb.getAll();
  const seed = normalized;
  const result: string[] = [];
  for (const g of all) {
    const name = normalizeGenre(g.name);
    if (name === seed) continue;
    const genreTokens = name
      .split(/[\s/;,|&-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
    // token overlap: any seed token substring-contains genre token or vice versa
    const match =
      name.includes(seed) ||
      seed.includes(name) ||
      seedTokens.some((st) =>
        genreTokens.some((gt) => st.includes(gt) || gt.includes(st)),
      ) ||
      seedTokens.some((tok) => name.includes(tok)) ||
      genreTokens.some((tok) => seed.includes(tok));
    if (match && !result.includes(g.name)) {
      result.push(g.name);
    }
  }
  return result;
}

export function getSimilarGenres(seedGenre: string): string[] {
  const curated = getCuratedSimilar(seedGenre);
  if (curated.length > 0) return curated;
  return getTokenSimilarGenres(seedGenre);
}
