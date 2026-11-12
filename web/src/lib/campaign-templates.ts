// Ready-made GEDA campaigns for Gujarat's festivals and seasons. A template only fills the form;
// staff can change anything before posting. Dates start today (India time) and run `days` days.

export interface CampaignTemplate {
  key: "diwali" | "uttarayan" | "summer" | "monsoon";
  action_code: string;
  days: number;
  target: number;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  { key: "diwali", action_code: "led_switch", days: 14, target: 500 },
  { key: "uttarayan", action_code: "shift_heavy_load", days: 3, target: 300 },
  { key: "summer", action_code: "ac_24", days: 7, target: 1000 },
  { key: "monsoon", action_code: "save_water", days: 7, target: 400 },
];

/** "2026-11-12" plus n days, in plain date arithmetic (no time zone can shift it). */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The form fields a template fills: the last day is `days - 1` after the first, inclusive. */
export function templateDates(tpl: CampaignTemplate, today: string): { starts_on: string; ends_on: string } {
  return { starts_on: today, ends_on: addDays(today, Math.max(1, tpl.days) - 1) };
}
