from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import GeminiIngredientLine, GeminiRecipe, RecipeCandidate, RecipesResponse
from app.services import chef_picks, gemini, mealdb, recipe_search, spoonacular
from tests.conftest import FakeDb

client = TestClient(app)


def _candidate(title: str, source: Any = "online", core: list[str] | None = None) -> RecipeCandidate:
    names = core or ["egg"]
    return RecipeCandidate(
        source=source,
        external_id=title,
        title=title,
        description="",
        core_ingredients=names,
        optional_ingredients=[],
        ingredient_lines=[
            GeminiIngredientLine(name=name, canonical_name=name, amount="", unit="")
            for name in names
        ],
        steps=["Cook."],
    )


class NameSources:
    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.chef: list[RecipeCandidate] = []
        self.spoonacular: list[RecipeCandidate] = []
        self.mealdb: list[RecipeCandidate] = []
        self.calls: list[str] = []
        self.ai: list[GeminiRecipe] | Exception = []
        self.ai_avoid: list[str] = []

        async def dish(query: str, avoid: list[str]) -> list[GeminiRecipe]:
            self.calls.append(f"ai:{query}")
            self.ai_avoid = avoid
            if isinstance(self.ai, Exception):
                raise self.ai
            return self.ai

        monkeypatch.setattr(gemini, "generate_dish_recipes", dish)

        async def chef(query: str) -> list[RecipeCandidate]:
            self.calls.append(f"chef:{query}")
            return self.chef

        async def spoon(query: str) -> list[RecipeCandidate]:
            self.calls.append(f"spoonacular:{query}")
            return self.spoonacular

        async def meals(query: str) -> list[RecipeCandidate]:
            self.calls.append(f"mealdb:{query}")
            return self.mealdb

        monkeypatch.setattr(chef_picks, "search_chef_picks", chef)
        monkeypatch.setattr(spoonacular, "search_by_name", spoon)
        monkeypatch.setattr(mealdb, "search_by_name", meals)


@pytest.fixture
def sources(monkeypatch: pytest.MonkeyPatch) -> NameSources:
    return NameSources(monkeypatch)


def test_name_search_merges_sources_without_a_match(sources: NameSources) -> None:
    sources.chef = [_candidate("Chef Pasta", "chef")]
    sources.spoonacular = [_candidate(f"Pasta {n}") for n in range(3)]

    body = client.get("/search", params={"q": " pasta "}).json()

    assert [recipe["title"] for recipe in body["chef_picks"]] == ["Chef Pasta"]
    assert len(body["online"]) == 3
    assert body["ai"] == []
    assert body["online"][0]["match_known"] is False
    assert "chef:pasta" in sources.calls
    assert not any(call.startswith("mealdb") for call in sources.calls)


def test_name_search_keeps_chef_picks_that_would_fail_the_score_rules(sources: NameSources) -> None:
    sources.chef = [_candidate("Big Chef Dish", "chef", ["a", "b", "c", "d"])]

    body = client.get("/search", params={"q": "dish"}).json()

    assert len(body["chef_picks"]) == 1


def test_name_search_applies_avoid_list(sources: NameSources, fake_db: FakeDb) -> None:
    fake_db.profile = {"avoid_ingredients": ["peanut"]}
    sources.spoonacular = [_candidate("Satay", core=["peanut_butter"]), _candidate("Soup")]

    body = client.get("/search", params={"q": "s"}).json()

    assert [recipe["title"] for recipe in body["online"]] == ["Soup"]


def test_name_search_falls_back_to_mealdb(sources: NameSources) -> None:
    sources.mealdb = [_candidate("Backup")]

    body = client.get("/search", params={"q": "stew"}).json()

    assert [recipe["title"] for recipe in body["online"]] == ["Backup"]


def test_name_search_caches_regardless_of_case(sources: NameSources) -> None:
    sources.spoonacular = [_candidate(f"Pasta {n}") for n in range(3)]

    client.get("/search", params={"q": "Pasta"})
    client.get("/search", params={"q": "pasta"})

    assert sum(call.startswith("spoonacular") for call in sources.calls) == 1


