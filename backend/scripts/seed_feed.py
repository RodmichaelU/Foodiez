"""Give the feed sample posts so it is never empty. Safe to re-run. From backend/: python -m scripts.seed_feed"""

import secrets

from supabase import create_client

from app.config import get_settings

AUTHOR_EMAIL = "foodiez-kitchen@foodiez.invalid"
AUTHOR_NAME = "Foodiez Kitchen"
CAPTIONS = {
    "tomato-egg-skillet": "Our go-to when the fridge is nearly empty.",
    "garlic-butter-chicken-rice": "One pan, thirty minutes, no leftovers.",
    "spinach-cheddar-omelette": "Breakfast in ten minutes.",
}


def main() -> None:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    existing = [user for user in client.auth.admin.list_users() if user.email == AUTHOR_EMAIL]
    if existing:
        user_id = existing[0].id
    else:
        # Nobody logs in to this account, so its password is random and never kept.
        created = client.auth.admin.create_user(
            {"email": AUTHOR_EMAIL, "password": secrets.token_urlsafe(32), "email_confirm": True}
        )
        user_id = created.user.id

    client.table("profiles").upsert({"id": user_id, "display_name": AUTHOR_NAME}).execute()

    posted = client.table("cooked").select("recipe_id").eq("user_id", user_id).execute().data
    posted_ids = {row["recipe_id"] for row in posted}
    recipes = client.table("recipes").select("id, external_id").eq("source", "chef").execute().data

    new_rows = [
        {
            "user_id": user_id,
            "recipe_id": recipe["id"],
            "caption": CAPTIONS.get(recipe["external_id"]),
            "is_public": True,
        }
        for recipe in recipes
        if recipe["id"] not in posted_ids
    ]
    if new_rows:
        client.table("cooked").insert(new_rows).execute()
    print(f"Added {len(new_rows)} sample posts")


if __name__ == "__main__":
    main()
