import re
from typing import Any

import httpx

from app.config import get_settings
from app.core.normalize import normalize, split_core_optional
from app.models import GeminiIngredientLine, RecipeCandidate

BASE_URL = "https://api.spoonacular.com/recipes"
TIMEOUT_SECONDS = 10
SEARCH_COUNT = 10
DETAIL_COUNT = 5


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def _first_sentences(text: str, count: int = 2) -> str:
    return " ".join(re.split(r"(?<=[.!?])\s+", text)[:count])


def _steps(info: dict[str, Any]) -> list[str]:
    for instructions in info.get("analyzedInstructions") or []:
        steps = [step["step"] for step in instructions.get("steps") or [] if step.get("step")]
        if steps:
            return steps
    text = _strip_html(info.get("instructions") or "")
    return [line.strip() for line in text.splitlines() if line.strip()]


def _format_amount(amount: float | None) -> str:
    return f"{amount:g}" if amount else ""


def to_candidate(info: dict[str, Any]) -> RecipeCandidate:
    lines = [
        GeminiIngredientLine(
            name=item.get("nameClean") or item["name"],
            canonical_name=normalize(item.get("nameClean") or item["name"]),
            amount=_format_amount(item.get("amount")),
            unit=item.get("unit") or "",
        )
        for item in info.get("extendedIngredients") or []
    ]
    core, optional = split_core_optional(line.canonical_name for line in lines)
    return RecipeCandidate(
        source="online",
        external_id=str(info["id"]),
        title=info["title"],
        description=_first_sentences(_strip_html(info.get("summary") or "")),
        core_ingredients=core,
        optional_ingredients=optional,
        ingredient_lines=lines,
        steps=_steps(info),
        image_url=info.get("image"),
        prep_minutes=info.get("readyInMinutes"),
    )


async def find_by_ingredients(ingredients: list[str]) -> list[RecipeCandidate]:
    api_key = get_settings().spoonacular_api_key
    if not api_key:
        return []

    names = ",".join(name.replace("_", " ") for name in ingredients)
    # The key goes in a header so it cannot appear in logged URLs.
    async with httpx.AsyncClient(
        base_url=BASE_URL, headers={"x-api-key": api_key}, timeout=TIMEOUT_SECONDS
    ) as client:
        found = await client.get(
            "/findByIngredients",
            params={
                "ingredients": names,
                "number": SEARCH_COUNT,
                "ranking": 1,
                "ignorePantry": "true",
            },
        )
        found.raise_for_status()
        # Details cost quota, so spend them on the recipes the user is closest to making.
        closest = sorted(found.json(), key=lambda item: item.get("missedIngredientCount", 0))
        ids = [str(item["id"]) for item in closest[:DETAIL_COUNT]]
        if not ids:
            return []

        # The bulk endpoint costs fewer quota points than one /information call per recipe.
        details = await client.get("/informationBulk", params={"ids": ",".join(ids)})
        details.raise_for_status()

    # Recipes without steps cannot be cooked from the detail screen.
    return [
        candidate for candidate in map(to_candidate, details.json()) if candidate.steps
    ]
