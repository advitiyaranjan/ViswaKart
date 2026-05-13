import { test, expect, expectNoHorizontalScroll, PRODUCTS } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";

const [BOOK, LAMP, CALCULATOR] = PRODUCTS;

// Set SCREENSHOT_DIR to keep full-page screenshots for visual review.
async function snapshot(page: Page, testInfo: TestInfo, name: string) {
  if (!process.env.SCREENSHOT_DIR) return;
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${testInfo.project.name}-${name}.png`, fullPage: true });
}

// The product page has a desktop buy box and a phone action bar; use whichever is showing.
const visible = (page: Page, name: RegExp) =>
  page.getByTestId("product-actions").filter({ visible: true }).getByRole("button", { name }).first();

test("home page shows the catalog without sideways scrolling", async ({ shop: page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /good finds/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meet your new favourites" })).toBeVisible();
  await expect(page.getByRole("link", { name: `View ${BOOK.name}` }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await snapshot(page, testInfo, "home");
});

test("product listing filters work on every screen size", async ({ shop: page, isMobile }, testInfo) => {
  await page.goto("/products");
  await expect(page.getByText("8 products to discover")).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: /^filters/i }).click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
  }
  const inStock = page.getByLabel("In stock only").filter({ visible: true });
  await inStock.scrollIntoViewIfNeeded();
  // The URL (and so the checkbox) updates in a router transition, so click and then wait for it.
  await inStock.click();
  await expect(inStock).toBeChecked();
  await expect(page.getByText(/products matching your filters/).first()).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: /^show \d+ products?/i }).click();
  await expect(page.getByRole("button", { name: "Remove filter: In stock" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await snapshot(page, testInfo, "listing");
});

test("product page shows real pricing and reviews, and adds to the cart", async ({ shop: page }, testInfo) => {
  await page.goto(`/products/${BOOK._id}`);
  await expect(page.getByRole("heading", { level: 1, name: BOOK.name })).toBeVisible();
  const main = page.locator("main");
  await expect(main.getByText("₹450.00").first()).toBeVisible();
  await expect(main.getByText("₹600.00").first()).toBeVisible();
  await expect(main.getByText("25% off").first()).toBeVisible();
  await expect(main.getByRole("link", { name: /2 reviews/ })).toBeVisible();
  // Made-up data the old page generated must be gone.
  await expect(main.getByText(/Country of Origin|Warranty|Check Delivery/)).toHaveCount(0);

  await visible(page, /^add to cart$/i).click();
  await expect(page.getByRole("link", { name: "Cart, 1 items" }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await snapshot(page, testInfo, "product");
});

test("sold-out products cannot be bought", async ({ shop: page }) => {
  await page.goto(`/products/${CALCULATOR._id}`);
  await expect(page.getByText("Sold out").first()).toBeVisible();
  await expect(visible(page, /sold out/i)).toBeDisabled();
});

test("cart caps quantities at available stock", async ({ shop: page }, testInfo) => {
  await page.goto(`/products/${LAMP._id}`);
  await visible(page, /^add to cart$/i).click();
  await expect(visible(page, /all in your cart/i)).toBeDisabled();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: /your cart/i })).toBeVisible();
  await expect(page.getByRole("button", { name: `Increase quantity of ${LAMP.name}` })).toBeDisabled();
  await expect(page.getByText("Only 1 left")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await snapshot(page, testInfo, "cart");
});

test("unknown products show a helpful message", async ({ shop: page }) => {
  await page.goto(`/products/${"f".repeat(24)}`);
  await expect(page.getByRole("heading", { name: "This product isn't available" })).toBeVisible();
  await expect(page.getByRole("link", { name: /browse products/i })).toBeVisible();
});

test("phones get a thumb-sized bottom navigation", async ({ shop: page, isMobile }) => {
  test.skip(!isMobile, "tab bar is phone-only");
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Quick navigation" });
  await expect(nav).toBeVisible();
  for (const label of ["Home", "Shop", "Saved", "Cart", "Account"]) {
    const box = await nav.getByRole("link", { name: new RegExp(label) }).boundingBox();
    expect(box?.height ?? 0, `${label} tap target`).toBeGreaterThanOrEqual(44);
  }
  await nav.getByRole("link", { name: /shop/i }).click();
  await expect(page).toHaveURL(/\/products$/);
});
