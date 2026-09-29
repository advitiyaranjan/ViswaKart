import { availableStock, getProductPricing, roundMoney } from "./commerce";
import { formatCurrency } from "./currency";

export interface CartItem {
  _id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
  originalPrice?: number;
  discount?: number;
}

/** Drops malformed entries, merges duplicates and clamps quantities to stock. */
export function normalizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const items = new Map<string, CartItem>();
  for (const raw of value) {
    if (!raw || typeof raw._id !== "string" || !raw._id || typeof raw.name !== "string") continue;
    if (!Number.isFinite(raw.price) || raw.price < 0 || !Number.isFinite(raw.stock) || !Number.isFinite(raw.quantity)) continue;
    const stock = Math.max(0, Math.floor(raw.stock));
    const quantity = Math.min(stock, Math.max(0, Math.floor(raw.quantity)));
    if (!quantity) continue;
    const prior = items.get(raw._id);
    items.set(raw._id, {
      _id: raw._id,
      name: raw.name,
      ...getProductPricing(raw),
      stock,
      image: typeof raw.image === "string" ? raw.image : "",
      quantity: Math.min(stock, quantity + (prior?.quantity ?? 0)),
    });
  }
  return [...items.values()];
}

export function addCartItem(items: CartItem[], item: Omit<CartItem, "quantity">, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(item.stock) || item.stock <= 0) return items;
  const existing = items.find((entry) => entry._id === item._id);
  return normalizeCart(
    existing
      ? items.map((entry) => (entry._id === item._id ? { ...item, quantity: existing.quantity + quantity } : entry))
      : [...items, { ...item, quantity }],
  );
}

export function changeCartQuantity(items: CartItem[], id: string, delta: number) {
  if (!Number.isInteger(delta)) return items;
  return normalizeCart(items.map((item) => (item._id === id ? { ...item, quantity: item.quantity + delta } : item)));
}

export function cartSubtotal(items: CartItem[]) {
  return roundMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
}

export interface CatalogSnapshot {
  name: string;
  price: number;
  originalPrice?: number;
  images?: string[];
  stock?: number;
  sold?: boolean;
  isActive?: boolean;
}

/**
 * Brings saved cart lines up to date with the live catalog.
 * `latest[id]` is the current product, `null` when it no longer exists, or absent when it could not be checked.
 */
export function reconcileCart(items: CartItem[], latest: Record<string, CatalogSnapshot | null | undefined>) {
  const notices: string[] = [];
  const next: CartItem[] = [];
  for (const item of items) {
    const product = latest[item._id];
    if (product === undefined) {
      next.push(item);
      continue;
    }
    const stock = product ? availableStock(product) : 0;
    if (!product || stock === 0) {
      notices.push(`${item.name} is no longer available and was removed.`);
      continue;
    }
    const pricing = getProductPricing(product);
    const quantity = Math.min(item.quantity, stock);
    if (pricing.price !== item.price)
      notices.push(`${product.name} is now ${formatCurrency(pricing.price)} (was ${formatCurrency(item.price)}).`);
    if (quantity < item.quantity) notices.push(`Only ${stock} of ${product.name} available, so we updated the quantity.`);
    next.push({ ...item, name: product.name, image: product.images?.[0] || item.image, stock, quantity, ...pricing });
  }
  return { items: next, notices };
}