def _dish(title: str, core: list[str] | None = None) -> GeminiRecipe:
    names = core or ["pork"]
    return GeminiRecipe(
        title=title,
        description="",
        core_ingredients=names,
        optional_ingredients=[],
        ingredient_lines=[
            GeminiIngredientLine(name=name, canonical_name=name, amount="", unit="")
            for name in names
        ],
        steps=["Cook."],
        prep_minutes=30,
    )


def test_ai_does_not_run_while_typing(sources: NameSources) -> None:
    sources.ai = [_dish("Sinigang")]

    body = client.get("/search", params={"q": "sinig"}).json()

    assert body["ai"] == []
    assert not any(call.startswith("ai") for call in sources.calls)


def test_ai_fills_in_when_results_are_thin(sources: NameSources) -> None:
    sources.ai = [_dish("Sinigang")]

    body = client.get("/search", params={"q": "sinigang", "ai": "true"}).json()

    assert [recipe["title"] for recipe in body["ai"]] == ["Sinigang"]
    assert body["ai"][0]["source"] == "ai"
    assert body["ai"][0]["match_known"] is False


def test_ai_is_skipped_when_results_are_good(sources: NameSources) -> None:
    sources.spoonacular = [_candidate(f"Pasta {n}") for n in range(3)]

    client.get("/search", params={"q": "pasta", "ai": "true"})

    assert not any(call.startswith("ai") for call in sources.calls)


def test_ai_dish_results_respect_avoid_list(sources: NameSources, fake_db: FakeDb) -> None:
    fake_db.profile = {"avoid_ingredients": ["pork"]}
    sources.ai = [_dish("Sinigang", ["pork_belly"]), _dish("Fish Sinigang", ["fish"])]

    body = client.get("/search", params={"q": "sinigang", "ai": "true"}).json()

    assert [recipe["title"] for recipe in body["ai"]] == ["Fish Sinigang"]
    assert sources.ai_avoid == ["pork"]


def test_ai_dish_results_are_cached_per_avoid_list(sources: NameSources, fake_db: FakeDb) -> None:
    sources.ai = [_dish("Sinigang")]
    params = {"q": "sinigang", "ai": "true"}

    client.get("/search", params=params)
    client.get("/search", params=params)
    fake_db.profile = {"avoid_ingredients": ["fish"]}
    client.get("/search", params=params)

    assert sum(call.startswith("ai") for call in sources.calls) == 2


def test_ai_failure_is_shown_only_when_nothing_else_exists(sources: NameSources) -> None:
    sources.ai = gemini.GeminiError("busy", 429)
    params = {"q": "sinigang", "ai": "true"}

    assert client.get("/search", params=params).status_code == 429

    sources.mealdb = [_candidate("Backup")]
    assert client.get("/search", params=params).status_code == 200


def test_ingredient_mode_uses_the_recipe_pipeline(
    monkeypatch: pytest.MonkeyPatch, fake_db: FakeDb
) -> None:
    fake_db.profile = {"avoid_ingredients": ["peanut"]}
    seen: list[Any] = []

    async def fake(ingredients: list[str], use_staples: bool, avoid: list[str]) -> RecipesResponse:
        seen.append((ingredients, use_staples, avoid))
        return RecipesResponse(chef_picks=[], online=[], ai=[])

    monkeypatch.setattr(recipe_search, "search_recipes", fake)

    client.get("/search", params={"q": "egg, spinach,, ", "mode": "ingredient"})

    assert seen == [(["egg", " spinach"], True, ["peanut"])]


@pytest.mark.parametrize(
    "params",
    [{"q": "   "}, {"q": " , ", "mode": "ingredient"}, {"q": ",".join("x" * 41), "mode": "ingredient"}],
)
def test_rejects_unusable_queries(params: dict[str, str]) -> None:
    assert client.get("/search", params=params).status_code == 400


def test_unknown_mode_and_long_query_are_rejected() -> None:
    assert client.get("/search", params={"q": "a", "mode": "x"}).status_code == 422
    assert client.get("/search", params={"q": "a" * 201}).status_code == 422


def test_search_rate_limit(sources: NameSources) -> None:
    codes = [client.get("/search", params={"q": "egg"}).status_code for _ in range(21)]

    assert codes[-2:] == [200, 429]
