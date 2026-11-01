from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.normalize import clean_name, normalize
from app.models import RecipesRequest, RecipesResponse
from app.routers.scan import save_confirmed_ingredients
from app.services import db
from app.services.recipe_search import search_recipes

router = APIRouter()


async def load_avoid(user_id: str) -> list[str]:
    """Not caught on purpose: never show recipes if the user's allergies could not be loaded."""
    profile = await db.fetch_profile(user_id)
    return (profile.get("avoid_ingredients") or []) if profile else []


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
