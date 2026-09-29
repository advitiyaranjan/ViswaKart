const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeItems, calculateQuote, canTransition, summarizeStatus, normalizePricing, pagination,
  normalizeRequestId, escapeRegex, cartFingerprint, validateAddress,
} = require("../utils/commerce");

const ID_A = "a".repeat(24);
const ID_B = "b".repeat(24);

test("normalizeItems merges duplicate products and lowercases IDs", () => {
  const items = normalizeItems([{ product: ID_A.toUpperCase(), quantity: 2 }, { product: ID_A, quantity: 3 }, { product: ID_B, quantity: 1 }]);
  assert.deepEqual(items, [{ product: ID_A, quantity: 5 }, { product: ID_B, quantity: 1 }]);
});

test("normalizeItems rejects malformed input", () => {
  assert.throws(() => normalizeItems([]), /between 1 and 100/);
  assert.throws(() => normalizeItems([{ product: "not-an-id", quantity: 1 }]), /Invalid product ID/);
  assert.throws(() => normalizeItems([{ product: ID_A, quantity: 0 }]), /positive whole number/);
  assert.throws(() => normalizeItems([{ product: ID_A, quantity: 1.5 }]), /positive whole number/);
  assert.throws(() => normalizeItems([{ product: ID_A, quantity: "2" }]), /positive whole number/);
  assert.throws(() => normalizeItems([{ product: ID_A, quantity: 600 }, { product: ID_A, quantity: 600 }]), /must not exceed 999/);
});

test("calculateQuote rounds to paise and applies the shipping rate", () => {
  const items = [{ price: 0.1, quantity: 3 }, { price: 19.99, quantity: 2 }];
  assert.deepEqual(calculateQuote(items, "standard"), { itemsPrice: 40.28, shippingPrice: 0, taxPrice: 0, couponDiscount: 0, totalPrice: 40.28 });
  assert.equal(calculateQuote(items, "express").totalPrice, 53.27);
  assert.throws(() => calculateQuote(items, "teleport"), /Invalid shipping method/);
});

test("canTransition only moves orders forward and keeps final states final", () => {
  assert.ok(canTransition("Pending", "Processing"));
  assert.ok(canTransition("Processing", "Cancelled"));
  assert.ok(canTransition("Shipped", "Delivered"));
  assert.ok(canTransition("Pending", "Pending"));
  assert.ok(!canTransition("Shipped", "Cancelled"));
  assert.ok(!canTransition("Delivered", "Pending"));
  assert.ok(!canTransition("Cancelled", "Processing"));
  assert.ok(!canTransition("Pending", "Lost"));
});

test("summarizeStatus never reports a partially fulfilled order as delivered", () => {
  assert.equal(summarizeStatus([{ itemStatus: "Delivered" }, { itemStatus: "Shipped" }]), "Shipped");
  assert.equal(summarizeStatus([{ itemStatus: "Delivered" }, { itemStatus: "Cancelled" }]), "Delivered");
  assert.equal(summarizeStatus([{ itemStatus: "Cancelled" }, { itemStatus: "Cancelled" }]), "Cancelled");
  assert.equal(summarizeStatus([{ itemStatus: "Processing" }, {}]), "Pending");
});

test("normalizePricing treats price as final and derives the discount", () => {
  assert.deepEqual(normalizePricing({ price: 750, originalPrice: 1000 }), { price: 750, originalPrice: 1000, discount: 25 });
  // A compare-at price below the selling price is raised to it rather than showing a negative discount.
  assert.deepEqual(normalizePricing({ price: 500, originalPrice: 400 }), { price: 500, originalPrice: 500, discount: 0 });
  assert.deepEqual(normalizePricing({}, { price: 90, originalPrice: 100 }), { price: 90, originalPrice: 100, discount: 10 });
  assert.throws(() => normalizePricing({ price: -1 }), /non-negative/);
  assert.throws(() => normalizePricing({ price: "abc" }), /non-negative/);
});

test("pagination validates page and limit", () => {
  assert.deepEqual(pagination({}), { page: 1, limit: 20, skip: 0 });
  assert.deepEqual(pagination({ page: "3", limit: "10" }), { page: 3, limit: 10, skip: 20 });
  assert.throws(() => pagination({ page: "0" }));
  assert.throws(() => pagination({ limit: "101" }));
  assert.throws(() => pagination({ page: "1.5" }));
});

test("normalizeRequestId accepts UUIDs and rejects injection-shaped values", () => {
  assert.equal(normalizeRequestId(undefined), undefined);
  assert.equal(normalizeRequestId(""), undefined);
  assert.equal(normalizeRequestId("3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e"), "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e");
  assert.throws(() => normalizeRequestId({ $gt: "" }), /Invalid checkout request ID/);
  assert.throws(() => normalizeRequestId("short"), /Invalid checkout request ID/);
});

test("validateAddress trims fields and requires all of them", () => {
  const address = { street: " 1 Main St ", city: "Gwalior", state: "MP", zipCode: "474015", country: "India" };
  assert.equal(validateAddress(address).street, "1 Main St");
  assert.throws(() => validateAddress({ ...address, city: "  " }), /shipping city/);
  assert.throws(() => validateAddress(null), /shipping street/);
});

test("escapeRegex neutralises regex metacharacters", () => {
  assert.equal(escapeRegex("a.b*(c)"), "a\\.b\\*\\(c\\)");
  assert.ok(new RegExp(escapeRegex("(.*)")).test("(.*)"));
});

test("cartFingerprint is independent of item order but sensitive to price", () => {
  const a = { product: ID_A, quantity: 1, price: 10 };
  const b = { product: ID_B, quantity: 2, price: 5 };
  assert.equal(cartFingerprint([a, b], "standard"), cartFingerprint([b, a], "standard"));
  assert.notEqual(cartFingerprint([a, b], "standard"), cartFingerprint([{ ...a, price: 11 }, b], "standard"));
  assert.notEqual(cartFingerprint([a, b], "standard"), cartFingerprint([a, b], "express"));
});
