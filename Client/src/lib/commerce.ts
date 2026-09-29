/** API price is the final selling price. Never apply a discount to it again. */
export function getProductPricing(product: { price?: number; originalPrice?: number | null; discount?: number | null }) {
  const price = Number.isFinite(Number(product.price)) ? Math.max(0, Number(product.price)) : 0;
  const originalPrice = Math.max(price, Number(product.originalPrice) || price);
  const discount = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
  return { price, originalPrice, discount };
}

/** Units a customer can actually buy. Mirrors the server: sold or inactive listings cannot be ordered. */
export function availableStock(product: { stock?: number | null; sold?: boolean | null; isActive?: boolean | null }) {
  if (product.sold || product.isActive === false) return 0;
  const stock = Number(product.stock);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
}

export const DELIVERY_OPTIONS = [
  { id: "standard", label: "Standard delivery", eta: "5–7 business days", price: 0 },
  { id: "express", label: "Express delivery", eta: "2–3 business days", price: 12.99 },
  { id: "overnight", label: "Overnight delivery", eta: "Next business day", price: 24.99 },
] as const;
export type ShippingMethod = (typeof DELIVERY_OPTIONS)[number]["id"];

export const ORDER_STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Must match canTransition in server/utils/commerce.js.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Pending: ["Processing", "Shipped", "Delivered", "Cancelled"],
  Processing: ["Shipped", "Delivered", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

/** Statuses an order or item may move to from `status` (excluding staying put). */
export function nextStatuses(status: string): OrderStatus[] {
  return TRANSITIONS[status as OrderStatus] ?? [];
}

export function isCancellable(status: string) {
  return status === "Pending" || status === "Processing";
}

export function shortOrderId(id: string) {
  return `#${String(id).slice(-8).toUpperCase()}`;
}

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Random ID for idempotent checkout. randomUUID is missing on plain-HTTP origins (e.g. testing on a phone via LAN IP). */
export function makeRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readStored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing can disable storage. */
  }
}

export function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && /^[a-f\d]{24}$/i.test(id)))];
}
