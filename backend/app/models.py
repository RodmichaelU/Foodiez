from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class GeminiDetection(BaseModel):
    name: str
    canonical_name: str
    category: str
    confidence: float


class DetectionResult(BaseModel):
    ingredients: list[GeminiDetection]


class DetectedIngredient(GeminiDetection):
    low_confidence: bool


class ScanResponse(BaseModel):
    scan_id: str
    ingredients: list[DetectedIngredient]


class GeminiIngredientLine(BaseModel):
    name: str
    canonical_name: str
    amount: str
    unit: str


class GeminiRecipe(BaseModel):
    title: str
    description: str
    core_ingredients: list[str]
    optional_ingredients: list[str]
    ingredient_lines: list[GeminiIngredientLine]
    steps: list[str]
    prep_minutes: int


class GeneratedRecipes(BaseModel):
    recipes: list[GeminiRecipe]


class RecipesRequest(BaseModel):
    scan_id: UUID | None = None
    ingredients: list[str] = Field(min_length=1, max_length=40)
    use_staples: bool = True


class IngredientLine(GeminiIngredientLine):
    have: bool


class RecipeCandidate(BaseModel):
    """A recipe from any source with normalized ingredient names, before scoring."""

    source: Literal["chef", "online", "ai"]
    external_id: str | None = None
    title: str
    description: str
    core_ingredients: list[str]
    optional_ingredients: list[str]
    ingredient_lines: list[GeminiIngredientLine]
    steps: list[str]
    image_url: str | None = None
    prep_minutes: int | None = None


class Recipe(BaseModel):
    id: str
    source: Literal["chef", "online", "ai"]
    title: str
    description: str
    core_ingredients: list[str]
    optional_ingredients: list[str]
    ingredient_lines: list[IngredientLine]
    steps: list[str]
    image_url: str | None = None
    prep_minutes: int | None = None
    score: float
    have_count: int
    total_core: int
    missing: list[str]


class RecipesResponse(BaseModel):
    chef_picks: list[Recipe]
    online: list[Recipe]
    ai: list[Recipe]


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=50)
    avoid_ingredients: list[str] = Field(default_factory=list, max_length=50)


class ProfileResponse(BaseModel):
    display_name: str | None
    avoid_ingredients: list[str]
    cooked_count: int
    scan_count: int


class SavedIngredientLine(BaseModel):
    name: str
    amount: str = ""
    unit: str = ""


class SavedRecipe(BaseModel):
    id: str
    source: Literal["chef", "online", "ai"]
    title: str
    description: str | None = None
    ingredient_lines: list[SavedIngredientLine]
    steps: list[str]
    image_url: str | None = None
    prep_minutes: int | None = None


class CookedItem(BaseModel):
    id: str
    created_at: str
    caption: str | None
    is_public: bool
    photo_url: str | None
    ingredients_used: list[str]
    recipe: SavedRecipe | None


class CookedPage(BaseModel):
    items: list[CookedItem]
    next_cursor: str | None


class CookedCreated(BaseModel):
    id: str
