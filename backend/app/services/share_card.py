"""A shareable image of a citizen's real Mission LiFE impact (for WhatsApp, Instagram, etc.).

Only the first name and district are shown: no surname, email, ward or photos.
"""

import io

from PIL import Image, ImageDraw, ImageFont

BRAND = (31, 122, 77)
BRAND_DARK = (20, 92, 56)
SUN = (242, 178, 51)
WHITE = (255, 255, 255)
SIZE = (1080, 1080)


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


def render_card(
    first_name: str,
    district: str | None,
    co2_kg: float,
    km_not_driven: float,
    actions: int,
    streak_days: int,
    level_title: str,
    site: str,
) -> bytes:
    img = Image.new("RGB", SIZE, BRAND)
    d = ImageDraw.Draw(img)
    w, h = SIZE
    # Soft sun in the corner.
    d.ellipse([w - 360, -200, w + 160, 320], fill=SUN)
    d.rectangle([0, h - 230, w, h], fill=BRAND_DARK)

    x = 80
    d.text((x, 90), "Mission LiFE · Gujarat", font=_font(40), fill=(220, 240, 228))
    who = first_name + (f" from {district}" if district else "")
    d.text((x, 170), who, font=_font(64), fill=WHITE)
    d.text((x, 260), "has avoided", font=_font(48), fill=(220, 240, 228))
    # The bundled font has no subscript digits, so CO2 is written plainly.
    big = f"{co2_kg:.1f} kg CO2" if co2_kg < 1000 else f"{co2_kg / 1000:.2f} t CO2"
    d.text((x, 330), big, font=_font(150), fill=WHITE)
    d.text((x, 520), f"= {km_not_driven:,.0f} km not driven by car", font=_font(46), fill=(220, 240, 228))

    stats = [(str(actions), "green actions"), (f"{streak_days}", "day streak"), (level_title, "level")]
    for i, (value, label) in enumerate(stats):
        cx = x + i * 320
        d.rounded_rectangle([cx, 640, cx + 290, 800], radius=28, fill=BRAND_DARK)
        size = 58
        while size > 26 and d.textlength(value, font=_font(size)) > 240:  # fit long level names
            size -= 4
        d.text((cx + 28, 660 + (58 - size) // 2), value, font=_font(size), fill=WHITE)
        d.text((cx + 28, 740), label, font=_font(32), fill=(200, 228, 212))

    d.text((x, h - 190), "Small daily choices, measured.", font=_font(44), fill=WHITE)
    d.text((x, h - 120), f"Join me: {site}", font=_font(40), fill=SUN)

    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


def render_certificate(
    first_name: str, campaign: str, scope: str, my_actions: int, community_actions: int, target: int, dates: str
) -> bytes:
    """A certificate of participation. First name only."""
    img = Image.new("RGB", (1400, 990), (250, 252, 250))
    d = ImageDraw.Draw(img)
    w, h = img.size
    d.rectangle([30, 30, w - 30, h - 30], outline=BRAND, width=8)
    d.rectangle([52, 52, w - 52, h - 52], outline=SUN, width=3)
    d.text((w / 2, 150), "MISSION LiFE · GUJARAT", font=_font(44), fill=BRAND, anchor="mm")
    d.text((w / 2, 250), "Certificate of participation", font=_font(78), fill=(15, 42, 30), anchor="mm")
    d.text((w / 2, 360), "is proudly presented to", font=_font(40), fill=(88, 112, 100), anchor="mm")
    d.text((w / 2, 460), first_name, font=_font(110), fill=BRAND_DARK, anchor="mm")
    d.text((w / 2, 570), f'for taking part in "{campaign}"', font=_font(46), fill=(15, 42, 30), anchor="mm")
    d.text((w / 2, 635), f"{scope} · {dates}", font=_font(36), fill=(88, 112, 100), anchor="mm")
    reached = community_actions >= target
    d.text((w / 2, 730), f"{my_actions} green action{'s' if my_actions != 1 else ''} by you", font=_font(52), fill=BRAND, anchor="mm")
    d.text((w / 2, 800),
           f"The community did {community_actions:,} of {target:,}" + (" - target reached!" if reached else ""),
           font=_font(40), fill=(15, 42, 30), anchor="mm")
    d.text((w / 2, 900), "LiFEline · Gujarat Energy Development Agency", font=_font(32), fill=(88, 112, 100), anchor="mm")
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()
