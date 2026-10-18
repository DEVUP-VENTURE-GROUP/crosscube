import type { CatalogItem } from "./catalog.types";

export interface SearchIndexEntry {
  item: CatalogItem;
  nameLower: string;
  nameWords: string[];
  otherWords: string[];
  skuLower: string;
}

const WORD_SPLIT = /[^a-z0-9]+/;

function words(text: string): string[] {
  return text.toLowerCase().split(WORD_SPLIT).filter(Boolean);
}

export function buildSearchIndex(items: readonly CatalogItem[]): SearchIndexEntry[] {
  return items.map((item) => ({
    item,
    nameLower: item.name.toLowerCase(),
    nameWords: words(item.name),
    otherWords: [
      ...words(item.invoiceDescription),
      ...words(item.category),
      ...item.keywords.flatMap(words),
      ...words(item.sku ?? ""),
    ],
    skuLower: (item.sku ?? "").toLowerCase(),
  }));
}

function scoreEntry(entry: SearchIndexEntry, query: string, tokens: string[]): number {
  let score = 0;
  for (const token of tokens) {
    if (entry.nameWords.some((word) => word.startsWith(token))) score += 10;
    else if (entry.otherWords.some((word) => word.startsWith(token))) score += 3;
    else return 0;
  }
  if (entry.nameLower.startsWith(query)) score += 20;
  else if (entry.nameLower.includes(query)) score += 8;
  if (entry.skuLower && entry.skuLower === query) score += 50;
  return score;
}

// Every token must prefix-match a word of the item; O(items × words) per query, fine for shop-sized catalogs.
export function searchCatalog(
  index: readonly SearchIndexEntry[],
  rawQuery: string,
  options: { limit?: number; includeInactive?: boolean } = {},
): CatalogItem[] {
  const query = rawQuery.trim().toLowerCase();
  const tokens = words(query);
  if (tokens.length === 0) return [];
  return index
    .filter((entry) => options.includeInactive || entry.item.active)
    .map((entry) => ({ entry, score: scoreEntry(entry, query, tokens) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.item.name.localeCompare(b.entry.item.name))
    .slice(0, options.limit ?? 12)
    .map((result) => result.entry.item);
}
