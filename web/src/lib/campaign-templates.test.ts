import { describe, expect, it } from "vitest";

import { addDays, CAMPAIGN_TEMPLATES, templateDates } from "./campaign-templates";

describe("campaign templates", () => {
  it("cover four seasons with real catalogue actions and positive targets", () => {
    expect(CAMPAIGN_TEMPLATES.map((t) => t.key)).toEqual(["diwali", "uttarayan", "summer", "monsoon"]);
    for (const t of CAMPAIGN_TEMPLATES) {
      expect(t.target).toBeGreaterThan(0);
      expect(["led_switch", "shift_heavy_load", "ac_24", "save_water"]).toContain(t.action_code);
    }
  });

  it("run the right number of days, inclusive", () => {
    const diwali = CAMPAIGN_TEMPLATES[0];
    expect(templateDates(diwali, "2026-11-12")).toEqual({ starts_on: "2026-11-12", ends_on: "2026-11-25" });
    expect(templateDates({ ...diwali, days: 1 }, "2026-11-12").ends_on).toBe("2026-11-12");
    expect(templateDates({ ...diwali, days: 0 }, "2026-11-12").ends_on).toBe("2026-11-12");
  });

  it("cross month and year ends and leap days", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });
});
