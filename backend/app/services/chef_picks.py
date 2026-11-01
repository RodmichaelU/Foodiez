from typing import Any

from app.core.normalize import normalize
from app.models import GeminiIngredientLine, RecipeCandidate
from app.services import db


def _to_candidate(row: dict[str, Any]) -> RecipeCandidate:
    return RecipeCandidate(
        source="chef",
        external_id=row["external_id"],
        title=row["title"],
        description=row.get("description") or "",
        core_ingredients=[normalize(name) for name in row["core_ingredients"]],
        optional_ingredients=[normalize(name) for name in row.get("optional_ingredients") or []],
        ingredient_lines=[
            GeminiIngredientLine(
                name=line["name"],
                canonical_name=normalize(line["name"]),
                amount=str(line.get("amount") or ""),
                unit=line.get("unit") or "",
            )
            for line in row.get("ingredient_lines") or []
        ],
        steps=row.get("steps") or [],
        image_url=row.get("image_url"),
        prep_minutes=row.get("prep_minutes"),
    )


async def fetch_chef_picks() -> list[RecipeCandidate]:
    return [_to_candidate(row) for row in await db.fetch_chef_recipes()]
