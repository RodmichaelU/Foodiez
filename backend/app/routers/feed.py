from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.models import FeedItem, FeedPage
from app.routers.cooked import to_item
from app.services import db

PAGE_SIZE = 20
DEFAULT_AUTHOR = "Foodiez cook"

router = APIRouter()


@router.get("/feed")
async def feed(cursor: str | None = None, _: str = Depends(get_current_user)) -> FeedPage:
    # One extra row reveals whether another page exists.
    rows = await db.fetch_feed_page(PAGE_SIZE + 1, cursor)
    page = rows[:PAGE_SIZE]
    names = await db.fetch_display_names(list({row["user_id"] for row in page}))

    # No signed urls here: scan photos are private, so a public post only shows its dish photo.
    items = [
        FeedItem(
            **to_item(row, {}).model_dump(),
            author_name=names.get(row["user_id"], DEFAULT_AUTHOR),
        )
        for row in page
    ]
    return FeedPage(items=items, next_cursor=page[-1]["created_at"] if len(rows) > PAGE_SIZE else None)
