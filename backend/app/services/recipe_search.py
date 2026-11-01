import asyncio
import logging
from collections.abc import Awaitable, Collection
from uuid import uuid4

from app.core import normalize as normalization
from app.core.cache import TTLCache
from app.core.merge import merge_recipes
from app.core.normalize import normalize
from app.core.scoring import contains_avoided, is_excluded, owned_ingredients, score_recipe
from app.models import IngredientLine, Recipe, RecipeCandidate, RecipesResponse
from app.services import chef_picks, gemini, mealdb, spoonacular

logger = logging.getLogger(__name__)

SOURCE_TIMEOUT_SECONDS = 15
ONLINE_CACHE_TTL_SECONDS = 24 * 60 * 60
MIN_ONLINE_RESULTS = 3
GOOD_MATCH_SCORE = 0.6
MIN_GOOD_MATCHES = 3

online_cache: TTLCache[tuple[str, ...], list[RecipeCandidate]] = TTLCache(ONLINE_CACHE_TTL_SECONDS)


async def _safely(source: str, call: Awaitable[list[RecipeCandidate]]) -> list[RecipeCandidate]:
    """One source failing must not take down the others."""
    try:
        return await asyncio.wait_for(call, timeout=SOURCE_TIMEOUT_SECONDS)
    except Exception as error:
        logger.warning("%s failed: %s", source, type(error).__name__)
        return []


async def _fetch_online(ingredients: list[str], staples: Collection[str]) -> list[RecipeCandidate]:
    key = tuple(sorted(ingredients))
    cached = online_cache.get(key)
    if cached is not None:
        return cached

    results = await _safely("Spoonacular", spoonacular.find_by_ingredients(ingredients))
    if len(results) < MIN_ONLINE_RESULTS:
        top_ingredient = next((name for name in ingredients if name not in staples), ingredients[0])
        results += await _safely("TheMealDB", mealdb.find_by_ingredient(top_ingredient))

    # Empty results may mean an outage, so they are worth retrying next time.
    if results:
        online_cache.set(key, results)
    return results


def _ai_candidates(generated: list[gemini.GeminiRecipe]) -> list[RecipeCandidate]:
    return [
        RecipeCandidate(
            **recipe.model_dump(
                exclude={"core_ingredients", "optional_ingredients", "ingredient_lines"}
            ),
            source="ai",
            core_ingredients=[normalize(name) for name in recipe.core_ingredients],
            optional_ingredients=[normalize(name) for name in recipe.optional_ingredients],
            ingredient_lines=[
                line.model_copy(update={"canonical_name": normalize(line.canonical_name)})
                for line in recipe.ingredient_lines
            ],
        )
        for recipe in generated
    ]


def _score(
    candidates: list[RecipeCandidate], owned: set[str], avoid: Collection[str]
) -> list[Recipe]:
    recipes: list[Recipe] = []
    for candidate in candidates:
        result = score_recipe(candidate.core_ingredients, candidate.optional_ingredients, owned)
        names = [
            *candidate.core_ingredients,
            *candidate.optional_ingredients,
            *(line.canonical_name for line in candidate.ingredient_lines),
        ]
        if is_excluded(names, result.missing, avoid):
            continue
        fields = candidate.model_dump(exclude={"external_id", "ingredient_lines"})
        recipe_id = (
            f"{candidate.source}-{candidate.external_id}" if candidate.external_id else str(uuid4())
        )
        recipes.append(
            Recipe(
                **fields,
                id=recipe_id,
                ingredient_lines=[
                    IngredientLine(**line.model_dump(), have=line.canonical_name in owned)
                    for line in candidate.ingredient_lines
                ],
                score=result.score,
                have_count=result.have_count,
                total_core=result.total_core,
                missing=result.missing,
            )
        )
    return recipes


async def search_recipes(
    raw_ingredients: list[str], use_staples: bool, avoid: Collection[str] = ()
) -> RecipesResponse:
    await normalization.refresh_ingredients()
    ingredients = list(dict.fromkeys(filter(None, map(normalize, raw_ingredients))))
    staples = normalization.staples()
    owned = owned_ingredients(ingredients, staples, use_staples)

    chef, online = await asyncio.gather(
        _safely("Chef's Picks", chef_picks.fetch_chef_picks()),
        _fetch_online(ingredients, staples),
    )
    recipes = _score([*chef, *online], owned, avoid)

    good_matches = sum(recipe.score > GOOD_MATCH_SCORE for recipe in recipes)
    if good_matches < MIN_GOOD_MATCHES:
        try:
            generated = await gemini.generate_recipes(
                [name for name in ingredients if not contains_avoided([name], avoid)],
                sorted(staples) if use_staples else [],
                sorted(avoid),
            )
            recipes += _score(_ai_candidates(generated), owned, avoid)
        except gemini.GeminiError as error:
            # Only worth surfacing when there is nothing else to show.
            if not recipes:
                raise
            logger.warning("AI recipes failed: %s", error.message)

    return merge_recipes(recipes)
