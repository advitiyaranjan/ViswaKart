import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, availableStock, getProductPricing, isCancellable, makeRequestId, nextStatuses, normalizeIds } from "../../src/lib/commerce";

const require = createRequire(import.meta.url);
const server = require("../../../server/utils/commerce.js") as {
  canTransition: (from: string, to: string) => boolean;
  normalizePricing: (payload: object) => { price: number; originalPrice: number; discount: number };
  normalizeRequestId: (value: string) => string;
};

describe("getProductPricing", () => {
  it("treats price as the final selling price and derives the discount", () => {
    expect(getProductPricing({ price: 750, originalPrice: 1000 })).toEqual({ price: 750, originalPrice: 1000, discount: 25 });
  });

  it("ignores a stale stored discount instead of discounting twice", () => {
    expect(getProductPricing({ price: 500, originalPrice: 500, discount: 40 })).toEqual({ price: 500, originalPrice: 500, discount: 0 });
  });

  it("never shows a compare-at price below the selling price", () => {
    expect(getProductPricing({ price: 500, originalPrice: 300 })).toEqual({ price: 500, originalPrice: 500, discount: 0 });
    expect(getProductPricing({ price: 200, originalPrice: null })).toEqual({ price: 200, originalPrice: 200, discount: 0 });
  });

  it("agrees with the server on the charged price", () => {
    for (const [price, originalPrice] of [
      [450, 600],
      [99.99, 149.5],
      [10, 10],
    ]) {
      const client = getProductPricing({ price, originalPrice });
      const serverPricing = server.normalizePricing({ price, originalPrice });
      expect(client.price).toBe(serverPricing.price);
      expect(client.originalPrice).toBe(serverPricing.originalPrice);
      expect(Math.abs(client.discount - serverPricing.discount)).toBeLessThan(1);
    }
  });
});

describe("availableStock", () => {
  it("matches checkout's availability rule", () => {
    expect(availableStock({ stock: 4 })).toBe(4);
    expect(availableStock({ stock: 4, sold: true })).toBe(0);
    expect(availableStock({ stock: 4, isActive: false })).toBe(0);
    expect(availableStock({ stock: -2 })).toBe(0);
    expect(availableStock({ stock: 2.7 })).toBe(2);
    expect(availableStock({})).toBe(0);
  });
});

describe("order status transitions", () => {
  it("match the server's canTransition exactly", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (from === to) continue;
        expect(nextStatuses(from).includes(to), `${from} -> ${to}`).toBe(server.canTransition(from, to));
      }
    }
  });

  it("only lets customers cancel before shipping", () => {
    expect(ORDER_STATUSES.filter(isCancellable)).toEqual(["Pending", "Processing"]);
    expect(nextStatuses("Unknown")).toEqual([]);
  });
});

describe("makeRequestId", () => {
  it("produces IDs the server accepts, without collisions", () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeRequestId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(server.normalizeRequestId(id)).toBe(id);
  });
});

describe("normalizeIds", () => {
  it("keeps unique Mongo IDs only", () => {
    const id = "a".repeat(24);
    expect(normalizeIds([id, id, "nope", 5, null])).toEqual([id]);
    expect(normalizeIds("not an array")).toEqual([]);
  });
});
