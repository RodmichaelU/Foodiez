from collections.abc import Iterator
from typing import Any

import pytest

from app.core import normalize
from app.core.auth import get_current_user, token_cache
from app.core.rate_limit import scan_limiter, search_limiter
from app.main import app
from app.services import db
from app.services.recipe_search import dish_cache, name_cache, online_cache

USER_ID = "11111111-1111-1111-1111-111111111111"


class FakeDb:
    def __init__(self) -> None:
        self.profile: dict[str, Any] | None = None
        self.scans: list[dict[str, Any]] = []
        self.uploads: list[tuple[str, str]] = []
        self.saved_recipes: list[dict[str, Any]] = []
        self.cooked: list[dict[str, Any]] = []
        self.confirmed: list[tuple[str, str, list[str]]] = []
        self.chef_ids: dict[str, str] = {}
        self.owned_scans: set[str] = set()
        self.page: list[dict[str, Any]] = []
        self.feed: list[dict[str, Any]] = []
        self.names: dict[str, str] = {}

    async def search_chef_recipes(self, _: str) -> list[dict[str, Any]]:
        return []

    async def fetch_profile(self, _: str) -> dict[str, Any] | None:
        return self.profile

    async def save_profile(self, _: str, display_name: str | None, avoid: list[str]) -> None:
        self.profile = {"display_name": display_name, "avoid_ingredients": avoid}

    async def count_rows(self, _: str, __: str) -> int:
        return 0

    async def upload_photo(self, bucket: str, path: str, _: bytes) -> None:
        self.uploads.append((bucket, path))

    async def public_photo_url(self, path: str) -> str:
        return f"https://public/{path}"

    async def signed_scan_photo_urls(self, paths: list[str]) -> dict[str, str]:
        return {path: f"https://signed/{path}" for path in paths}

    async def insert_scan(self, row: dict[str, Any]) -> None:
        self.scans.append(row)

    async def update_scan_confirmed(self, scan_id: str, user_id: str, confirmed: list[str]) -> None:
        self.confirmed.append((scan_id, user_id, confirmed))

    async def scan_belongs_to_user(self, scan_id: str, _: str) -> bool:
        return scan_id in self.owned_scans

    async def find_recipe_id(self, _: str, external_id: str) -> str | None:
        return self.chef_ids.get(external_id)

    async def save_recipe(self, row: dict[str, Any]) -> str:
        self.saved_recipes.append(row)
        return "saved-recipe-id"

    async def insert_cooked(self, row: dict[str, Any]) -> str:
        self.cooked.append(row)
        return "cooked-id"

    async def fetch_feed_page(self, limit: int, _: str | None) -> list[dict[str, Any]]:
        return self.feed[:limit]

    async def fetch_display_names(self, _: list[str]) -> dict[str, str]:
        return self.names

    async def fetch_cooked_page(self, _: str, limit: int, __: str | None) -> list[dict[str, Any]]:
        return self.page[:limit]


ROWS = [
    {"canonical_name": "tomato", "aliases": ["roma tomato", "cherry tomatoes"]},
    {"canonical_name": "egg", "aliases": ["large egg"]},
    {"canonical_name": "oil", "aliases": ["olive oil"], "is_staple": True},
    {"canonical_name": "salt", "aliases": ["salt and pepper"], "is_staple": True},
    {"canonical_name": "spinach", "aliases": ["spinach leaf"]},
    {"canonical_name": "basil", "aliases": [], "category": "herb"},
]


@pytest.fixture(autouse=True)
def offline_index(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Tests use a small fixed index and never reach Supabase."""

    async def no_refresh() -> None:
        return None

    normalize.set_index(normalize.IngredientIndex(ROWS))
    monkeypatch.setattr(normalize, "refresh_ingredients", no_refresh)
    online_cache.clear()
    token_cache.clear()
    name_cache.clear()
    dish_cache.clear()
    scan_limiter._hits.clear()
    search_limiter._hits.clear()
    yield
    online_cache.clear()


@pytest.fixture(autouse=True)
def signed_in() -> Iterator[None]:
    """Tests run as this user. test_auth.py removes the override to test the real check."""
    app.dependency_overrides[get_current_user] = lambda: USER_ID
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def fake_db(monkeypatch: pytest.MonkeyPatch) -> FakeDb:
    """Replaces every Supabase call used by the routes."""
    fake = FakeDb()
    for name in dir(fake):
        if not name.startswith("_") and callable(getattr(fake, name)):
            monkeypatch.setattr(db, name, getattr(fake, name))
    return fake
