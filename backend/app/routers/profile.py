import asyncio

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.normalize import normalize, refresh_ingredients
from app.models import ProfileResponse, ProfileUpdate
from app.services import db

router = APIRouter()


async def _load(user_id: str) -> ProfileResponse:
    profile, cooked_count, scan_count = await asyncio.gather(
        db.fetch_profile(user_id),
        db.count_rows("cooked", user_id),
        db.count_rows("scans", user_id),
    )
    return ProfileResponse(
        display_name=profile.get("display_name") if profile else None,
        avoid_ingredients=(profile.get("avoid_ingredients") or []) if profile else [],
        cooked_count=cooked_count,
        scan_count=scan_count,
    )


@router.get("/profile")
async def get_profile(user_id: str = Depends(get_current_user)) -> ProfileResponse:
    return await _load(user_id)


@router.put("/profile")
async def update_profile(
    update: ProfileUpdate, user_id: str = Depends(get_current_user)
) -> ProfileResponse:
    await refresh_ingredients()
    avoid = list(dict.fromkeys(filter(None, map(normalize, update.avoid_ingredients))))
    display_name = (update.display_name or "").strip() or None
    await db.save_profile(user_id, display_name, avoid)
    return await _load(user_id)
