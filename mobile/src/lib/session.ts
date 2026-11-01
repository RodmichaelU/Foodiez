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
let searchedById = new Map<string, Recipe>();

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

export function toSections(response: RecipesResponse): { title: string; data: Recipe[] }[] {
  return [
    { title: "Chef's Picks", data: response.chef_picks },
    { title: 'From the web', data: response.online },
    { title: 'AI ideas', data: response.ai },
  ].filter((section) => section.data.length > 0);
}

export function getResultSections(): { title: string; data: Recipe[] }[] {
  return results ? toSections(results) : [];
}

function getScanRecipe(id: string): Recipe | undefined {
  return getResultSections()
    .flatMap((section) => section.data)
    .find((recipe) => recipe.id === id);
}

export function rememberSearched(response: RecipesResponse): void {
  toSections(response)
    .flatMap((section) => section.data)
    .forEach((recipe) => searchedById.set(recipe.id, recipe));
}

export function getRecipe(id: string): Recipe | undefined {
  return getScanRecipe(id) ?? searchedById.get(id);
}

// A dish cooked from a search result did not come from the current scan.
export function getScanIdForRecipe(id: string): string | null {
  return getScanRecipe(id) ? (draft?.scanId ?? null) : null;
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
  searchedById = new Map();
}
