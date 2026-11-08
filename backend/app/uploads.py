import io
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
_PIL_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 50_000_000  # refuse decompression bombs


@dataclass(frozen=True)
class CheckedImage:
    data: bytes
    media_type: str  # from the decoded content, not the client's claim
    image: Image.Image


async def read_image(upload: UploadFile) -> CheckedImage:
    """Read an uploaded image, enforcing size limits and checking it really is a JPEG, PNG or WebP."""
    if (upload.content_type or "") not in IMAGE_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a JPEG, PNG or WebP image")
    data = await upload.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Image must be under 5 MB")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The image is empty")
    try:
        image = Image.open(io.BytesIO(data))
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Image dimensions are too large")
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "This file isn't a readable image") from exc
    media_type = _PIL_FORMATS.get(image.format or "")
    if media_type is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a JPEG, PNG or WebP image")
    lo, hi = image.convert("L").getextrema()
    if hi - lo < 8:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The photo is blank. Upload a real photo.")
    return CheckedImage(data, media_type, image)


# Copies of one photo (resized, re-compressed, re-shared) differ by a few bits;
# different photos differ by around 32.
NEAR_DUPLICATE_BITS = 4


def hash_distance(a: str, b: str) -> int:
    return (int(a, 16) ^ int(b, 16)).bit_count()


def hash_chunks(h: str) -> list[str]:
    """The hash in four 16-bit chunks. Two hashes within 3 bits share at least one chunk
    exactly (pigeonhole), so the database can narrow candidates by plain string equality."""
    return [h[i : i + 4] for i in range(0, 16, 4)]


def difference_hash(image: Image.Image) -> str:
    """64-bit perceptual hash (dHash) as 16 hex characters.

    Shrinks the picture to 9x8 greyscale and records whether each pixel is brighter
    than its right-hand neighbour. Re-compressing, resizing or re-sharing the same
    photo gives the same (or a nearly identical) hash, unlike a byte-for-byte checksum.
    """
    small = ImageOps.exif_transpose(image).convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(small.get_flattened_data())
    bits = 0
    for row in range(8):
        for col in range(8):
            left, right = pixels[row * 9 + col], pixels[row * 9 + col + 1]
            bits = (bits << 1) | (left > right)
    return f"{bits:016x}"
