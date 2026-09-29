const crypto = require("crypto");

const SHIPPING_RATES = Object.freeze({ standard: 0, express: 12.99, overnight: 24.99 });
const STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
const FINAL_STATUSES = ["Delivered", "Cancelled"];

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function pagination(query = {}, defaultLimit = 20) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? defaultLimit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    fail("Page must be a positive integer and limit must be between 1 and 100");
  }
  return { page, limit, skip: (page - 1) * limit };
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) fail("Provide between 1 and 100 order items");
  const merged = new Map();
  for (const item of items) {
    if (!item || typeof item.product !== "string" || !/^[a-f\d]{24}$/i.test(item.product)) fail("Invalid product ID");
    if (typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
      fail("Quantity must be a positive whole number no greater than 999");
    }
    const product = item.product.toLowerCase();
    const quantity = (merged.get(product) || 0) + item.quantity;
    if (quantity > 999) fail("Quantity must not exceed 999 per product");
    merged.set(product, quantity);
  }
  return [...merged].map(([product, quantity]) => ({ product, quantity }));
}

function validateAddress(address) {
  const result = {};
  for (const field of ["street", "city", "state", "zipCode", "country"]) {
    if (typeof address?.[field] !== "string" || !address[field].trim() || address[field].length > 300) {
      fail(`A valid shipping ${field} is required`);
    }
    result[field] = address[field].trim();
  }
  return result;
}

function calculateQuote(items, shippingMethod = "standard") {
  if (!Object.hasOwn(SHIPPING_RATES, shippingMethod)) fail("Invalid shipping method");
  const itemsPrice = money(items.reduce((sum, item) => sum + money(item.price) * item.quantity, 0));
  const shippingPrice = SHIPPING_RATES[shippingMethod];
  return { itemsPrice, shippingPrice, taxPrice: 0, couponDiscount: 0, totalPrice: money(itemsPrice + shippingPrice) };
}

function cartFingerprint(items, shippingMethod) {
  const canonical = items.map(({ product, quantity, price }) => ({ product: String(product), quantity, price: money(price) }))
    .sort((a, b) => a.product.localeCompare(b.product));
  return crypto.createHash("sha256").update(JSON.stringify({ items: canonical, shippingMethod })).digest("hex");
}

function canTransition(from, to) {
  if (!STATUSES.includes(to)) return false;
  if (from === to) return true;
  return ({ Pending: ["Processing", "Shipped", "Delivered", "Cancelled"], Processing: ["Shipped", "Delivered", "Cancelled"], Shipped: ["Delivered"], Delivered: [], Cancelled: [] })[from]?.includes(to) || false;
}

function summarizeStatus(items) {
  const active = items.map((item) => item.itemStatus || "Pending").filter((status) => status !== "Cancelled");
  if (!active.length) return "Cancelled";
  if (active.every((status) => status === "Delivered")) return "Delivered";
  // A partially fulfilled order must never appear fully delivered.
  const rank = { Pending: 0, Processing: 1, Shipped: 2, Delivered: 3 };
  return active.reduce((lowest, status) => rank[status] < rank[lowest] ? status : lowest, active[0]);
}

function normalizePricing(payload, current = {}) {
  const price = Number(payload.price ?? current.price);
  const originalPrice = Number(payload.originalPrice ?? current.originalPrice ?? price);
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(originalPrice) || originalPrice < 0) fail("Prices must be valid non-negative numbers");
  // Selling price is authoritative. A comparison price can never be lower.
  const comparison = Math.max(price, originalPrice);
  return { price: money(price), originalPrice: money(comparison), discount: comparison > price ? money((1 - price / comparison) * 100) : 0 };
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Checkout sends a per-attempt ID so a retried or double-submitted order is only created once.
function normalizeRequestId(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(value)) fail("Invalid checkout request ID");
  return value;
}

module.exports = {
  SHIPPING_RATES, STATUSES, FINAL_STATUSES, fail, money, pagination, normalizeItems, validateAddress, calculateQuote,
  cartFingerprint, canTransition, summarizeStatus, normalizePricing, escapeRegex, normalizeRequestId,
};
