import type { College } from "./college";

export type SellerStatus = "none" | "pending" | "approved" | "rejected" | "suspended";

export interface SellerProfile {
  name: string;
  mobileNumber: string;
  hostelNumber: string;
  roomNumber: string;
  courseYear: string;
}

export interface SellerSummary {
  status: SellerStatus;
  canSell: boolean;
  campusEligible: boolean;
  isAdmin: boolean;
  reason: string;
  requestedAt: string | null;
  reviewedAt: string | null;
  profile: SellerProfile;
  message: string;
  /** College the seller's listings belong to (from their profile, or their verified campus email). */
  college?: College | null;
  collegeSource?: "profile" | "email" | null;
  /** Can sell but has no college yet (accounts from before College Mode); must choose one before listing. */
  needsCollege?: boolean;
}

export interface SellerApplication {
  name: string;
  mobileNumber: string;
  hostelNumber: string;
  roomNumber: string;
  courseYear?: string;
  message?: string;
  collegeId: string;
}

export const SELL_PATHS = {
  entry: "/sell",
  register: "/sell/register",
  status: "/sell/status",
  dashboard: "/sell/dashboard",
} as const;

/** Where the "Sell your product" journey continues for a seller in this state. */
export function sellerDestination(seller: Pick<SellerSummary, "status" | "canSell">): string {
  if (seller.status === "suspended") return SELL_PATHS.status;
  if (seller.canSell) return SELL_PATHS.dashboard;
  if (seller.status === "none") return SELL_PATHS.register;
  // Pending and rejected applicants see their status; rejected ones can resubmit from there.
  return SELL_PATHS.status;
}

/** Whether a page in the sell flow may be shown for this seller state. */
export function canViewSellPath(path: string, seller: Pick<SellerSummary, "status" | "canSell">) {
  if (path === SELL_PATHS.register) return !seller.canSell && (seller.status === "none" || seller.status === "rejected");
  return sellerDestination(seller) === path;
}
