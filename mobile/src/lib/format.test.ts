import { describe, expect, it } from "vitest";

import { initials, inr } from "./format";

describe("inr", () => {
  it("groups the Indian way", () => {
    expect(inr(0)).toBe("0");
    expect(inr(999)).toBe("999");
    expect(inr(1000)).toBe("1,000");
    expect(inr(123456)).toBe("1,23,456");
    expect(inr(12345678)).toBe("1,23,45,678");
  });
  it("rounds and keeps the sign", () => {
    expect(inr(1234.6)).toBe("1,235");
    expect(inr(-123456)).toBe("-1,23,456");
  });
});

describe("initials", () => {
  it("takes the first and last name", () => {
    expect(initials("Priya Shah")).toBe("PS");
    expect(initials("  priya   ben  shah ")).toBe("PS");
    expect(initials("Neev")).toBe("N");
  });
  it("works in Gujarati and Hindi and with nothing", () => {
    expect(initials("નીરવ પટેલ")).toBe("નપ");
    expect(initials("प्रिया")).toBe("प");
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
