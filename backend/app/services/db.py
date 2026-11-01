import asyncio
from collections.abc import Awaitable
from typing import Any, TypeVar

from supabase import AsyncClient, acreate_client

from app.config import get_settings

TIMEOUT_SECONDS = 10
SIGNED_URL_SECONDS = 60 * 60

SCAN_PHOTOS_BUCKET = "scan-photos"
DISH_PHOTOS_BUCKET = "dish-photos"

T = TypeVar("T")

_client: AsyncClient | None = None


class DatabaseError(Exception):
    """Supabase was unreachable or rejected a request."""


async def run(call: Awaitable[T]) -> T:
    try:
        return await asyncio.wait_for(call, timeout=TIMEOUT_SECONDS)
    except Exception as error:
        raise DatabaseError(type(error).__name__) from error


async def get_client() -> AsyncClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


async def fetch_ingredients() -> list[dict[str, Any]]:
    client = await get_client()
    response = await run(client.table("ingredients").select("*").execute())
    return response.data


async def fetch_chef_recipes() -> list[dict[str, Any]]:
    client = await get_client()
    response = await run(client.table("recipes").select("*").eq("source", "chef").execute())
    return response.data


async def fetch_profile(user_id: str) -> dict[str, Any] | None:
    client = await get_client()
    response = await run(client.table("profiles").select("*").eq("id", user_id).execute())
    return response.data[0] if response.data else None


async def save_profile(user_id: str, display_name: str | None, avoid: list[str]) -> None:
    client = await get_client()
    row = {"id": user_id, "display_name": display_name, "avoid_ingredients": avoid}
    await run(client.table("profiles").upsert(row).execute())


async def count_rows(table: str, user_id: str) -> int:
    client = await get_client()
    response = await run(
        client.table(table).select("id", count="exact", head=True).eq("user_id", user_id).execute()
    )
    return response.count or 0


async def upload_photo(bucket: str, path: str, data: bytes) -> None:
    client = await get_client()
    await run(client.storage.from_(bucket).upload(path, data, {"content-type": "image/jpeg"}))


async def public_photo_url(path: str) -> str:
    client = await get_client()
    return await run(client.storage.from_(DISH_PHOTOS_BUCKET).get_public_url(path))


async def signed_scan_photo_urls(paths: list[str]) -> dict[str, str]:
    if not paths:
        return {}
    client = await get_client()
    signed = await run(
        client.storage.from_(SCAN_PHOTOS_BUCKET).create_signed_urls(paths, SIGNED_URL_SECONDS)
    )
    return {item["path"]: item["signedURL"] for item in signed if item.get("signedURL")}


async def insert_scan(row: dict[str, Any]) -> None:
    client = await get_client()
    await run(client.table("scans").insert(row).execute())


async def update_scan_confirmed(scan_id: str, user_id: str, confirmed: list[str]) -> None:
    client = await get_client()
    await run(
        client.table("scans")
        .update({"confirmed_ingredients": confirmed})
        .eq("id", scan_id)
        .eq("user_id", user_id)
        .execute()
    )


async def scan_belongs_to_user(scan_id: str, user_id: str) -> bool:
    client = await get_client()
    response = await run(
        client.table("scans").select("id").eq("id", scan_id).eq("user_id", user_id).execute()
    )
    return bool(response.data)


async def find_recipe_id(source: str, external_id: str) -> str | None:
    client = await get_client()
    response = await run(
        client.table("recipes")
        .select("id")
        .eq("source", source)
        .eq("external_id", external_id)
        .execute()
    )
    return response.data[0]["id"] if response.data else None


async def save_recipe(row: dict[str, Any]) -> str | None:
    """Insert a recipe once and return its id. An existing recipe is never overwritten."""
    client = await get_client()
    await run(
        client.table("recipes")
        .upsert(row, on_conflict="source,external_id", ignore_duplicates=True)
        .execute()
    )
    return await find_recipe_id(row["source"], row["external_id"])


async def insert_cooked(row: dict[str, Any]) -> str:
    client = await get_client()
    response = await run(client.table("cooked").insert(row).execute())
    return response.data[0]["id"]


async def fetch_cooked_page(user_id: str, limit: int, cursor: str | None) -> list[dict[str, Any]]:
    client = await get_client()
    query = (
        client.table("cooked")
        .select("*, recipes(*), scans(photo_url, confirmed_ingredients)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if cursor:
        query = query.lt("created_at", cursor)
    response = await run(query.execute())
    return response.data
