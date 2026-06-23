import { test, expect, expectNoHorizontalScroll, COLLEGES, PRODUCTS } from "./fixtures";

const campusProducts = PRODUCTS.filter((p) => p.college?._id === COLLEGES[0]._id).length;

test("College Mode: choose a college, see only its products, switch, turn off, and come back to it", async ({ shop: page }, testInfo) => {
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "College Mode" });
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await toggle.click();
  const dialog = page.getByRole("dialog", { name: "Choose Your College" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox").fill("gwal");
  await expect(dialog.getByRole("button", { name: /IIT Madras/ })).toHaveCount(0);
  await dialog.getByRole("button", { name: /ABV-IIITM Gwalior/ }).click();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("college-picker.png") });
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog).toBeHidden();

  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("College Mode").getByText("ABV-IIITM Gwalior")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("college-on-home.png"), fullPage: true });

  // The listing page shows the reminder bar and only this college's products.
  await page.goto("/products");
  await expect(page.getByText("College Mode", { exact: true })).toBeVisible();
  await expect(page.getByText(`${campusProducts} products to discover`)).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Switch college: the results change to the other college.
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /IIT Madras/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("1 product to discover")).toBeVisible();

  // Turning it off returns to the global catalogue but remembers the college.
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByText(`${PRODUCTS.length} products to discover`)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Off · IIT Madras saved")).toBeVisible();
  await page.reload();
  await page.getByRole("switch", { name: "College Mode" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "College Mode" })).toHaveAttribute("aria-checked", "true");
});

test("College Mode shows a helpful empty state when a college has nothing yet", async ({ shop: page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("college-mode", JSON.stringify({ collegeId: "e".repeat(24), enabled: true })));
  await page.goto("/search?q=calculator");
  await expect(page.getByRole("heading", { name: "No products found for your college yet." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn off College Mode" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("college-empty.png") });
  await page.getByRole("button", { name: "Turn off College Mode" }).click();
  await expect(page.getByRole("heading", { name: "No products found for your college yet." })).toHaveCount(0);
});

test("product pages note when an item is outside the selected college, and the cart is untouched", async ({ shop: page }) => {
  await page.addInitScript(() => localStorage.setItem("college-mode", JSON.stringify({ collegeId: "d".repeat(24), enabled: true })));
  const outside = PRODUCTS.find((p) => p.college === null && p.stock > 0)!;
  await page.goto(`/products/${outside._id}`);
  await expect(page.getByRole("note")).toContainText("isn't linked to a college");
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await page.goto("/");
  await page.getByRole("switch", { name: "College Mode" }).click();
  await expect(page.getByRole("link", { name: /Cart, 1 items/ })).toBeVisible();
});
