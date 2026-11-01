import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import GeminiDetection, RecipesResponse
from app.routers import recipes as recipes_router
from app.services import db, gemini
from tests.conftest import USER_ID, FakeDb

client = TestClient(app)
JPEG = ("images", ("photo.jpg", b"\xff\xd8\xffjpeg-bytes", "image/jpeg"))


def _detection(canonical_name: str, confidence: float) -> GeminiDetection:
    return GeminiDetection(
        name=canonical_name, canonical_name=canonical_name, category="produce", confidence=confidence
    )


def test_scan_normalizes_flags_low_confidence_and_merges_duplicates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def detect(_: list[bytes], known_names: list[str]) -> list[GeminiDetection]:
        assert "tomato" in known_names
        return [_detection("Tomatoes", 0.4), _detection("roma tomato", 0.9), _detection("basil", 0.3)]

    monkeypatch.setattr(gemini, "detect_ingredients", detect)

    body = client.post("/scan", files=[JPEG]).json()

    assert [(i["canonical_name"], i["low_confidence"]) for i in body["ingredients"]] == [
        ("tomato", False),
        ("basil", True),
    ]


def test_scan_rejects_too_many_photos() -> None:
    assert client.post("/scan", files=[JPEG] * 4).status_code == 400


def test_scan_rejects_non_jpeg_even_if_labelled_jpeg() -> None:
    files = [("images", ("photo.jpg", b"not-a-jpeg", "image/jpeg"))]

    assert client.post("/scan", files=files).status_code == 400


def test_scan_accepts_jpeg_without_a_jpeg_content_type(monkeypatch: pytest.MonkeyPatch) -> None:
    async def detect(_: list[bytes], __: list[str]) -> list[GeminiDetection]:
        return []

    monkeypatch.setattr(gemini, "detect_ingredients", detect)
    files = [("images", ("photo.jpg", b"\xff\xd8\xffdata", "application/octet-stream"))]

    assert client.post("/scan", files=files).status_code == 200


def test_gemini_rate_limit_returns_friendly_message(monkeypatch: pytest.MonkeyPatch) -> None:
    async def detect(_: list[bytes], __: list[str]) -> list[GeminiDetection]:
        raise gemini.GeminiError("Too many scans right now, try again in a minute.", 429)

    monkeypatch.setattr(gemini, "detect_ingredients", detect)

    response = client.post("/scan", files=[JPEG])

    assert response.status_code == 429
    assert response.json()["detail"] == "Too many scans right now, try again in a minute."


def test_recipes_applies_the_users_avoid_list(
    monkeypatch: pytest.MonkeyPatch, fake_db: FakeDb
) -> None:
    fake_db.profile = {"avoid_ingredients": ["peanut"]}

    async def search(ingredients: list[str], use_staples: bool, avoid: list[str]) -> RecipesResponse:
        assert ingredients == ["Egg"]
        assert use_staples is False
        assert avoid == ["peanut"]
        return RecipesResponse(chef_picks=[], online=[], ai=[])

    monkeypatch.setattr(recipes_router, "search_recipes", search)

    response = client.post("/recipes", json={"ingredients": ["Egg"], "use_staples": False})

    assert response.json() == {"chef_picks": [], "online": [], "ai": []}


def test_recipes_fail_rather_than_ignore_allergies(monkeypatch: pytest.MonkeyPatch) -> None:
    async def broken(_: str) -> None:
        raise db.DatabaseError("down")

    monkeypatch.setattr(db, "fetch_profile", broken)

    response = client.post("/recipes", json={"ingredients": ["egg"]})

    assert response.status_code == 503


def test_recipes_saves_confirmed_ingredients(
    monkeypatch: pytest.MonkeyPatch, fake_db: FakeDb
) -> None:
    async def search(_: list[str], __: bool, ___: list[str]) -> RecipesResponse:
        return RecipesResponse(chef_picks=[], online=[], ai=[])

    monkeypatch.setattr(recipes_router, "search_recipes", search)
    scan_id = "22222222-2222-2222-2222-222222222222"

    client.post("/recipes", json={"scan_id": scan_id, "ingredients": ["Eggs", "egg"]})

    assert fake_db.confirmed == [(scan_id, USER_ID, ["egg"])]


def test_scan_stores_row_and_photos(monkeypatch: pytest.MonkeyPatch, fake_db: FakeDb) -> None:
    async def detect(_: list[bytes], __: list[str]) -> list[GeminiDetection]:
        return [_detection("egg", 0.9)]

    monkeypatch.setattr(gemini, "detect_ingredients", detect)

    body = client.post("/scan", files=[JPEG, JPEG]).json()

    folder = f"{USER_ID}/{body['scan_id']}"
    assert fake_db.scans[0]["id"] == body["scan_id"]
    assert fake_db.scans[0]["photo_url"] == f"{folder}/0.jpg"
    assert fake_db.uploads == [
        (db.SCAN_PHOTOS_BUCKET, f"{folder}/0.jpg"),
        (db.SCAN_PHOTOS_BUCKET, f"{folder}/1.jpg"),
    ]


def test_scan_survives_a_storage_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    async def detect(_: list[bytes], __: list[str]) -> list[GeminiDetection]:
        return [_detection("egg", 0.9)]

    async def broken(_: dict[str, str]) -> None:
        raise db.DatabaseError("down")

    monkeypatch.setattr(gemini, "detect_ingredients", detect)
    monkeypatch.setattr(db, "insert_scan", broken)

    assert client.post("/scan", files=[JPEG]).status_code == 200


def test_scan_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    async def detect(_: list[bytes], __: list[str]) -> list[GeminiDetection]:
        return []

    monkeypatch.setattr(gemini, "detect_ingredients", detect)

    codes = [client.post("/scan", files=[JPEG]).status_code for _ in range(6)]

    assert codes == [200, 200, 200, 200, 200, 429]


def test_recipes_rejects_blank_ingredients() -> None:
    assert client.post("/recipes", json={"ingredients": ["  "]}).status_code == 400
