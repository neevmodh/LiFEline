"""A shareable image of a citizen's real Mission LiFE impact (for WhatsApp, Instagram, etc.).

Only the first name and district are shown: no surname, email, ward or photos.
"""

import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).resolve().parent.parent / "assets"

# The certificate keeps its own colours; the share card uses the app's paper design.
BRAND = (31, 122, 77)
BRAND_DARK = (20, 92, 56)
SUN = (242, 178, 51)
WHITE = (255, 255, 255)
SIZE = (1080, 1080)

PAPER = (246, 242, 234)
CARD = (255, 253, 248)
INK = (35, 49, 42)
MUTED = (95, 107, 99)
SAGE = (78, 125, 94)
SAGE_SOFT = (230, 238, 223)
SAFFRON = (201, 135, 62)
SAFFRON_LIGHT = (233, 184, 114)
BORDER = (231, 224, 211)

# Journey stages, as the app names them (levels 1 to 5).
STAGES = ("Seed", "Sprout", "Sapling", "Tree", "Grove")


def _font(size: int, face: str = "") -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Bricolage Grotesque or Inter, as in the app; the built-in font if the files are missing."""
    files = {"display": "BricolageGrotesque_700Bold.ttf", "body": "Inter_400Regular.ttf", "bold": "Inter_600SemiBold.ttf"}
    path = ASSETS / "fonts" / files.get(face, "")
    if face and path.is_file():
        return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


def stage_name(level: int) -> str:
    return STAGES[max(1, min(len(STAGES), level)) - 1]


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
    """1080x1080 on the app's paper: logo, who, kg CO₂ avoided, three tiles, and an invitation."""
    img = Image.new("RGB", SIZE, PAPER)
    d = ImageDraw.Draw(img)
    w, h = SIZE
    # A soft sun rising in the corner, like the app's welcome screen.
    d.ellipse([w - 330, -230, w + 130, 230], fill=(245, 222, 186))
    d.ellipse([w - 250, -150, w + 50, 150], fill=SAFFRON_LIGHT)

    x = 80
    logo_path = ASSETS / "logo.png"
    if logo_path.is_file():
        logo = Image.open(logo_path).convert("RGBA")
        logo.thumbnail((116, 116))
        img.paste(logo, (x - 8, 64), logo)
    d.text((x + 120, 82), "Nidhi", font=_font(54, "display"), fill=INK)
    d.text((x + 122, 146), "Mission LiFE · Gujarat", font=_font(30, "body"), fill=MUTED)

    who = first_name + (f" from {district}" if district else "")
    size = 66
    while size > 40 and d.textlength(who, font=_font(size, "display")) > w - 2 * x:
        size -= 4
    d.text((x, 250), who, font=_font(size, "display"), fill=INK)
    d.text((x, 336), "has avoided", font=_font(42, "body"), fill=MUTED)
    number = f"{co2_kg:.1f}" if co2_kg < 1000 else f"{co2_kg / 1000:.2f}"
    unit = " kg CO₂" if co2_kg < 1000 else " t CO₂"
    big = _font(156, "display")
    d.text((x, 384), number, font=big, fill=SAGE)
    d.text((x + d.textlength(number, font=big) + 6, 470), unit, font=_font(64, "bold"), fill=SAGE)
    d.text((x, 590), f"= {km_not_driven:,.0f} km not driven by car", font=_font(38, "body"), fill=MUTED)

    stats = [(f"{actions:,}", "green actions"), (str(streak_days), "day streak"), (level_title, "on the journey")]
    tile_w = (w - 2 * x - 2 * 28) // 3
    for i, (value, label) in enumerate(stats):
        cx = x + i * (tile_w + 28)
        d.rounded_rectangle([cx, 670, cx + tile_w, 820], radius=30, fill=CARD, outline=BORDER, width=2)
        fs = 60
        while fs > 30 and d.textlength(value, font=_font(fs, "display")) > tile_w - 50:
            fs -= 4
        d.text((cx + 28, 690 + (60 - fs) // 2), value, font=_font(fs, "display"), fill=SAFFRON if i == 2 else INK)
        d.text((cx + 28, 768), label, font=_font(28, "body"), fill=MUTED)

    d.rectangle([0, h - 190, w, h], fill=INK)
    d.text((x, h - 160), "Small choices. Real savings.", font=_font(44, "display"), fill=PAPER)
    d.text((x, h - 92), f"Join me on Nidhi · {site}", font=_font(32, "bold"), fill=SAFFRON_LIGHT)

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
    d.text((w / 2, 900), "Nidhi · Gujarat Energy Development Agency", font=_font(32), fill=(88, 112, 100), anchor="mm")
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()
