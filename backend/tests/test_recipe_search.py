import asyncio
from typing import Literal

import pytest

from app.models import GeminiIngredientLine, GeminiRecipe, RecipeCandidate
from app.services import chef_picks, gemini, mealdb, recipe_search, spoonacular
from app.services.recipe_search import search_recipes


def _candidate(
    title: str, source: Literal["chef", "online"], core: list[str], external_id: str | None = None
) -> RecipeCandidate:
    return RecipeCandidate(
        source=source,
        external_id=external_id or title,
        title=title,
        description="",
        core_ingredients=core,
        optional_ingredients=[],
        ingredient_lines=[
            GeminiIngredientLine(name=name, canonical_name=name, amount="1", unit="")
            for name in core
        ],
        steps=["Cook."],
    )


def _ai_recipe(title: str) -> GeminiRecipe:
    return GeminiRecipe(
        title=title,
        description="",
        core_ingredients=["Eggs"],
        optional_ingredients=[],
        ingredient_lines=[
            GeminiIngredientLine(name="Eggs", canonical_name="Eggs", amount="2", unit="")
        ],
        steps=["Cook."],
        prep_minutes=5,
    )


class Sources:
    """Records which fake sources were called."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.chef: list[RecipeCandidate] = []
        self.spoonacular: list[RecipeCandidate] | Exception = []
        self.mealdb: list[RecipeCandidate] = []
        self.ai: list[GeminiRecipe] | Exception = []
        self.calls: list[str] = []
        self.ai_ingredients: list[str] = []
        self.ai_avoid: list[str] = []

        async def fetch_chef() -> list[RecipeCandidate]:
            return self.chef

        async def fetch_spoonacular(_: list[str]) -> list[RecipeCandidate]:
            self.calls.append("spoonacular")
            if isinstance(self.spoonacular, Exception):
                raise self.spoonacular
            return self.spoonacular

        async def fetch_mealdb(_: str) -> list[RecipeCandidate]:
            self.calls.append("mealdb")
            return self.mealdb

        async def generate(
            ingredients: list[str], __: list[str], avoid: list[str]
        ) -> list[GeminiRecipe]:
            self.calls.append("ai")
            self.ai_ingredients = ingredients
            self.ai_avoid = avoid
            if isinstance(self.ai, Exception):
                raise self.ai
            return self.ai

        monkeypatch.setattr(chef_picks, "fetch_chef_picks", fetch_chef)
        monkeypatch.setattr(spoonacular, "find_by_ingredients", fetch_spoonacular)
        monkeypatch.setattr(mealdb, "find_by_ingredient", fetch_mealdb)
        monkeypatch.setattr(gemini, "generate_recipes", generate)


@pytest.fixture
def sources(monkeypatch: pytest.MonkeyPatch) -> Sources:
    return Sources(monkeypatch)


def _matches(count: int) -> list[RecipeCandidate]:
    return [_candidate(f"Online {n}", "online", ["egg"]) for n in range(count)]


def test_enough_good_matches_skip_backup_and_ai(sources: Sources) -> None:
    sources.spoonacular = _matches(3)

    result = asyncio.run(search_recipes(["eggs"], True))

    assert len(result.online) == 3
    assert sources.calls == ["spoonacular"]


def test_spoonacular_failure_falls_back_to_mealdb(sources: Sources) -> None:
    sources.spoonacular = RuntimeError("quota")
    sources.mealdb = [_candidate("From MealDB", "online", ["egg"])]

    result = asyncio.run(search_recipes(["eggs"], True))

    assert [recipe.title for recipe in result.online] == ["From MealDB"]
    assert "mealdb" in sources.calls


def test_few_good_matches_add_ai_recipes(sources: Sources) -> None:
    sources.spoonacular = _matches(1)
    sources.ai = [_ai_recipe("AI eggs")]

    result = asyncio.run(search_recipes(["egg"], True))

    assert [recipe.title for recipe in result.ai] == ["AI eggs"]
    assert result.ai[0].missing == []


def test_chef_pick_is_pinned_and_staples_count(sources: Sources) -> None:
    sources.chef = [_candidate("Chef eggs", "chef", ["egg", "salt"])]
    sources.spoonacular = _matches(3)

    result = asyncio.run(search_recipes(["egg"], True))

    assert [recipe.title for recipe in result.chef_picks] == ["Chef eggs"]
    assert result.chef_picks[0].id == "chef-Chef eggs"


def test_avoided_ingredients_are_excluded(sources: Sources) -> None:
    sources.spoonacular = _matches(3)

    result = asyncio.run(search_recipes(["egg"], True, avoid=["egg"]))

    assert result.online == []


def test_ai_is_told_about_avoided_ingredients(sources: Sources) -> None:
    result = asyncio.run(search_recipes(["egg", "tomato"], True, avoid=["egg"]))

    assert sources.ai_ingredients == ["tomato"]
    assert sources.ai_avoid == ["egg"]
    assert result.ai == []


def test_avoided_ingredient_only_in_lines_is_excluded(sources: Sources) -> None:
    recipe = _ai_recipe("Sneaky")
    recipe.ingredient_lines.append(
        GeminiIngredientLine(name="Peanut butter", canonical_name="peanut butter", amount="", unit="")
    )
    sources.ai = [recipe]

    result = asyncio.run(search_recipes(["egg"], True, avoid=["peanut"]))

    assert result.ai == []


def test_online_results_are_cached_by_ingredient_set(sources: Sources) -> None:
    sources.spoonacular = _matches(3)

    asyncio.run(search_recipes(["egg", "tomato"], True))
    asyncio.run(search_recipes(["tomatoes", "eggs"], True))

    assert sources.calls.count("spoonacular") == 1


def test_empty_online_results_are_not_cached(sources: Sources) -> None:
    sources.ai = [_ai_recipe("AI eggs")]

    asyncio.run(search_recipes(["egg"], True))
    asyncio.run(search_recipes(["egg"], True))

    assert sources.calls.count("spoonacular") == 2


def test_ai_failure_is_hidden_when_other_results_exist(sources: Sources) -> None:
    sources.spoonacular = _matches(1)
    sources.ai = gemini.GeminiError("busy", 429)

    result = asyncio.run(search_recipes(["egg"], True))

    assert len(result.online) == 1


def test_ai_failure_is_raised_when_nothing_else_exists(sources: Sources) -> None:
    sources.ai = gemini.GeminiError("busy", 429)

    with pytest.raises(gemini.GeminiError):
        asyncio.run(search_recipes(["egg"], True))


def test_source_timeout_returns_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(recipe_search, "SOURCE_TIMEOUT_SECONDS", 0.01)

    async def slow() -> list[RecipeCandidate]:
        await asyncio.sleep(1)
        return _matches(1)

    assert asyncio.run(recipe_search._safely("Slow", slow())) == []
