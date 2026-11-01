import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import cooked, profile, recipes, scan
from app.services.db import DatabaseError
from app.services.gemini import GeminiError

logger = logging.getLogger(__name__)

app = FastAPI(title="Foodiez API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan.router)
app.include_router(recipes.router)
app.include_router(profile.router)
app.include_router(cooked.router)


@app.exception_handler(GeminiError)
async def handle_gemini_error(_: Request, error: GeminiError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content={"detail": error.message})


@app.exception_handler(DatabaseError)
async def handle_database_error(_: Request, error: DatabaseError) -> JSONResponse:
    logger.warning("Database error: %s", error)
    return JSONResponse(
        status_code=503, content={"detail": "We could not reach the database. Please try again."}
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
