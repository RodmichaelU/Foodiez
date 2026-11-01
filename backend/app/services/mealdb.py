import asyncio
from typing import Any

import httpx

from app.core.normalize import normalize, split_core_optional
from app.models import GeminiIngredientLine, RecipeCandidate

BASE_URL = "https://www.themealdb.com/api/json/v1/1"
TIMEOUT_SECONDS = 10
DETAIL_COUNT = 5
MAX_INGREDIENT_SLOTS = 20


def to_candidate(meal: dict[str, Any]) -> RecipeCandidate:
    lines: list[GeminiIngredientLine] = []
    for slot in range(1, MAX_INGREDIENT_SLOTS + 1):
        name = (meal.get(f"strIngredient{slot}") or "").strip()
        if name:
            lines.append(
                GeminiIngredientLine(
                    name=name,
                    canonical_name=normalize(name),
                    # TheMealDB combines amount and unit, e.g. "2 tbsp".
                    amount=(meal.get(f"strMeasure{slot}") or "").strip(),
                    unit="",
                )
            )
    instructions = meal.get("strInstructions") or ""
    core, optional = split_core_optional(line.canonical_name for line in lines)
    return RecipeCandidate(
        source="online",
        external_id=f"mealdb-{meal['idMeal']}",
        title=meal["strMeal"],
        description="",
        core_ingredients=core,
        optional_ingredients=optional,
        ingredient_lines=lines,
        steps=[line.strip() for line in instructions.splitlines() if line.strip()],
        image_url=meal.get("strMealThumb"),
        prep_minutes=None,
    )


async def find_by_ingredient(ingredient: str) -> list[RecipeCandidate]:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT_SECONDS) as client:
        found = await client.get("/filter.php", params={"i": ingredient})
        found.raise_for_status()
        meals = found.json().get("meals") or []

        lookups = await asyncio.gather(
            *(
                client.get("/lookup.php", params={"i": meal["idMeal"]})
                for meal in meals[:DETAIL_COUNT]
            )
        )

    details = [
        meal
        for lookup in lookups
        if lookup.is_success
        for meal in lookup.json().get("meals") or []
    ]
    return [candidate for candidate in map(to_candidate, details) if candidate.steps]
