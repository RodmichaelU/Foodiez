from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import recipes
from app.models import GeminiIngredientLine, RecipeCandidate
from app.services import spoonacular
from tests.conftest import FakeDb

client = TestClient(app)


def _row(row_id: str, **overrides: Any) -> dict[str, Any]:
    return {
        "id": row_id,
        "user_id": "author",
        "created_at": f"2026-01-{row_id}",
        "caption": None,
        "is_public": True,
        "dish_photo_url": None,
        "recipes": None,
        "scans": None,
        **overrides,
    }


def test_feed_shows_author_and_never_exposes_scan_photos(fake_db: FakeDb) -> None:
    fake_db.names = {"author": "Sam"}
    fake_db.feed = [
        _row("01", dish_photo_url="https://dish"),
        _row("02", scans={"photo_url": "u/s/0.jpg", "confirmed_ingredients": ["egg"]}),
    ]

    items = client.get("/feed").json()["items"]

    assert [item["author_name"] for item in items] == ["Sam", "Sam"]
    assert [item["photo_url"] for item in items] == ["https://dish", None]
    assert items[1]["ingredients_used"] == ["egg"]


def test_feed_uses_a_default_author_and_never_an_email(fake_db: FakeDb) -> None:
    fake_db.feed = [_row("01")]

    assert client.get("/feed").json()["items"][0]["author_name"] == "Foodiez cook"


def test_feed_pages_with_a_cursor(fake_db: FakeDb) -> None:
    fake_db.feed = [_row(f"{n:02}") for n in range(21)]

    body = client.get("/feed").json()

    assert len(body["items"]) == 20
    assert body["next_cursor"] == "2026-01-19"


def test_online_recipe_details_are_fetched_live_and_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    recipes.online_recipe_cache.clear()
    calls: list[str] = []

    async def get_recipe(recipe_id: str) -> RecipeCandidate:
        calls.append(recipe_id)
        return RecipeCandidate(
            source="online",
            external_id=recipe_id,
            title="Soup",
            description="",
            core_ingredients=["egg"],
            optional_ingredients=[],
            ingredient_lines=[
                GeminiIngredientLine(name="Egg", canonical_name="egg", amount="1", unit="")
            ],
            steps=["Cook."],
            source_name="A Blog",
            source_url="https://blog",
        )

    monkeypatch.setattr(spoonacular, "get_recipe", get_recipe)

    body = client.get("/online-recipes/123").json()
    client.get("/online-recipes/123")

    assert body["steps"] == ["Cook."]
    assert body["source_name"] == "A Blog"
    assert calls == ["123"]


def test_online_recipe_rejects_non_numeric_ids() -> None:
    assert client.get("/online-recipes/mealdb-1").status_code == 404
