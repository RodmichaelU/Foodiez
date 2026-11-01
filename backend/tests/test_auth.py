from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from supabase_auth.errors import AuthApiError

from app.core import auth
from app.core.auth import get_current_user
from app.main import app
from app.services import db

client = TestClient(app)
HEADERS = {"Authorization": "Bearer token"}
PROTECTED = [("post", "/recipes"), ("post", "/scan"), ("get", "/profile"), ("put", "/profile"), ("get", "/cooked"), ("post", "/cooked"), ("get", "/search?q=egg"), ("get", "/feed"), ("get", "/online-recipes/1")]  # fmt: skip


@pytest.fixture(autouse=True)
def real_auth() -> None:
    app.dependency_overrides.pop(get_current_user)


class FakeAuth:
    def __init__(self, result: object) -> None:
        self.result = result
        self.calls = 0

    async def get_user(self, _: str) -> object:
        self.calls += 1
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def _use_auth(monkeypatch: pytest.MonkeyPatch, fake: FakeAuth) -> None:
    async def get_client() -> SimpleNamespace:
        return SimpleNamespace(auth=fake)

    monkeypatch.setattr(auth.db, "get_client", get_client)
    monkeypatch.setattr(auth.db, "run", _passthrough)


async def _passthrough(call: object) -> object:
    try:
        return await call  # type: ignore[misc]
    except Exception as error:
        raise db.DatabaseError(type(error).__name__) from error


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_endpoints_require_a_token(method: str, path: str) -> None:
    assert client.request(method, path).status_code == 401


def test_health_is_public() -> None:
    assert client.get("/health").status_code == 200


def test_valid_token_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = FakeAuth(SimpleNamespace(user=SimpleNamespace(id="user-1")))
    _use_auth(monkeypatch, fake)

    assert client.get("/profile", headers=HEADERS).status_code == 200
    assert client.get("/profile", headers=HEADERS).status_code == 200
    assert fake.calls == 1


def test_invalid_token_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _use_auth(monkeypatch, FakeAuth(AuthApiError("bad jwt", 401, None)))

    assert client.get("/profile", headers=HEADERS).status_code == 401


def test_supabase_outage_is_not_reported_as_logged_out(monkeypatch: pytest.MonkeyPatch) -> None:
    _use_auth(monkeypatch, FakeAuth(TimeoutError()))

    assert client.get("/profile", headers=HEADERS).status_code == 503
