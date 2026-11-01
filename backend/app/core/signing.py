import hashlib
import hmac

from app.config import get_settings
from app.models import Recipe

# Fields that do not describe the recipe itself, plus the signature.
UNSIGNED_FIELDS = {"signature", "score", "have_count", "total_core", "missing", "match_known"}


def sign_recipe(recipe: Recipe) -> str:
    """Saved recipes are shared with other users, so only recipes this server produced may be saved."""
    payload = recipe.model_dump_json(exclude=UNSIGNED_FIELDS).encode()
    secret = get_settings().recipe_signing_secret.encode()
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()


def is_signature_valid(recipe: Recipe) -> bool:
    return hmac.compare_digest(sign_recipe(recipe), recipe.signature)
