export type HealthResponse = {
  status: string;
};

export type DetectedIngredient = {
  name: string;
  canonical_name: string;
  category: string;
  confidence: number;
  low_confidence: boolean;
};

export type ScanResponse = {
  scan_id: string;
  ingredients: DetectedIngredient[];
};

export type IngredientLine = {
  name: string;
  canonical_name: string;
  amount: string;
  unit: string;
  have: boolean;
};

export type Recipe = {
  id: string;
  source: 'chef' | 'online' | 'ai';
  title: string;
  description: string;
  core_ingredients: string[];
  optional_ingredients: string[];
  ingredient_lines: IngredientLine[];
  steps: string[];
  image_url: string | null;
  prep_minutes: number | null;
  score: number;
  have_count: number;
  total_core: number;
  missing: string[];
  match_known: boolean;
  source_name: string | null;
  source_url: string | null;
  signature: string;
};

export type RecipesResponse = {
  chef_picks: Recipe[];
  online: Recipe[];
  ai: Recipe[];
};

export type Profile = {
  display_name: string | null;
  avoid_ingredients: string[];
  cooked_count: number;
  scan_count: number;
};

export type SavedRecipe = {
  id: string;
  source: Recipe['source'];
  external_id: string | null;
  source_name: string | null;
  source_url: string | null;
  title: string;
  description: string | null;
  ingredient_lines: { name: string; amount: string; unit: string }[];
  steps: string[];
  image_url: string | null;
  prep_minutes: number | null;
};

export type CookedItem = {
  id: string;
  created_at: string;
  caption: string | null;
  is_public: boolean;
  photo_url: string | null;
  ingredients_used: string[];
  recipe: SavedRecipe | null;
};

export type CookedPage = {
  items: CookedItem[];
  next_cursor: string | null;
};

export type FeedItem = CookedItem & {
  author_name: string;
};

export type FeedPage = {
  items: FeedItem[];
  next_cursor: string | null;
};
