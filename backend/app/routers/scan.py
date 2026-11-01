import logging
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile

from app.core import normalize
from app.core.auth import get_current_user
from app.core.rate_limit import scan_limiter
from app.models import DetectedIngredient, GeminiDetection, ScanResponse
from app.services import db, gemini

logger = logging.getLogger(__name__)

MAX_IMAGES = 3
MAX_IMAGE_BYTES = 10 * 1024 * 1024
LOW_CONFIDENCE_BELOW = 0.5
JPEG_SIGNATURE = b"\xff\xd8\xff"

router = APIRouter()


async def read_jpeg(image: UploadFile) -> bytes:
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(400, "One of the photos was empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "One of the photos is too large.")
    # Check the file itself: the declared content type depends on the client.
    if not data.startswith(JPEG_SIGNATURE):
        raise HTTPException(400, "Photos must be JPEG images.")
    return data


def _prepare(detections: list[GeminiDetection]) -> list[DetectedIngredient]:
    """Normalize names and keep the most confident detection of each ingredient."""
    best: dict[str, GeminiDetection] = {}
    for item in detections:
        canonical_name = normalize.normalize(item.canonical_name or item.name)
        if canonical_name and (
            canonical_name not in best or item.confidence > best[canonical_name].confidence
        ):
            best[canonical_name] = item.model_copy(update={"canonical_name": canonical_name})

    return [
        DetectedIngredient(**item.model_dump(), low_confidence=item.confidence < LOW_CONFIDENCE_BELOW)
        for item in sorted(best.values(), key=lambda item: item.confidence, reverse=True)
    ]


async def _upload_scan_photos(folder: str, photos: list[bytes]) -> None:
    for index, photo in enumerate(photos):
        try:
            await db.upload_photo(db.SCAN_PHOTOS_BUCKET, f"{folder}/{index}.jpg", photo)
        except db.DatabaseError as error:
            logger.warning("Could not store scan photo: %s", error)


async def save_confirmed_ingredients(scan_id: str, user_id: str, confirmed: list[str]) -> None:
    try:
        await db.update_scan_confirmed(scan_id, user_id, confirmed)
    except db.DatabaseError as error:
        logger.warning("Could not update scan: %s", error)


@router.post("/scan")
async def scan(
    background_tasks: BackgroundTasks,
    images: list[UploadFile] = File(...),
    user_id: str = Depends(get_current_user),
) -> ScanResponse:
    if len(images) > MAX_IMAGES:
        raise HTTPException(400, f"Please send at most {MAX_IMAGES} photos.")
    photos = [await read_jpeg(image) for image in images]

    limit_message = scan_limiter.check(user_id)
    if limit_message:
        raise HTTPException(429, limit_message)

    await normalize.refresh_ingredients()
    detections = await gemini.detect_ingredients(photos, normalize.known_names())
    ingredients = _prepare(detections)

    scan_id = str(uuid4())
    folder = f"{user_id}/{scan_id}"
    # History must not cost the user their results, so storing is best effort. Photos upload
    # after the response, which keeps them out of the time the user spends waiting.
    try:
        await db.insert_scan(
            {
                "id": scan_id,
                "user_id": user_id,
                "photo_url": f"{folder}/0.jpg",
                "detected_ingredients": [item.model_dump() for item in ingredients],
            }
        )
    except db.DatabaseError as error:
        logger.warning("Could not store scan: %s", error)
    background_tasks.add_task(_upload_scan_photos, folder, photos)

    return ScanResponse(scan_id=scan_id, ingredients=ingredients)
