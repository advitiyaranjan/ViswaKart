// Single source of truth for where a user stands as a seller.
// Older accounts only carry the legacy booleans (isSeller / sellerApproved / sellerRequested), so the
// status is derived from them when `sellerStatus` has never been written.
const SELLER_STATUSES = ["none", "pending", "approved", "rejected", "suspended"];
const CAMPUS_DOMAIN = "@iiitm.ac.in";

function sellerStatusOf(user) {
  if (!user) return "none";
  if (SELLER_STATUSES.includes(user.sellerStatus) && user.sellerStatus !== "none") return user.sellerStatus;
  if (user.isSeller && user.sellerApproved) return "approved";
  if (user.sellerRequested) return "pending";
  return "none";
}

// Verified campus accounts may sell without applying (existing business rule), unless an admin suspended them.
function isCampusEligible(user) {
  return Boolean(user?.isVerified && user.email?.toLowerCase().endsWith(CAMPUS_DOMAIN));
}

function canSell(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const status = sellerStatusOf(user);
  if (status === "suspended") return false;
  return status === "approved" || isCampusEligible(user);
}

/** The legacy flags kept in step with `sellerStatus` so older clients and scripts keep working. */
function legacyFlags(status) {
  return {
    sellerStatus: status,
    isSeller: status === "approved" || status === "suspended",
    sellerApproved: status === "approved",
    sellerRequested: status === "pending",
  };
}

function sellerSummary(user) {
  const status = sellerStatusOf(user);
  return {
    status,
    canSell: canSell(user),
    campusEligible: isCampusEligible(user),
    isAdmin: user?.role === "admin",
    reason: status === "rejected" ? user.sellerRejectionReason || "" : status === "suspended" ? user.sellerSuspensionReason || "" : "",
    requestedAt: user?.sellerRequestedAt || null,
    reviewedAt: user?.sellerReviewedAt || user?.sellerApprovedAt || null,
    profile: {
      name: user?.sellerProfile?.name || user?.name || "",
      mobileNumber: user?.sellerProfile?.mobileNumber || "",
      hostelNumber: user?.sellerProfile?.hostelNumber || "",
      roomNumber: user?.sellerProfile?.roomNumber || "",
      courseYear: user?.sellerProfile?.courseYear || "",
    },
    message: user?.sellerRequestMessage || "",
  };
}

/**
 * sellerSummary plus the seller's college affiliation, resolved from trusted data.
 * `collegeSource` is "profile" (chosen on the application or set by an admin) or "email" (verified campus domain).
 */
async function sellerSummaryWithCollege(user) {
  const College = require("../models/College");
  const { PUBLIC_FIELDS, collegeForEmail } = require("./college");
  const summary = sellerSummary(user);
  let college = null;
  let collegeSource = null;
  if (user?.sellerProfile?.college) {
    college = await College.findById(user.sellerProfile.college).select(PUBLIC_FIELDS).lean();
    collegeSource = "profile";
  } else if (isCampusEligible(user)) {
    college = await collegeForEmail(user.email);
    collegeSource = college ? "email" : null;
  }
  // Sellers who can list but have no college must add one before their next listing.
  return { ...summary, college, collegeSource, needsCollege: summary.canSell && !summary.isAdmin && !college };
}

module.exports = { SELLER_STATUSES, sellerStatusOf, isCampusEligible, canSell, legacyFlags, sellerSummary, sellerSummaryWithCollege };
