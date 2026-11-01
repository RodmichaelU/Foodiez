import logging
import re
import time
from collections.abc import Iterable, Mapping
from typing import Any

from app.services import db

logger = logging.getLogger(__name__)

REFRESH_SECONDS = 10 * 60

# Used until the ingredients table can be read.
FALLBACK_STAPLES = frozenset({"salt", "pepper", "oil", "butter", "flour", "sugar", "water"})

IRREGULAR_PLURALS = {"leaves": "leaf", "loaves": "loaf", "cookies": "cookie"}
UNCHANGED_PLURALS = {"molasses"}
MODIFIERS = {
    "fresh", "large", "medium", "small", "organic", "ripe", "chopped", "sliced", "diced",
    "whisked", "beaten", "melted", "minced", "grated", "shredded", "ground",
    "drizzle", "of", "plus", "extra",
}  # fmt: skip

# Online recipes do not say what is optional, and a missing garnish should not rule a dish out.
SEASONING_CATEGORIES = {"herb", "spice", "condiment"}


def clean_name(name: str) -> str:
    """Lowercase snake_case form of a name, e.g. 'Olive Oil' -> 'olive_oil'."""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _singular_word(word: str) -> str:
    if word in IRREGULAR_PLURALS:
        return IRREGULAR_PLURALS[word]
    if word in UNCHANGED_PLURALS or len(word) < 4 or word.endswith(("ss", "us", "is")):
        return word
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith(("oes", "ches", "shes", "xes", "sses")):
        return word[:-2]
    return word[:-1] if word.endswith("s") else word


def singularize(cleaned: str) -> str:
    """Singularize the last word: 'cherry_tomatoes' -> 'cherry_tomato'."""
    head, _, last = cleaned.rpartition("_")
    singular = _singular_word(last)
    return f"{head}_{singular}" if head else singular


class IngredientIndex:
    """Maps cleaned canonical names and aliases to canonical names."""

    def __init__(self, rows: Iterable[Mapping[str, Any]] = ()) -> None:
        self.lookup: dict[str, str] = {}
        self.canonical_names: list[str] = []
        self.seasonings: set[str] = set()
        staples: set[str] = set()
        for row in rows:
            canonical = row["canonical_name"]
            self.canonical_names.append(canonical)
            if row.get("category") in SEASONING_CATEGORIES:
                self.seasonings.add(canonical)
            self.lookup[canonical] = canonical
            for alias in row.get("aliases") or []:
                cleaned = clean_name(alias)
                self.lookup[cleaned] = canonical
                self.lookup[singularize(cleaned)] = canonical
            if row.get("is_staple"):
                staples.add(canonical)
        self.staples = frozenset(staples) or FALLBACK_STAPLES

    def normalize(self, name: str) -> str:
        cleaned = clean_name(name)
        words = [word for word in cleaned.split("_") if word not in MODIFIERS]
        without_modifiers = "_".join(words) or cleaned

        for candidate in (cleaned, without_modifiers):
            for form in (candidate, singularize(candidate)):
                if form in self.lookup:
                    return self.lookup[form]
        return singularize(without_modifiers)


_index = IngredientIndex()
_loaded_at: float | None = None


def set_index(index: IngredientIndex) -> None:
    global _index, _loaded_at
    _index = index
    _loaded_at = time.monotonic()


async def refresh_ingredients() -> None:
    """Reload the table when stale. On failure, keep the current index until the next interval."""
    global _loaded_at
    if _loaded_at is not None and time.monotonic() - _loaded_at < REFRESH_SECONDS:
        return
    try:
        set_index(IngredientIndex(await db.fetch_ingredients()))
    except Exception as error:
        _loaded_at = time.monotonic()
        logger.warning("Could not load ingredients: %s", type(error).__name__)


def normalize(name: str) -> str:
    return _index.normalize(name)


def split_core_optional(names: Iterable[str]) -> tuple[list[str], list[str]]:
    """Treat seasonings as optional, unless a recipe has nothing else."""
    unique = list(dict.fromkeys(names))
    core = [name for name in unique if name not in _index.seasonings]
    if not core:
        return unique, []
    return core, [name for name in unique if name in _index.seasonings]


def staples() -> frozenset[str]:
    return _index.staples


def known_names() -> list[str]:
    return _index.canonical_names
