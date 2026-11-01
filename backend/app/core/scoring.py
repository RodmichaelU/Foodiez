from collections.abc import Collection, Iterable
from dataclasses import dataclass

MAX_MISSING_CORE = 2


@dataclass(frozen=True)
class RecipeScore:
    score: float
    have_count: int
    total_core: int
    missing: list[str]


def owned_ingredients(
    ingredients: Iterable[str], staples: Iterable[str], use_staples: bool
) -> set[str]:
    owned = set(ingredients)
    return owned | set(staples) if use_staples else owned


def score_recipe(core: list[str], optional: list[str], owned: set[str]) -> RecipeScore:
    unique_core = list(dict.fromkeys(core))
    missing = [name for name in unique_core if name not in owned]
    have_count = len(unique_core) - len(missing)
    core_have = have_count / len(unique_core) if unique_core else 0.0
    optional_have = len(set(optional) & owned)

    return RecipeScore(
        score=core_have - 0.1 * len(missing) + 0.02 * optional_have,
        have_count=have_count,
        total_core=len(unique_core),
        missing=missing,
    )


def contains_avoided(names: Iterable[str], avoid: Collection[str]) -> bool:
    """Match whole words, so avoiding 'peanut' also catches 'peanut_butter'."""
    for name in names:
        padded = f"_{name}_"
        if any(f"_{avoided}_" in padded for avoided in avoid):
            return True
    return False


def is_excluded(names: Iterable[str], missing: list[str], avoid: Collection[str]) -> bool:
    return len(missing) > MAX_MISSING_CORE or contains_avoided(names, avoid)
