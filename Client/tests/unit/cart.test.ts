import { describe, expect, it } from "vitest";
import { addCartItem, cartSubtotal, changeCartQuantity, normalizeCart, reconcileCart, type CartItem } from "../../src/lib/cart";

const ID_A = "a".repeat(24);
const ID_B = "b".repeat(24);
const book: Omit<CartItem, "quantity"> = { _id: ID_A, name: "Algorithms", price: 450, originalPrice: 600, image: "/a.jpg", stock: 3 };

describe("cart operations", () => {
  it("never lets quantity exceed stock", () => {
    let items = addCartItem([], book, 2);
    items = addCartItem(items, book, 5);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
    expect(changeCartQuantity(items, ID_A, 1)[0].quantity).toBe(3);
  });

  it("removes a line when its quantity drops to zero", () => {
    const items = addCartItem([], book, 1);
    expect(changeCartQuantity(items, ID_A, -1)).toEqual([]);
  });

  it("ignores invalid additions", () => {
    expect(addCartItem([], book, 0)).toEqual([]);
    expect(addCartItem([], book, 1.5)).toEqual([]);
    expect(addCartItem([], { ...book, stock: 0 }, 1)).toEqual([]);
  });

  it("repairs tampered or corrupted saved carts", () => {
    const saved = [
      { ...book, quantity: 2 },
      { ...book, quantity: 2 }, // duplicate line
      { ...book, _id: ID_B, price: -5, quantity: 1 }, // negative price
      { _id: 42, name: "bad" },
      null,
    ];
    const items = normalizeCart(saved);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ _id: ID_A, quantity: 3, discount: 25 });
    expect(normalizeCart("garbage")).toEqual([]);
  });

  it("totals to the paisa", () => {
    expect(cartSubtotal([{ ...book, price: 0.1, quantity: 3 }, { ...book, _id: ID_B, price: 19.99, quantity: 2 }])).toBe(40.28);
  });
});

describe("reconcileCart", () => {
  const cart: CartItem[] = [
    { ...book, quantity: 2 },
    { _id: ID_B, name: "Lamp", price: 300, image: "", stock: 5, quantity: 1 },
  ];

  it("updates prices and reports the change", () => {
    const { items, notices } = reconcileCart(cart, { [ID_A]: { name: "Algorithms", price: 400, originalPrice: 600, stock: 3 } });
    expect(items[0]).toMatchObject({ price: 400, originalPrice: 600, discount: 33, quantity: 2 });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(/Algorithms is now/);
    expect(items[1]).toBe(cart[1]); // unchecked lines are left alone
  });

  it("drops sold-out or deleted products and clamps quantities", () => {
    const { items, notices } = reconcileCart(cart, {
      [ID_A]: { name: "Algorithms", price: 450, originalPrice: 600, stock: 1 },
      [ID_B]: null,
    });
    expect(items).toEqual([expect.objectContaining({ _id: ID_A, quantity: 1, stock: 1 })]);
    expect(notices).toEqual([expect.stringMatching(/Only 1 of Algorithms/), expect.stringMatching(/Lamp is no longer available/)]);
  });

  it("treats listings marked sold as unavailable", () => {
    const { items } = reconcileCart(cart, { [ID_B]: { name: "Lamp", price: 300, stock: 5, sold: true } });
    expect(items.map((item) => item._id)).toEqual([ID_A]);
  });

  it("stays quiet when nothing changed", () => {
    const { notices } = reconcileCart(cart, { [ID_A]: { name: "Algorithms", price: 450, originalPrice: 600, stock: 3 } });
    expect(notices).toEqual([]);
  });
});
