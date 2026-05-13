import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { addCartItem, changeCartQuantity, normalizeCart, cartSubtotal, type CartItem } from "../lib/cart";
import { readStored, writeStored } from "../lib/commerce";

export type { CartItem } from "../lib/cart";

interface CartContextValue {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  removeItems: (ids: string[]) => void;
  updateQuantity: (id: string, delta: number) => void;
  /** Replaces the cart wholesale, e.g. after refreshing prices and stock from the catalog. */
  replaceItems: (items: CartItem[]) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "cart_items";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => normalizeCart(readStored(CART_KEY, [])));

  useEffect(() => {
    writeStored(CART_KEY, items);
  }, [items]);

  // Keep carts in other tabs in sync.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === CART_KEY || event.key === null) setItems(normalizeCart(readStored(CART_KEY, [])));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const addToCart = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => setItems((prev) => addCartItem(prev, item, quantity)),
    [],
  );
  const removeFromCart = useCallback((id: string) => setItems((prev) => prev.filter((item) => item._id !== id)), []);
  const removeItems = useCallback((ids: string[]) => setItems((prev) => prev.filter((item) => !ids.includes(item._id))), []);
  const updateQuantity = useCallback((id: string, delta: number) => setItems((prev) => changeCartQuantity(prev, id, delta)), []);
  const replaceItems = useCallback((next: CartItem[]) => setItems(normalizeCart(next)), []);
  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      removeItems,
      updateQuantity,
      replaceItems,
      clearCart,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cartSubtotal(items),
    }),
    [items, addToCart, removeFromCart, removeItems, updateQuantity, replaceItems, clearCart],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
