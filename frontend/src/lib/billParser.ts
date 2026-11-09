// Extract consumption figures from OCR text of an Indian electricity bill.
// OCR output is noisy, so every rule looks for a labelled number and rejects implausible values.

export interface ParsedBill {
  unitsKwh: number | null;
  billingDays: number | null;
  amountRs: number | null;
  /** Units normalised to a 30-day month (many Gujarat bills are bi-monthly). */
  monthlyKwh: number | null;
  /** How the units were found: a labelled total, or current minus previous meter reading. */
  method: "label" | "readings" | null;
}

const MAX_UNITS = 5000;

function num(s: string): number {
  return Number(s.replace(/,/g, ""));
}

// Gujarati and Hindi digits, which some bills print, to ASCII.
const INDIC_DIGITS: Record<string, string> = Object.fromEntries(
  [..."૦૧૨૩૪૫૬૭૮૯", ..."०१२३४५६७८९"].map((d, i) => [d, String(i % 10)]),
);

function normalise(text: string): string {
  return text
    .toUpperCase()
    .replace(/[૦-૯०-९]/g, (d) => INDIC_DIGITS[d])
    .replace(/[|]/g, " ")
    .replace(/(?<=\d)[OQ]|[OQ](?=\d)/g, "0") // OCR reads 0 as the letter O
    .replace(/(?<=\d)[Il]|[Il](?=\d{2})/g, "1") // and 1 as I or l
    .replace(/(\d),(\d{3})/g, "$1$2") // 1,234 -> 1234
    .replace(/[ \t]+/g, " ");
}

// Labels in English, Gujarati and Hindi, as printed by Gujarat's DISCOMs and Torrent Power.
const UNITS_LABEL = "(?:UNITS?|KWH|^CONSUMED|^CONSUMPTION|વપરાશ\\s*યુનિટ|વપરાશ|યુનિટ|यूनिट|खपत)";
const NUMBER = "(\\d{1,5}(?:\\.\\d+)?)";

function findUnits(lines: string[]): number | null {
  // Strongest signal first: lines that say both "units"/"kwh" and "consumed"/"billed"/"total".
  const labelled = [
    /(?:TOTAL|NET|BILLED)?\s*(?:UNITS?|KWH)\s*(?:CONSUMED|CONSUMPTION|BILLED)\s*(?:\(KWH\))?\s*[:\-=]?\s*(\d{1,5}(?:\.\d+)?)/,
    /(?:CONSUMPTION|UNITS? CONSUMED|ENERGY CONSUMED|BILLED UNITS?|TOTAL UNITS?)\s*(?:\(KWH\)|IN KWH|KWH)?\s*[:\-=]?\s*(\d{1,5}(?:\.\d+)?)/,
    // A bare label with a separator: "Units: 190", "વપરાશ યુનિટ: 280", "खपत (यूनिट): 150".
    new RegExp(`${UNITS_LABEL}\\s*(?:\\((?:KWH|यूनिट|યુનિટ)\\))?\\s*(?:USED|CONSUMED)?\\s*[:=\\-]\\s*${NUMBER}`),
    /(\d{1,5}(?:\.\d+)?)\s*(?:UNITS|KWH)\b/,
  ];
  for (const pattern of labelled) {
    for (const line of lines) {
      const m = line.match(pattern);
      if (m) {
        const v = num(m[1]);
        if (v > 0 && v <= MAX_UNITS) return v;
      }
    }
  }
  return null;
}

function findReadingDifference(text: string): number | null {
  const current =
    text.match(/(?:PRESENT|PRES\.?|CURRENT|CURR\.?|CLOSING|FINAL)\s*(?:METER\s*)?(?:READING|RDG\.?)\s*[:\-=]?\s*(\d{3,8})/) ??
    text.match(/(?:\bNEW(?:\s*READ)?|\bCURR|\bPRESENT|વર્તમાન\s*રીડિંગ|હાલનું\s*રીડિંગ|चालू\s*रीडिंग)\s*[:\-=]\s*(\d{3,8})/);
  const previous =
    text.match(/(?:PREVIOUS|PREV\.?|PAST|OPENING|INITIAL)\s*(?:METER\s*)?(?:READING|RDG\.?)\s*[:\-=]?\s*(\d{3,8})/) ??
    text.match(/(?:\bOLD(?:\s*READ)?|\bPREV|\bPREVIOUS|અગાઉનું\s*રીડિંગ|પાછલું\s*રીડિંગ|पिछली\s*रीडिंग)\s*[:\-=]\s*(\d{3,8})/);
  if (!current || !previous) return null;
  const diff = num(current[1]) - num(previous[1]);
  return diff > 0 && diff <= MAX_UNITS ? diff : null;
}

function parseDate(d: string, m: string, y: string): Date | null {
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(d) ? null : date;
}

function findBillingDays(text: string): number | null {
  const explicit =
    text.match(/(?:BILLING|BILL|NO\.? OF)?\s*(?:DAYS|દિવસો|દિવસ|दिन)\s*[:\-=]?\s*(\d{2,3})\b/) ??
    text.match(/\b(\d{2,3})\s*(?:DAYS|દિવસ|दिन)/);
  if (explicit) {
    const days = Number(explicit[1]);
    if (days >= 20 && days <= 70) return days;
  }
  // A period such as "01/07/2026 TO 31/08/2026".
  const range = text.match(
    /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\s*(?:TO|-|–)\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/,
  );
  if (range) {
    const from = parseDate(range[1], range[2], range[3]);
    const to = parseDate(range[4], range[5], range[6]);
    if (from && to) {
      const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      if (days >= 20 && days <= 70) return days;
    }
  }
  return null;
}

function findAmount(lines: string[]): number | null {
  const money = "\\s*(?:\\(RS\\.?\\)|RS\\.?|₹|INR)?\\s*[:\\-=]?\\s*(?:RS\\.?|₹|INR)?\\s*(\\d{1,7}(?:\\.\\d{1,2})?)";
  const patterns = [
    // Explicit payable totals first.
    new RegExp(
      `(?:NET AMOUNT PAYABLE|AMOUNT PAYABLE|TOTAL AMOUNT|BILL AMOUNT|NET PAYABLE|TOTAL PAYABLE|PAYABLE AMOUNT|AMOUNT DUE|TOTAL DUE|NET AMT\\.?|NET AMOUNT|કુલ\\s*રકમ|ચૂકવવાપાત્ર\\s*રકમ|ભરવાપાત્ર\\s*રકમ|कुल\\s*राशि|देय\\s*राशि)${money}`,
    ),
    // Then a line that is just "Net: 1381.20" or "Total: 2130", but not "Total units".
    new RegExp(`^(?:NET|TOTAL|AMOUNT|AMT\\.?)(?!\\s*(?:UNIT|KWH))${money}`),
  ];
  for (const pattern of patterns) {
    for (const line of lines) {
      const m = line.match(pattern);
      if (m) return num(m[1]);
    }
  }
  return null;
}

export function parseBillText(raw: string): ParsedBill {
  const text = normalise(raw);
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  let unitsKwh = findUnits(lines);
  let method: ParsedBill["method"] = unitsKwh !== null ? "label" : null;
  if (unitsKwh === null) {
    unitsKwh = findReadingDifference(text);
    if (unitsKwh !== null) method = "readings";
  }
  const billingDays = findBillingDays(text);
  const monthlyKwh =
    unitsKwh === null ? null : billingDays ? Math.round((unitsKwh * 30 * 10) / billingDays) / 10 : unitsKwh;

  return { unitsKwh, billingDays, amountRs: findAmount(lines), monthlyKwh, method };
}
