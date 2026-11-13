"""The checks that decide whether a Sarvam re-translation may replace today's catalogue string."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from translate_with_sarvam import glossary, problems  # noqa: E402


def test_a_good_translation_passes():
    assert problems("gu", "You used {units} units", "તમે {units} યુનિટ વાપર્યા", "તમે {units} યુનિટ વાપર્યા છે") == []


def test_lost_placeholders_numbers_script_or_brand_names_keep_todays_text():
    assert "placeholders changed" in problems("gu", "You used {units} units", "તમે યુનિટ વાપર્યા", None)
    assert "numbers changed" in problems("hi", "AC at 24°C", "AC 25°C पर", None)
    assert "not in the right script" in problems("gu", "Home", "होम", None)
    assert "lost GEDA" in problems("gu", "GEDA checks it", "જીઈડીએ તપાસે છે", "GEDA તપાસે છે")
    # A brand name today's translation already writes in Gujarati script isn't held against Sarvam.
    assert problems("gu", "GEDA checks it", "જીઈડીએ તપાસે છે", "જીઈડીએ તપાસ કરે છે") == []


def test_the_glossary_word_for_points():
    assert glossary("gu", "+6 points", "+6 પોઈન્ટ્સ") == "+6 પોઇન્ટ"
    assert glossary("hi", "+6 points", "+6 पॉइंट्स") == "+6 अंक"
    assert glossary("gu", "Home", "હોમ") == "હોમ"  # only strings about points change
    assert "glossary: points" in problems("gu", "Your points", "તમારા ગુણ", None)


def test_re_capitalised_placeholders_are_put_back():
    from translate_with_sarvam import fix_placeholders

    assert fix_placeholders("+{points} points for \"{title}\"", "\"{Title}\" માટે +{Points}") == "\"{title}\" માટે +{points}"


def test_a_translation_that_leaves_more_english_is_kept_out():
    why = problems("gu", "Pick an action above to get started.", "Start કરવા માટે ઉપર action pick કરો.",
                   "શરૂઆત કરવા માટે ઉપરથી કોઈ ક્રિયા પસંદ કરો.")
    assert "more English words than today" in why
    # Brand and unit names don't count as English left behind.
    assert problems("gu", "GEDA saves kWh", "GEDA kWh બચાવે છે", "GEDA kWh બચાવે") == []
