// The API host sleeps when idle, so the first request of the day can fail before it wakes. Reads and
// sign-in are retried after a network failure; nothing that could be recorded twice is.
import { afterEach, describe, expect, it, vi } from "vitest";

import { canRetry, fetchWithWakeUp } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("canRetry", () => {
  it("retries reads and sign-in only", () => {
    expect(canRetry("/api/districts", {})).toBe(true);
    expect(canRetry("/api/districts", { method: "get" })).toBe(true);
    expect(canRetry("/api/auth/login", { method: "POST" })).toBe(true);
    expect(canRetry("/api/actions/log", { method: "POST" })).toBe(false);
    expect(canRetry("/api/auth/register", { method: "POST" })).toBe(false);
    expect(canRetry("/api/account", { method: "DELETE" })).toBe(false);
  });
});

describe("fetchWithWakeUp", () => {
  it("returns as soon as the server answers", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const resp = await fetchWithWakeUp("/x", {}, true, [0, 0, 0]);
    expect(resp.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry an HTTP error, only a network failure", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    const resp = await fetchWithWakeUp("/x", {}, true, [0, 0]);
    expect(resp.status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last delay", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchWithWakeUp("/x", {}, true, [0, 0])).rejects.toThrow("Failed to fetch");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("never retries when told not to", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchWithWakeUp("/x", {}, false, [0, 0])).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
