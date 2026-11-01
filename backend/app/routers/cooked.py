from typing import Any
from urllib.parse import urlparse
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError

from app.core.auth import get_current_user
from app.models import CookedCreated, CookedItem, CookedPage, Recipe, SavedRecipe
from app.routers.scan import read_jpeg
from app.services import db

MAX_RECIPE_JSON_CHARS = 100_000
MAX_CAPTION_CHARS = 300
PAGE_SIZE = 30
ALLOWED_IMAGE_HOSTS = {"img.spoonacular.com", "www.themealdb.com"}

router = APIRouter()


def _parse_recipe(recipe_json: str) -> Recipe:
    if len(recipe_json) > MAX_RECIPE_JSON_CHARS:
        raise HTTPException(413, "That recipe is too large to save.")
    try:
        recipe = Recipe.model_validate_json(recipe_json)
    except ValidationError as error:
        raise HTTPException(400, "That recipe could not be saved.") from error

    # The recipe comes from the client, and saved recipes are visible to other users.
    if recipe.image_url and urlparse(recipe.image_url).hostname not in ALLOWED_IMAGE_HOSTS:
        raise HTTPException(400, "That recipe could not be saved.")
    return recipe


async def _save_recipe(recipe: Recipe) -> str:
    external_id = recipe.id.removeprefix(f"{recipe.source}-")
    if recipe.source == "chef":
        # Chef's Picks are owned by the app: look them up, never write them from a request.
        recipe_id = await db.find_recipe_id("chef", external_id)
        if recipe_id is None:
            raise HTTPException(404, "That recipe no longer exists.")
        return recipe_id

    recipe_id = await db.save_recipe(
        {
            "source": recipe.source,
            "external_id": external_id,
            "title": recipe.title,
            "description": recipe.description,
            "core_ingredients": recipe.core_ingredients,
            "optional_ingredients": recipe.optional_ingredients,
            "ingredient_lines": [
                line.model_dump(include={"name", "amount", "unit"})
                for line in recipe.ingredient_lines
            ],
            "steps": recipe.steps,
            "image_url": recipe.image_url,
            "prep_minutes": recipe.prep_minutes,
        }
    )
    if recipe_id is None:
        raise db.DatabaseError("Recipe was not saved")
    return recipe_id


@router.post("/cooked")
async def create_cooked(
    recipe: str = Form(...),
    scan_id: UUID | None = Form(default=None),
    caption: str = Form(default="", max_length=MAX_CAPTION_CHARS),
    is_public: bool = Form(default=True),
    photo: UploadFile | None = File(default=None),
    user_id: str = Depends(get_current_user),
) -> CookedCreated:
    parsed = _parse_recipe(recipe)
    photo_bytes = await read_jpeg(photo) if photo else None

    recipe_id = await _save_recipe(parsed)
    owned_scan = (
        str(scan_id) if scan_id and await db.scan_belongs_to_user(str(scan_id), user_id) else None
    )

    dish_photo_url = None
    if photo_bytes:
        path = f"{user_id}/{uuid4()}.jpg"
        await db.upload_photo(db.DISH_PHOTOS_BUCKET, path, photo_bytes)
        dish_photo_url = await db.public_photo_url(path)

    cooked_id = await db.insert_cooked(
        {
            "user_id": user_id,
            "scan_id": owned_scan,
            "recipe_id": recipe_id,
            "dish_photo_url": dish_photo_url,
            "caption": caption.strip() or None,
            "is_public": is_public,
        }
    )
    return CookedCreated(id=cooked_id)


def _to_item(row: dict[str, Any], signed_urls: dict[str, str]) -> CookedItem:
    recipe = row.get("recipes")
    scan = row.get("scans") or {}
    return CookedItem(
        id=row["id"],
        created_at=row["created_at"],
        caption=row.get("caption"),
        is_public=row["is_public"],
        photo_url=row.get("dish_photo_url") or signed_urls.get(scan.get("photo_url") or ""),
        ingredients_used=scan.get("confirmed_ingredients")
        or (recipe.get("core_ingredients") if recipe else [])
        or [],
        recipe=SavedRecipe(**recipe) if recipe else None,
    )


@router.get("/cooked")
async def list_cooked(
    cursor: str | None = None, user_id: str = Depends(get_current_user)
) -> CookedPage:
    # One extra row reveals whether another page exists.
    rows = await db.fetch_cooked_page(user_id, PAGE_SIZE + 1, cursor)
    page = rows[:PAGE_SIZE]

    scan_photos = [
        row["scans"]["photo_url"]
        for row in page
        if not row.get("dish_photo_url") and (row.get("scans") or {}).get("photo_url")
    ]
    signed_urls = await db.signed_scan_photo_urls(scan_photos)

    return CookedPage(
        items=[_to_item(row, signed_urls) for row in page],
        next_cursor=page[-1]["created_at"] if len(rows) > PAGE_SIZE else None,
    )
