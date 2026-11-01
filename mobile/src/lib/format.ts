// 'chicken_breast' -> 'Chicken breast'
export function formatIngredient(canonicalName: string): string {
  const words = canonicalName.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// 'Olive Oil' -> 'olive_oil', matching the backend's clean_name.
export function toCanonicalName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
