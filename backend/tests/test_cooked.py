import json
from typing import Any

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import USER_ID, FakeDb

client = TestClient(app)
SCAN_ID = "22222222-2222-2222-2222-222222222222"
JPEG = ("photo.jpg", b"\xff\xd8\xffdata", "image/jpeg")


def _recipe(**overrides: Any) -> str:
    return json.dumps(
        {
            "id": "online-123",
            "source": "online",
            "title": "Soup",
            "description": "",
            "core_ingredients": ["egg"],
            "optional_ingredients": [],
            "ingredient_lines": [
                {"name": "Egg", "canonical_name": "egg", "amount": "1", "unit": "", "have": True}
            ],
            "steps": ["Cook."],
            "image_url": None,
            "prep_minutes": 5,
            "score": 1,
            "have_count": 1,
            "total_core": 1,
            "missing": [],
            **overrides,
        }
    )


def test_saves_recipe_photo_and_row(fake_db: FakeDb) -> None:
    fake_db.owned_scans = {SCAN_ID}

    response = client.post(
        "/cooked",
        data={"recipe": _recipe(), "scan_id": SCAN_ID, "caption": " Tasty ", "is_public": "false"},
        files={"photo": JPEG},
    )

    assert response.json() == {"id": "cooked-id"}
    saved = fake_db.saved_recipes[0]
    assert saved["external_id"] == "123"
    assert saved["ingredient_lines"] == [{"name": "Egg", "amount": "1", "unit": ""}]
    row = fake_db.cooked[0]
    assert row["user_id"] == USER_ID
    assert row["caption"] == "Tasty"
    assert row["is_public"] is False
    assert row["scan_id"] == SCAN_ID
    assert row["dish_photo_url"].startswith(f"https://public/{USER_ID}/")


def test_photo_is_optional(fake_db: FakeDb) -> None:
    assert client.post("/cooked", data={"recipe": _recipe()}).status_code == 200
    assert fake_db.cooked[0]["dish_photo_url"] is None


def test_someone_elses_scan_is_not_linked(fake_db: FakeDb) -> None:
    client.post("/cooked", data={"recipe": _recipe(), "scan_id": SCAN_ID})

    assert fake_db.cooked[0]["scan_id"] is None


def test_chef_picks_are_looked_up_and_never_written(fake_db: FakeDb) -> None:
    fake_db.chef_ids = {"omelette": "chef-row-id"}

    client.post("/cooked", data={"recipe": _recipe(id="chef-omelette", source="chef")})

    assert fake_db.saved_recipes == []
    assert fake_db.cooked[0]["recipe_id"] == "chef-row-id"


def test_unknown_chef_pick_is_rejected() -> None:
    response = client.post("/cooked", data={"recipe": _recipe(id="chef-fake", source="chef")})

    assert response.status_code == 404


def test_rejects_image_from_unknown_host() -> None:
    recipe = _recipe(image_url="https://evil.example/tracker.png")

    assert client.post("/cooked", data={"recipe": recipe}).status_code == 400


def test_rejects_malformed_recipe_and_long_caption() -> None:
    assert client.post("/cooked", data={"recipe": "{}"}).status_code == 400
    long_caption = {"recipe": _recipe(), "caption": "x" * 301}
    assert client.post("/cooked", data=long_caption).status_code == 422


def _row(row_id: str, created_at: str, **overrides: Any) -> dict[str, Any]:
    return {
        "id": row_id,
        "created_at": created_at,
        "caption": None,
        "is_public": True,
        "dish_photo_url": None,
        "recipes": None,
        "scans": None,
        **overrides,
    }


def test_history_prefers_dish_photo_then_signed_scan_photo(fake_db: FakeDb) -> None:
    scan = {"photo_url": "u/s/0.jpg", "confirmed_ingredients": ["egg"]}
    fake_db.page = [
        _row("a", "2026-01-02", dish_photo_url="https://dish", scans=scan),
        _row("b", "2026-01-01", scans=scan),
        _row("c", "2026-01-00"),
    ]

    items = client.get("/cooked").json()["items"]

    assert [item["photo_url"] for item in items] == [
        "https://dish",
        "https://signed/u/s/0.jpg",
        None,
    ]
    assert items[0]["ingredients_used"] == ["egg"]


def test_history_pages_with_a_cursor(fake_db: FakeDb) -> None:
    fake_db.page = [_row(str(n), f"2026-01-{n:02}") for n in range(31)]

    body = client.get("/cooked").json()

    assert len(body["items"]) == 30
    assert body["next_cursor"] == "2026-01-29"
