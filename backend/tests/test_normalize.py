import pytest

from app.core.normalize import clean_name, normalize, singularize, split_core_optional


def test_clean_name() -> None:
    assert clean_name("  Olive Oil! ") == "olive_oil"


@pytest.mark.parametrize(
    ("plural", "singular"),
    [
        ("tomatoes", "tomato"),
        ("berries", "berry"),
        ("peaches", "peach"),
        ("carrots", "carrot"),
        ("bay_leaves", "bay_leaf"),
        ("cherry_tomatoes", "cherry_tomato"),
        ("asparagus", "asparagus"),
        ("molasses", "molasses"),
        ("swiss", "swiss"),
    ],
)
def test_singularize(plural: str, singular: str) -> None:
    assert singularize(plural) == singular


@pytest.mark.parametrize(
    ("name", "canonical"),
    [
        ("Tomatoes", "tomato"),
        ("  tomato ", "tomato"),
        ("Roma Tomato", "tomato"),
        ("roma tomatoes", "tomato"),
        ("cherry tomato", "tomato"),
        ("Olive Oil", "oil"),
        ("fresh tomatoes", "tomato"),
        ("Large Eggs", "egg"),
        ("eggs whisked", "egg"),
        ("drizzle of olive oil", "oil"),
        ("spinach leaves", "spinach"),
        ("salt and pepper", "salt"),
    ],
)
def test_normalize_matches_canonical_names_and_aliases(name: str, canonical: str) -> None:
    assert normalize(name) == canonical


def test_seasonings_are_optional() -> None:
    assert split_core_optional(["egg", "basil", "dragon_fruit"]) == (
        ["egg", "dragon_fruit"],
        ["basil"],
    )


def test_recipe_of_only_seasonings_keeps_a_core() -> None:
    assert split_core_optional(["basil"]) == (["basil"], [])


def test_normalize_keeps_unknown_items_in_clean_singular_form() -> None:
    assert normalize("Dragon Fruits") == "dragon_fruit"
