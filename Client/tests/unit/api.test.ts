import { describe, expect, it } from "vitest";
import { resolveApiBase, retryDelay } from "../../src/services/api";

describe("resolveApiBase", () => {
  const origin = "https://shop.example.com";

  it("defaults to the same-origin /api", () => {
    expect(resolveApiBase(undefined, origin)).toBe("https://shop.example.com/api");
    expect(resolveApiBase("  ", origin)).toBe("https://shop.example.com/api");
  });

  it("accepts absolute URLs with or without /api and trailing slashes", () => {
    expect(resolveApiBase("http://localhost:5000/api", origin)).toBe("http://localhost:5000/api");
    expect(resolveApiBase("http://localhost:5000/api/", origin)).toBe("http://localhost:5000/api");
    expect(resolveApiBase("https://api.example.com", origin)).toBe("https://api.example.com/api");
  });

  it("resolves relative values against the page origin", () => {
    expect(resolveApiBase("/backend", origin)).toBe("https://shop.example.com/backend/api");
  });

  it("rejects non-HTTP schemes", () => {
    expect(() => resolveApiBase("javascript:alert(1)", origin)).toThrow(/HTTP/);
  });
});

describe("retryDelay", () => {
  it("backs off exponentially", () => {
    expect([1, 2, 3].map((attempt) => retryDelay(attempt))).toEqual([1000, 2000, 4000]);
  });

  it("honours Retry-After but caps it", () => {
    expect(retryDelay(1, "5")).toBe(5000);
    expect(retryDelay(1, "600")).toBe(30000);
    expect(retryDelay(2, "soon")).toBe(2000);
  });
});
