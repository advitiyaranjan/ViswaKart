import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CartProvider, useCart } from "../../src/context/CartContext";
import { ProductCard } from "../../src/app/components/ProductCard";

vi.mock("../../src/context/WishlistContext", () => ({
  useWishlist: () => ({ wishlist: [], isWishlisted: () => false, toggleWishlist: vi.fn(), loading: false }),
}));

const ID = "c".repeat(24);

function CartCount() {
  const { items } = useCart();
  return <output data-testid="cart">{items.map((item) => `${item._id}:${item.quantity}@${item.price}`).join(",")}</output>;
}

function renderCard(props: Partial<Parameters<typeof ProductCard>[0]> = {}) {
  return render(
    <MemoryRouter>
      <CartProvider>
        <ProductCard id={ID} name="Desk lamp" price={450} originalPrice={600} rating={4.5} reviews={2} image="/lamp.jpg" stock={5} {...props} />
        <CartCount />
      </CartProvider>
    </MemoryRouter>,
  );
}

describe("ProductCard", () => {
  it("shows the selling price, the compare-at price and the real discount", () => {
    renderCard();
    const card = screen.getByRole("article");
    expect(within(card).getByText("₹450.00")).toBeInTheDocument();
    expect(within(card).getByText("₹600.00")).toBeInTheDocument();
    expect(within(card).getByText("25% off")).toBeInTheDocument();
    expect(within(card).getByText("4.5")).toBeInTheDocument();
  });

  it("says there are no reviews instead of inventing a rating", () => {
    renderCard({ rating: 0, reviews: 0 });
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });

  it("adds the selling price to the cart", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(screen.getByTestId("cart")).toHaveTextContent(`${ID}:1@450`);
  });

  it("stops at the available stock", () => {
    renderCard({ stock: 2 });
    expect(screen.getByText("Only 2 left")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /add to cart/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.getByTestId("cart")).toHaveTextContent(`${ID}:2@450`);
    expect(button).toBeDisabled();
  });

  it("disables buying when sold out", () => {
    renderCard({ stock: 0 });
    expect(screen.getAllByText("Sold out").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /sold out/i })).toBeDisabled();
  });
});
