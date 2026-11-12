"""Ask Nidhi: short answers to a household's own energy questions, in English, Gujarati or Hindi.

Every number comes from this household's data (its bill, slabs, plan and appliances) and the
factors Nidhi already publishes. An AI model may phrase the answer, but it is used only when every
number in it is one of those facts and any action it suggests is in the catalogue; otherwise, with
no AI key, or in Gujarati and Hindi (reviewed wording beats the model's), the answer is a template
for the question's topic, filled with the same facts.
"""

import json
import logging
import re
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.i18n import tr
from app.services import factors
from app.services.bill_scan import GROQ_URL
from app.services.coach import LANGUAGE, numbers_ok
from app.services.footprint import electricity_bill_rs
from app.services.plan import HouseholdLike, build_plan, marginal_rate

log = logging.getLogger(__name__)

# Topic words in English, Gujarati and Hindi. The first topic that matches wins.
TOPICS: list[tuple[str, tuple[str, ...]]] = [
    ("solar", ("solar", "rooftop", "panel", "surya", "સોલર", "સૌર", "સૂર્ય", "सोलर", "सौर", "सूर्य")),
    ("geyser", ("geyser", "water heater", "hot water", "bath", "ગીઝર", "ગરમ પાણી", "गीज़र", "गीजर", "गरम पानी")),
    ("ac", ("ac", "a/c", "air condition", "cooling", "temperature", "એસી", "ઠંડ", "તાપમાન", "एसी", "ठंड", "तापमान")),
    ("peak", ("peak", "washing", "laundry", "when should", "what time", "evening", "ev ", "charging",
              "પીક", "સાંજ", "વૉશિંગ", "ધોવ", "ક્યારે", "पीक", "शाम", "वॉशिंग", "कपड़े", "कब")),
    ("led", ("led", "bulb", "light", "lamp", "બલ્બ", "લાઇટ", "बल्ब", "लाइट", "एलईडी")),
    ("standby", ("standby", "plug", "tv", "charger", "set-top", "સ્ટેન્ડબાય", "પ્લગ", "ટીવી", "स्टैंडबाय", "प्लग", "टीवी")),
    ("water", ("water", "leak", "tap", "પાણી", "નળ", "पानी", "नल")),
    ("travel", ("car", "bus", "metro", "travel", "commute", "cycle", "walk", "કાર", "બસ", "મેટ્રો", "મુસાફરી", "कार", "बस", "मेट्रो", "सफ़र", "सफर")),
    ("bill", ("bill", "unit", "slab", "tariff", "price", "cost", "high", "expensive", "rupee", "₹",
              "બિલ", "યુનિટ", "સ્લેબ", "ભાવ", "મોંઘ", "बिल", "यूनिट", "स्लैब", "भाव", "महँग", "महंग")),
]

ACTIONS = {
    "ac": "ac_24", "geyser": "geyser_off", "solar": "solar_survey", "peak": "shift_heavy_load", "led": "led_switch",
    "standby": "standby_off", "water": "save_water", "travel": "public_transport",
}
CATALOGUE = frozenset({*ACTIONS.values(), "cycle_walk", "carpool", "pressure_cooker", "cloth_bag"})


def topic_of(question: str) -> str:
    q = f" {question.lower()} "
    for topic, words in TOPICS:
        for w in words:
            # Short Latin words ("ac", "tv", "led") must stand alone, so "back" isn't about the AC.
            if w.isascii() and len(w) <= 3:
                if re.search(rf"(?<![a-z]){re.escape(w)}(?![a-z])", q):
                    return topic
            elif w in q:
                return topic
    return "general"


@dataclass(frozen=True)
class Answer:
    text: str
    action_code: str | None
    written_by_ai: bool
    topic: str


def household_facts(h: HouseholdLike, kwh_per_kwp_year: float) -> dict[str, float | int]:
    """The only numbers an answer may contain."""
    plan = build_plan(h)
    rs = {item.code: item.rs_month for item in plan.items}
    roof_kw = (h.roof_area_sqm or 0) / factors.SQM_PER_KWP
    need_kw = h.monthly_kwh * 12 / kwh_per_kwp_year if kwh_per_kwp_year else 0
    solar_kw = round(min(roof_kw, need_kw) * 2) / 2 if roof_kw else 0
    facts: dict[str, float | int] = {
        "kwh": round(h.monthly_kwh),
        "bill_rs": round(electricity_bill_rs(h.monthly_kwh, h.discom, h.area)),
        "rate": round(marginal_rate(h), 2),
        "acs": h.ac_count,
        "ac_rs": round(rs.get("ac_setpoint", 0)),
        "geyser_rs": round(rs.get("geyser_timer", 0)),
        "standby_rs": round(rs.get("standby", 0)),
        "led_rs": round(rs.get("led", 0)),
        "solar_kw": solar_kw,
        "solar_kwh": round(solar_kw * kwh_per_kwp_year / 12),
        "peak_from": factors.PEAK_HOURS[0],
        "peak_to": factors.PEAK_HOURS[1],
        "sun_from": factors.SOLAR_HOURS[0],
        "sun_to": factors.SOLAR_HOURS[1],
        # Constants the advice itself uses, so an AI answer may repeat them.
        "ac_target": 24,
        "ac_common": 22,
        "ac_pct": round(factors.AC_SAVING_PER_DEGREE * 100),
        "bulb_w": 60,
        "led_w": 9,
    }
    if plan.slab:
        facts["slab_units"] = round(plan.slab.units_over)
        facts["slab_rs"] = round(plan.slab.rs_if_cut)
    return facts


