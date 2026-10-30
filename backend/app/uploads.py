from fastapi import HTTPException, UploadFile, status

IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


async def read_image(upload: UploadFile) -> tuple[bytes, str]:
    """Read an uploaded image, enforcing type and size limits. Returns (data, media_type)."""
    media_type = upload.content_type or ""
    if media_type not in IMAGE_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a JPEG, PNG or WebP image")
    data = await upload.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Image must be under 5 MB")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The image is empty")
    return data, media_type
