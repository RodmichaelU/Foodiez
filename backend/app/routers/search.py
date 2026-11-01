from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.core.normalize import clean_name
from app.core.rate_limit import search_limiter
from app.models import RecipesResponse
from app.routers.recipes import load_avoid
from app.services import recipe_search

MAX_INGREDIENTS = 40

router = APIRouter()


@router.get("/search")
async def search(
    q: str = Query(max_length=200),
    mode: Literal["name", "ingredient"] = "name",
    ai: bool = False,
    user_id: str = Depends(get_current_user),
) -> RecipesResponse:
    query = q.strip()
    ingredients = [name for name in query.split(",") if clean_name(name)]
    if not query or (mode == "ingredient" and not ingredients):
        raise HTTPException(400, "Please type something to search for.")
    if len(ingredients) > MAX_INGREDIENTS:
        raise HTTPException(400, f"Please search for at most {MAX_INGREDIENTS} ingredients.")

    limit_message = search_limiter.check(user_id)
    if limit_message:
        raise HTTPException(429, limit_message)

    avoid = await load_avoid(user_id)
    if mode == "name":
        return await recipe_search.search_by_name(query, avoid, use_ai=ai)
    return await recipe_search.search_recipes(ingredients, True, avoid)
