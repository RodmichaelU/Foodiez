"""Load seed/ingredients.json and seed/chef_picks.json. Run from backend/: python -m scripts.seed"""

import json
from pathlib import Path
from typing import Any

from supabase import create_client

from app.config import get_settings

SEED_DIR = Path(__file__).resolve().parents[2] / "seed"


def load(filename: str) -> list[dict[str, Any]]:
    return json.loads((SEED_DIR / filename).read_text())


def main() -> None:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    ingredients = load("ingredients.json")
    client.table("ingredients").upsert(ingredients, on_conflict="canonical_name").execute()
    print(f"Seeded {len(ingredients)} ingredients")

    chef_picks = [{**recipe, "source": "chef"} for recipe in load("chef_picks.json")]
    client.table("recipes").upsert(chef_picks, on_conflict="source,external_id").execute()
    print(f"Seeded {len(chef_picks)} Chef's Picks")


if __name__ == "__main__":
    main()
