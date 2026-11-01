import type { CookedItem, Recipe, RecipesResponse, ScanResponse } from '@/src/types';

// The latest scan, kept in memory so people can leave and come back without scanning again.
export type DraftItem = {
  name: string;
  canonicalName: string;
  checked: boolean;
};

export type Draft = {
  scanId: string | null;
  items: DraftItem[];
  useStaples: boolean;
};

let draft: Draft | null = null;
let results: RecipesResponse | null = null;
let resultsKey: string | null = null;
let cookedById = new Map<string, CookedItem>();

function buildKey(ingredients: string[], useStaples: boolean): string {
  return JSON.stringify([[...ingredients].sort(), useStaples]);
}

export function setScan(scan: ScanResponse): void {
  draft = {
    scanId: scan.scan_id,
    items: scan.ingredients.map((ingredient) => ({
      name: ingredient.name,
      canonicalName: ingredient.canonical_name,
      checked: !ingredient.low_confidence,
    })),
    useStaples: true,
  };
  clearResults();
}

export function getDraft(): Draft | null {
  return draft;
}

export function updateDraft(items: DraftItem[], useStaples: boolean): void {
  draft = { scanId: draft?.scanId ?? null, items, useStaples };
}

export function setResults(
  next: RecipesResponse,
  ingredients: string[],
  useStaples: boolean,
): void {
  results = next;
  resultsKey = buildKey(ingredients, useStaples);
}

export function hasResultsFor(ingredients: string[], useStaples: boolean): boolean {
  return results !== null && resultsKey === buildKey(ingredients, useStaples);
}

// Results depend on the user's "Never include" list, so changing it must clear them.
export function clearResults(): void {
  results = null;
  resultsKey = null;
}

export function getResultSections(): { title: string; data: Recipe[] }[] {
  if (!results) return [];
  return [
    { title: "Chef's Picks", data: results.chef_picks },
    { title: 'From the web', data: results.online },
    { title: 'AI ideas', data: results.ai },
  ].filter((section) => section.data.length > 0);
}

export function getRecipe(id: string): Recipe | undefined {
  return getResultSections()
    .flatMap((section) => section.data)
    .find((recipe) => recipe.id === id);
}

export function rememberCooked(items: CookedItem[]): void {
  items.forEach((item) => cookedById.set(item.id, item));
}

export function getCooked(id: string): CookedItem | undefined {
  return cookedById.get(id);
}

export function clearSession(): void {
  draft = null;
  clearResults();
  cookedById = new Map();
}
