from app.core.normalize import clean_name
from app.models import Recipe, RecipesResponse

CHEF_PICK_MIN_SCORE = 0.7

# When two sources offer the same dish, the higher-priority source wins.
SOURCE_PRIORITY = {"chef": 0, "online": 1, "ai": 2}


def _deduplicate(recipes: list[Recipe]) -> list[Recipe]:
    seen: set[str] = set()
    unique: list[Recipe] = []
    for recipe in sorted(recipes, key=lambda recipe: SOURCE_PRIORITY[recipe.source]):
        title = clean_name(recipe.title)
        if title not in seen:
            seen.add(title)
            unique.append(recipe)
    return unique


def merge_recipes(recipes: list[Recipe]) -> RecipesResponse:
    # Chef's Picks below the threshold are dropped: they have no section of their own.
    eligible = [
        recipe
        for recipe in recipes
        if recipe.source != "chef" or recipe.score >= CHEF_PICK_MIN_SCORE
    ]
    ranked = sorted(_deduplicate(eligible), key=lambda recipe: recipe.score, reverse=True)
    return RecipesResponse(
        chef_picks=[recipe for recipe in ranked if recipe.source == "chef"],
        online=[recipe for recipe in ranked if recipe.source == "online"],
        ai=[recipe for recipe in ranked if recipe.source == "ai"],
    )
