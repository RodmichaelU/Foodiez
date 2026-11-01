import hashlib

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase_auth.errors import AuthApiError

from app.core.cache import TTLCache
from app.services import db

# Validating a token is a network call to Supabase. A short cache keeps every request from
# paying for it, at the cost of a revoked token working for up to a minute.
TOKEN_CACHE_SECONDS = 60

_bearer = HTTPBearer(auto_error=False)
token_cache: TTLCache[str, str] = TTLCache(TOKEN_CACHE_SECONDS)


async def _validate_token(token: str) -> str | None:
    client = await db.get_client()
    response = await db.run(client.auth.get_user(token))
    return response.user.id if response and response.user else None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    if credentials is None:
        raise HTTPException(401, "Please log in again.")

    key = hashlib.sha256(credentials.credentials.encode()).hexdigest()
    user_id = token_cache.get(key)
    if user_id is not None:
        return user_id

    try:
        user_id = await _validate_token(credentials.credentials)
    except db.DatabaseError as error:
        if isinstance(error.__cause__, AuthApiError):
            raise HTTPException(401, "Please log in again.") from error
        raise

    if user_id is None:
        raise HTTPException(401, "Please log in again.")
    token_cache.set(key, user_id)
    return user_id
