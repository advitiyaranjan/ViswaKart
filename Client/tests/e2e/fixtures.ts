import { test as base, expect, type Page } from "@playwright/test";

const category = { _id: "c".repeat(24), name: "Books", slug: "books", productCount: 3 };

function product(index: number, overrides: Record<string, unknown> = {}) {
  return {
    _id: `${index}`.padStart(24, "a"),
    name: ["Introduction to Algorithms", "Desk lamp with warm light", "Scientific calculator", "Hostel study table"][index % 4],
    description: "Well kept and ready for its next owner. Includes everything shown in the photos.",
    price: [450, 799, 1200, 2499][index % 4],
    originalPrice: [600, 799, 1500, 2499][index % 4],
    discount: 0,
    images: [],
    ratings: index === 0 ? 4.5 : 0,
    numReviews: index === 0 ? 2 : 0,
    reviews:
      index === 0
        ? [
            { _id: "r1", user: "u1", name: "Asha", rating: 5, comment: "Exactly as described.", createdAt: "2026-08-01T10:00:00Z" },
            { _id: "r2", user: "u2", name: "Ravi", rating: 4, comment: "Good condition.", createdAt: "2026-08-03T10:00:00Z" },
          ]
        : [],
    stock: [3, 1, 0, 8][index % 4],
    sold: false,
    isActive: true,
    category,
    ...overrides,
  };
}

export const PRODUCTS = Array.from({ length: 8 }, (_, index) => product(index));

/** Serves a small, fixed catalog for every API call the storefront makes. */
export async function mockApi(page: Page) {
  await page.route("http://api.test.local/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/categories") return json({ success: true, categories: [category] });
    if (path === "/products") {
      let list = PRODUCTS;
      const search = url.searchParams.get("search");
      if (search) list = list.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
      if (url.searchParams.get("inStock") === "true") list = list.filter((item) => item.stock > 0);
      const limit = Number(url.searchParams.get("limit") || 12);
      return json({ success: true, total: list.length, page: 1, pages: 1, products: list.slice(0, limit) });
    }
    const match = path.match(/^\/products\/([^/]+)$/);
    if (match) {
      const found = PRODUCTS.find((item) => item._id === match[1]);
      return found ? json({ success: true, product: found }) : json({ success: false, message: "Product not found" }, 404);
    }
    return json({ success: false, message: "Not authenticated" }, 401);
  });
}

/** Fails the test if the page can be scrolled sideways, the most common mobile layout bug. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(1);
}

export const test = base.extend<{ shop: Page }>({
  shop: async ({ page }, use) => {
    await mockApi(page);
    await use(page);
  },
});
export { expect };
