import { test, expect, expectNoHorizontalScroll } from "./fixtures";

test("home page invites visitors to sell without crowding the layout", async ({ shop: page }, testInfo) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Have something to sell?" });
  await expect(banner).toBeVisible();
  await expect(banner.getByText("Join our seller community, showcase your products, and reach more customers.")).toBeVisible();
  await expect(banner.getByRole("link", { name: /start selling/i })).toHaveAttribute("href", "/sell");
  await expect(page.getByRole("link", { name: "Sell your product" }).first()).toHaveAttribute("href", "/sell");
  await expectNoHorizontalScroll(page);
  await banner.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("home-sell-banner.png"), fullPage: true });
});

test("signed-out visitors who choose to sell are asked to sign in and kept on track", async ({ shop: page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("region", { name: "Have something to sell?" }).getByRole("link", { name: /start selling/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Sign in or create an account to start selling.")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("sell-login.png") });
});

test("seller pages require an account when opened directly", async ({ shop: page }) => {
  for (const path of ["/sell/dashboard", "/sell/register", "/payment/complete?payment_intent=pi_123"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login/);
  }
});
