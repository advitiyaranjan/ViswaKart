import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CartProvider } from "../../src/context/CartContext";
import Cart from "../../src/app/pages/Cart";

const getProduct = vi.fn();
vi.mock("../../src/services/productService", () => ({ productService: { getProduct: (id: string) => getProduct(id) } }));

const LAMP = "a".repeat(24);
const MUG = "b".repeat(24);

function seedCart() {
  localStorage.setItem(
    "cart_items",
    JSON.stringify([
      { _id: LAMP, name: "Desk lamp", price: 450, originalPrice: 600, image: "", stock: 5, quantity: 2 },
      { _id: MUG, name: "Mug", price: 120, image: "", stock: 3, quantity: 1 },
    ]),
  );
}

function renderCart() {
  return render(
    <MemoryRouter>
      <CartProvider>
        <Cart />
      </CartProvider>
    </MemoryRouter>,
  );
}

describe("Cart page", () => {
  beforeEach(() => {
    getProduct.mockReset();
    seedCart();
  });

  it("refreshes saved prices and removes products that no longer exist", async () => {
    getProduct.mockImplementation(async (id: string) => {
      if (id === LAMP) return { data: { product: { name: "Desk lamp", price: 400, originalPrice: 600, stock: 5, images: [] } } };
      throw Object.assign(new Error("gone"), { response: { status: 404 } });
    });
    renderCart();
    expect(await screen.findByText("We updated your cart")).toBeInTheDocument();
    expect(screen.getByText(/Desk lamp is now ₹400\.00 \(was ₹450\.00\)/)).toBeInTheDocument();
    expect(screen.getByText(/Mug is no longer available/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mug" })).not.toBeInTheDocument();
    // 2 × ₹400, shown in the summary and the phone checkout bar
    expect(screen.getAllByText("₹800.00").length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem("cart_items")!)).toEqual([expect.objectContaining({ _id: LAMP, price: 400, quantity: 2 })]);
  });

  it("keeps items it could not verify when the network fails", async () => {
    getProduct.mockRejectedValue(Object.assign(new Error("offline"), { response: undefined }));
    renderCart();
    await waitFor(() => expect(screen.getByText(/confirmed again at checkout/)).toBeInTheDocument());
    expect(screen.queryByText("We updated your cart")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mug" })).toBeInTheDocument();
  });

  it("shows an empty state with a way back to shopping", () => {
    localStorage.clear();
    renderCart();
    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explore products/i })).toHaveAttribute("href", "/products");
  });
});
