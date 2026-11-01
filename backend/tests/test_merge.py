from typing import Literal

from app.core.merge import merge_recipes
from app.models import Recipe

Source = Literal["chef", "online", "ai"]


def _recipe(title: str, source: Source, score: float) -> Recipe:
    return Recipe(
        id=title,
        source=source,
        title=title,
        description="",
        core_ingredients=[],
        optional_ingredients=[],
        ingredient_lines=[],
        steps=[],
        score=score,
        have_count=0,
        total_core=0,
        missing=[],
    )


def test_groups_by_source_and_sorts_by_score() -> None:
    merged = merge_recipes(
        [
            _recipe("Low online", "online", 0.2),
            _recipe("High online", "online", 0.9),
            _recipe("Chef", "chef", 0.8),
            _recipe("Idea", "ai", 1.0),
        ]
    )

    assert [recipe.title for recipe in merged.chef_picks] == ["Chef"]
    assert [recipe.title for recipe in merged.online] == ["High online", "Low online"]
    assert [recipe.title for recipe in merged.ai] == ["Idea"]


def test_chef_pick_threshold() -> None:
    merged = merge_recipes([_recipe("At", "chef", 0.7), _recipe("Below", "chef", 0.69)])

    assert [recipe.title for recipe in merged.chef_picks] == ["At"]


def test_duplicate_titles_keep_highest_priority_source() -> None:
    merged = merge_recipes(
        [
            _recipe("Egg Fried Rice!", "ai", 1.0),
            _recipe("egg fried rice", "online", 0.8),
            _recipe("EGG FRIED RICE", "chef", 0.75),
        ]
    )

    assert [recipe.source for recipe in merged.chef_picks] == ["chef"]
    assert merged.online == []
    assert merged.ai == []


def test_low_scoring_chef_pick_does_not_block_online_duplicate() -> None:
    merged = merge_recipes([_recipe("Soup", "chef", 0.3), _recipe("Soup", "online", 0.8)])

    assert [recipe.source for recipe in merged.online] == ["online"]
