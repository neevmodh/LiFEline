import { describe, expect, it } from "vitest";

import { hourLabel, leadIsOpen, leadStepIndex, parseRoof, roofFromUrl, roofMeasureUrl, todaySeries, websiteBase } from "./solar-view";

describe("roof measurer links", () => {
  it("finds the website from the console address", () => {
    expect(websiteBase("https://nidhi-gujarat.vercel.app/geda")).toBe("https://nidhi-gujarat.vercel.app");
    expect(websiteBase("https://nidhi-gujarat.vercel.app/geda/")).toBe("https://nidhi-gujarat.vercel.app");
    expect(websiteBase(undefined)).toBe("https://nidhi-gujarat.vercel.app");
  });
  it("opens near the household and asks for the answer back", () => {
    const url = new URL(roofMeasureUrl("https://nidhi-gujarat.vercel.app", "nidhi://solar", 23.03, 72.58));
    expect(url.pathname).toBe("/roof");
    expect(url.searchParams.get("return")).toBe("nidhi://solar");
    expect(url.searchParams.get("lat")).toBe("23.03000");
    expect(new URL(roofMeasureUrl("https://x.example", "nidhi://solar")).searchParams.has("lat")).toBe(false);
  });
  it("reads only sensible areas back", () => {
    expect(roofFromUrl("nidhi://solar?roof=42")).toBe(42);
    expect(roofFromUrl("https://nidhi-app-rosy.vercel.app/solar?roof=41.6")).toBe(42);
    for (const bad of ["nidhi://solar", "nidhi://solar?roof=0", "nidhi://solar?roof=9999", "nidhi://solar?roof=abc", "", null, "not a url"]) {
      expect(roofFromUrl(bad)).toBeNull();
    }
    expect(parseRoof(["30", "40"])).toBe(30);
    expect(parseRoof(undefined)).toBeNull();
  });
});

describe("survey request steps", () => {
  it("orders the pipeline and knows when a request is finished", () => {
    expect(leadStepIndex("new")).toBe(0);
    expect(leadStepIndex("installed")).toBe(4);
    expect(leadStepIndex("dropped")).toBe(-1);
    expect(leadIsOpen("quoted")).toBe(true);
    expect(leadIsOpen("installed")).toBe(false);
    expect(leadIsOpen("dropped")).toBe(false);
    expect(leadIsOpen(null)).toBe(false);
  });
});

describe("today's output", () => {
  it("labels hours on a 12-hour clock", () => {
    expect([0, 9, 12, 13, 23, 24].map(hourLabel)).toEqual(["12 AM", "9 AM", "12 PM", "1 PM", "11 PM", "12 AM"]);
  });
  it("scales to the system, sorts the hours and drops nonsense", () => {
    expect(todaySeries({ "13": 0.7, "9": 0.3, "3": 0, "25": 1, x: 1 }, 3)).toEqual([
      { hour: 9, kwh: 0.9 },
      { hour: 13, kwh: 2.1 },
    ]);
    expect(todaySeries({ "12": 0.5 }, 0)).toEqual([{ hour: 12, kwh: 0.5 }]);
  });
});
