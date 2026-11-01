from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import FakeDb

client = TestClient(app)


def test_new_user_gets_an_empty_profile() -> None:
    assert client.get("/profile").json() == {
        "display_name": None,
        "avoid_ingredients": [],
        "cooked_count": 0,
        "scan_count": 0,
    }


def test_update_normalizes_avoid_list_and_trims_name(fake_db: FakeDb) -> None:
    body = client.put(
        "/profile", json={"display_name": "  Sam ", "avoid_ingredients": ["Eggs", "egg", " "]}
    ).json()

    assert body["display_name"] == "Sam"
    assert body["avoid_ingredients"] == ["egg"]
    assert fake_db.profile is not None
