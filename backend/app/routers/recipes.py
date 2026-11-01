import logging

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.normalize import clean_name, normalize
from app.core.cache import TTLCache
from app.models import RecipesRequest, RecipesResponse, SavedIngredientLine, SavedRecipe
from app.routers.scan import save_confirmed_ingredients
from app.services import db, spoonacular
from app.services.recipe_search import ONLINE_CACHE_TTL_SECONDS, search_recipes

logger = logging.getLogger(__name__)

router = APIRouter()

online_recipe_cache: TTLCache[str, SavedRecipe] = TTLCache(ONLINE_CACHE_TTL_SECONDS)


async def load_avoid(user_id: str) -> list[str]:
    """Not caught on purpose: never show recipes if the user's allergies could not be loaded."""
    profile = await db.fetch_profile(user_id)
    return (profile.get("avoid_ingredients") or []) if profile else []


@router.get("/online-recipes/{external_id}")
async def online_recipe(external_id: str, _: str = Depends(get_current_user)) -> SavedRecipe:
    """Full details of a saved Spoonacular recipe, which may only be stored as id, title and image."""
    if not external_id.isdecimal():
        raise HTTPException(404, "That recipe no longer exists.")

    cached = online_recipe_cache.get(external_id)
    if cached is not None:
        return cached

    try:
        candidate = await spoonacular.get_recipe(external_id)
    except httpx.HTTPError as error:
        logger.warning("Spoonacular details failed: %s", type(error).__name__)
        raise HTTPException(503, "We could not load the full recipe right now.") from error

    recipe = SavedRecipe(
        **candidate.model_dump(exclude={"ingredient_lines"}),
        id=external_id,
        ingredient_lines=[
            SavedIngredientLine(name=line.name, amount=line.amount, unit=line.unit)
            for line in candidate.ingredient_lines
        ],
    )
    online_recipe_cache.set(external_id, recipe)
    return recipe


@router.post("/recipes")
async def recipes(
    request: RecipesRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
) -> RecipesResponse:
    if not any(map(clean_name, request.ingredients)):
        raise HTTPException(400, "Please add at least one ingredient.")

    avoid = await load_avoid(user_id)

    if request.scan_id:
        background_tasks.add_task(
            save_confirmed_ingredients,
            str(request.scan_id),
            user_id,
            list(dict.fromkeys(map(normalize, request.ingredients))),
        )
    return await search_recipes(request.ingredients, request.use_staples, avoid)
