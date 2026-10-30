import { describe, expect, it } from "vitest";
import { parseBillText } from "./billParser";

describe("parseBillText", () => {
  it("reads labelled units, billing days and amount from a bi-monthly bill", () => {
    const text = `DAKSHIN GUJARAT VIJ COMPANY LTD
      Consumer No: 12345678901
      Bill Period 01/07/2026 To 30/08/2026
      Billing Days : 61
      Present Reading 14520   Previous Reading 13980
      Units Consumed : 540
      Net Amount Payable Rs. 4,215.50`;
    const bill = parseBillText(text);
    expect(bill.unitsKwh).toBe(540);
    expect(bill.method).toBe("label");
    expect(bill.billingDays).toBe(61);
    expect(bill.amountRs).toBe(4215.5);
    expect(bill.monthlyKwh).toBe(265.6);
  });

  it("falls back to the meter reading difference when no total is printed", () => {
    const bill = parseBillText("CURRENT READING: 08812\nPREVIOUS READING: 08560\nAmount payable 1890");
    expect(bill.unitsKwh).toBe(252);
    expect(bill.method).toBe("readings");
    expect(bill.monthlyKwh).toBe(252);
  });

  it("derives billing days from a date range", () => {
    const bill = parseBillText("Period 05-06-26 to 04-08-26\nTotal Units 410");
    expect(bill.billingDays).toBe(61);
    expect(bill.monthlyKwh).toBe(201.6);
  });

  it("handles OCR noise like thousands separators and pipes", () => {
    const bill = parseBillText("| Energy Consumed (kWh) | 1,120 |\n| Bill Amount | 9,870.00 |");
    expect(bill.unitsKwh).toBe(1120);
    expect(bill.amountRs).toBe(9870);
  });

  it("rejects implausible values and returns nulls for non-bills", () => {
    expect(parseBillText("Units consumed 99999").unitsKwh).toBeNull();
    const nothing = parseBillText("Grocery list: milk, eggs, bread");
    expect(nothing).toEqual({ unitsKwh: null, billingDays: null, amountRs: null, monthlyKwh: null, method: null });
  });

  it("ignores reading pairs that go backwards", () => {
    expect(parseBillText("Present reading 1000 Previous reading 2000").unitsKwh).toBeNull();
  });
});
