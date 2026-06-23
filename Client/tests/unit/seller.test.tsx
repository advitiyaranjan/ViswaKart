import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { canViewSellPath, sellerDestination, SELL_PATHS, type SellerSummary } from "../../src/lib/seller";
import { safeRedirectPath } from "../../src/lib/redirect";
import { validateDraft } from "../../src/app/pages/seller/ProductForm";
import { validateApplication } from "../../src/app/pages/seller/SellerRegister";
import SellEntry from "../../src/app/pages/seller/SellEntry";
import { SellerGate } from "../../src/app/pages/seller/SellerShell";

const getMySellerStatus = vi.fn();
vi.mock("../../src/services/userService", () => ({ userService: { getMySellerStatus: () => getMySellerStatus() } }));

function summary(overrides: Partial<SellerSummary> = {}): SellerSummary {
  return {
    status: "none", canSell: false, campusEligible: false, isAdmin: false, reason: "", requestedAt: null, reviewedAt: null, message: "",
    profile: { name: "Asha", mobileNumber: "", hostelNumber: "", roomNumber: "", courseYear: "" },
    ...overrides,
  };
}

describe("sell flow routing", () => {
  it("sends each seller state to the right page", () => {
    expect(sellerDestination(summary())).toBe(SELL_PATHS.register);
    expect(sellerDestination(summary({ status: "pending" }))).toBe(SELL_PATHS.status);
    expect(sellerDestination(summary({ status: "rejected" }))).toBe(SELL_PATHS.status);
    expect(sellerDestination(summary({ status: "approved", canSell: true }))).toBe(SELL_PATHS.dashboard);
    expect(sellerDestination(summary({ status: "suspended", canSell: false }))).toBe(SELL_PATHS.status);
    // Verified campus accounts and admins can sell without an application.
    expect(sellerDestination(summary({ campusEligible: true, canSell: true }))).toBe(SELL_PATHS.dashboard);
  });

  it("guards direct navigation with the same rules", () => {
    expect(canViewSellPath(SELL_PATHS.dashboard, summary({ status: "pending" }))).toBe(false);
    expect(canViewSellPath(SELL_PATHS.register, summary({ status: "pending" }))).toBe(false);
    expect(canViewSellPath(SELL_PATHS.register, summary({ status: "rejected" }))).toBe(true);
    expect(canViewSellPath(SELL_PATHS.register, summary({ status: "approved", canSell: true }))).toBe(false);
    expect(canViewSellPath(SELL_PATHS.dashboard, summary({ status: "suspended" }))).toBe(false);
  });
});

describe("sell pages", () => {
  beforeEach(() => {
    getMySellerStatus.mockReset();
  });

  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/sell" element={<SellEntry />} />
          <Route path="/sell/register" element={<SellerGate path={SELL_PATHS.register}>{() => <h1>Register page</h1>}</SellerGate>} />
          <Route path="/sell/status" element={<SellerGate path={SELL_PATHS.status}>{({ seller }) => <h1>Status: {seller.status}</h1>}</SellerGate>} />
          <Route path="/sell/dashboard" element={<SellerGate path={SELL_PATHS.dashboard}>{() => <h1>Dashboard page</h1>}</SellerGate>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("routes an approved seller straight to the dashboard", async () => {
    getMySellerStatus.mockResolvedValue({ data: { seller: summary({ status: "approved", canSell: true }) } });
    renderAt("/sell");
    expect(await screen.findByRole("heading", { name: "Dashboard page" })).toBeInTheDocument();
  });

  it("routes a new customer to registration", async () => {
    getMySellerStatus.mockResolvedValue({ data: { seller: summary() } });
    renderAt("/sell");
    expect(await screen.findByRole("heading", { name: "Register page" })).toBeInTheDocument();
  });

  it("keeps a pending applicant out of the dashboard and registration", async () => {
    getMySellerStatus.mockResolvedValue({ data: { seller: summary({ status: "pending" }) } });
    renderAt("/sell/dashboard");
    expect(await screen.findByRole("heading", { name: "Status: pending" })).toBeInTheDocument();
  });

  it("keeps a suspended seller on the status page", async () => {
    getMySellerStatus.mockResolvedValue({ data: { seller: summary({ status: "suspended" }) } });
    renderAt("/sell/register");
    expect(await screen.findByRole("heading", { name: "Status: suspended" })).toBeInTheDocument();
  });

  it("offers a retry when the status can't be loaded", async () => {
    getMySellerStatus.mockImplementation(() => Promise.reject(Object.assign(new Error("Request failed"), { response: { data: { message: "Server unavailable" } } })));
    renderAt("/sell");
    expect(await screen.findByText("Server unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

describe("safeRedirectPath", () => {
  it("allows same-origin paths only", () => {
    expect(safeRedirectPath("/sell")).toBe("/sell");
    expect(safeRedirectPath("/checkout?x=1")).toBe("/checkout?x=1");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
    expect(safeRedirectPath(null)).toBe("/");
  });

  it("never redirects back to the auth pages", () => {
    expect(safeRedirectPath("/login")).toBe("/");
    expect(safeRedirectPath("/signup?redirect=/sell")).toBe("/");
  });
});

describe("form validation", () => {
  const draft = {
    name: "Calculator", price: "500", originalPrice: "", stock: "1", description: "Works perfectly, with cover.", specs: "", category: "c1",
    productAge: "", images: [], sellerMobile: "98765 43210", sellerHostel: "BH-1", sellerRoom: "12",
  };

  it("accepts a complete listing and rejects invalid values", () => {
    expect(validateDraft(draft, false)).toEqual({});
    const errors = validateDraft({ ...draft, price: "0", stock: "0", description: "short", category: "", originalPrice: "" }, false);
    expect(Object.keys(errors).sort()).toEqual(["category", "description", "price", "stock"]);
    expect(validateDraft({ ...draft, price: "500", originalPrice: "400" }, false).originalPrice).toBeTruthy();
    // Editing may set stock to zero (sold out), creating may not.
    expect(validateDraft({ ...draft, stock: "0" }, true).stock).toBeUndefined();
  });

  it("validates seller applications", () => {
    expect(validateApplication({ name: "Asha K", mobileNumber: "9876543210", hostelNumber: "BH-1", roomNumber: "4", collegeId: "a".repeat(24) })).toEqual({});
    expect(Object.keys(validateApplication({ name: "A", mobileNumber: "12", hostelNumber: "", roomNumber: "", collegeId: "" })).sort()).toEqual([
      "collegeId",
      "hostelNumber",
      "mobileNumber",
      "name",
      "roomNumber",
    ]);
  });
});