def template_answer(topic: str, h: HouseholdLike, facts: dict, locale: str) -> tuple[str, str | None]:
    f = {k: (f"{v:,}" if isinstance(v, int) and v >= 1000 else v) for k, v in facts.items()}
    if topic == "ac" and not h.ac_count:
        return tr(locale, "ask.ac_none"), None
    if topic == "geyser" and not h.has_geyser:
        return tr(locale, "ask.geyser_none"), None
    if topic == "solar":
        if h.has_solar:
            return tr(locale, "ask.solar_has", **f), "shift_heavy_load"
        if not facts["solar_kw"]:
            return tr(locale, "ask.solar_noroof"), "solar_survey"
    if topic == "bill":
        text = tr(locale, "ask.bill", **f)
        if "slab_units" in facts:
            text += " " + tr(locale, "ask.bill_slab", **f)
        best = max(("ac_setpoint", "geyser_timer", "standby", "led"), key=lambda c: facts.get(_RS_KEY[c], 0))
        return text, _PLAN_ACTION[best]
    if topic == "travel" and h.commute_mode in ("cycle_walk", "bus", "metro"):
        return tr(locale, "ask.travel_green"), "cycle_walk"
    action = ACTIONS.get(topic)
    if topic == "peak" and not (h.has_washing_machine or h.has_geyser or h.has_ev):
        action = None
    return tr(locale, f"ask.{topic}", **f), action


_RS_KEY = {"ac_setpoint": "ac_rs", "geyser_timer": "geyser_rs", "standby": "standby_rs", "led": "led_rs"}
_PLAN_ACTION = {"ac_setpoint": "ac_24", "geyser_timer": "geyser_off", "standby": "standby_off", "led": "led_switch"}


async def _ask_llm(question: str, facts: dict, locale: str) -> tuple[str, str | None]:
    settings = get_settings()
    codes = sorted(CATALOGUE)
    prompt = (
        "You are Nidhi, a friendly energy coach for households in Gujarat, India (Mission LiFE). "
        f"Answer in {LANGUAGE.get(locale, 'English')}, in at most three short sentences, about this household. "
        "Use ONLY these facts about it and no other numbers; write numbers with ASCII digits exactly as given; "
        "money is in rupees (₹), energy in units (kWh). If the question is not about saving electricity, water, "
        "money on the bill, rooftop solar or green habits, say briefly that you can only help with those. "
        f"Set action_code to the one action from {codes} that best fits, or null.\n"
        f"Facts: {json.dumps(facts, ensure_ascii=False)}\nQuestion: {question}"
    )
    body = {
        "model": settings.groq_model,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_schema", "json_schema": {
            "name": "answer", "strict": True,
            "schema": {"type": "object", "properties": {
                "answer": {"type": "string"},
                "action_code": {"type": ["string", "null"], "enum": [*codes, None]},
            }, "required": ["answer", "action_code"], "additionalProperties": False}}},
        "max_completion_tokens": 400,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(GROQ_URL, json=body, headers={"Authorization": f"Bearer {settings.groq_api_key}"})
    resp.raise_for_status()
    out = json.loads(resp.json()["choices"][0]["message"]["content"])
    return str(out["answer"]).strip(), out.get("action_code")


async def answer(question: str, h: HouseholdLike, kwh_per_kwp_year: float, locale: str) -> Answer:
    topic = topic_of(question)
    facts = household_facts(h, kwh_per_kwp_year)
    settings = get_settings()
    # The model's Gujarati and Hindi read like machine translation, so those languages get the
    # hand-written answers; the model only phrases English.
    if locale == "en" and settings.groq_api_key and settings.enable_external_apis:
        try:
            text, code = await _ask_llm(question, facts, locale)
            if text and numbers_ok(text, facts) and (code is None or code in CATALOGUE):
                return Answer(text, code, True, topic)
            log.info("Ask answer rejected: a number or action not in its input")
        except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
            log.warning("Ask model unavailable: %s", exc)
    text, code = template_answer(topic, h, facts, locale)
    return Answer(text, code, False, topic)
