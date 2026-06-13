const College = require("../models/College");
const { fail } = require("./commerce");

const isObjectId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const PUBLIC_FIELDS = "name slug city state country isActive";

/** Resolves a client-supplied college ID against the authoritative list; inactive colleges are rejected. */
async function requireActiveCollege(id, message = "Select a supported college") {
  if (!isObjectId(String(id ?? ""))) fail(message);
  const college = await College.findOne({ _id: id, isActive: true }).select(PUBLIC_FIELDS).lean();
  if (!college) fail(message);
  return college;
}

/** The active college whose verified email domain matches exactly (no suffix matching: iiitm.ac.in ≠ iitm.ac.in). */
async function collegeForEmail(email) {
  const domain = String(email || "").toLowerCase().split("@")[1];
  if (!domain) return null;
  return College.findOne({ emailDomains: domain, isActive: true }).select(PUBLIC_FIELDS).lean();
}

/**
 * The college a seller's new listings belong to, from trusted server data only:
 * the affiliation on their seller profile, or for verified campus accounts the college that owns their email domain.
 */
async function sellerCollegeId(user) {
  if (user?.sellerProfile?.college) return user.sellerProfile.college;
  if (user?.isVerified && user.email) return (await collegeForEmail(user.email))?._id || null;
  return null;
}

module.exports = { isObjectId, PUBLIC_FIELDS, requireActiveCollege, collegeForEmail, sellerCollegeId };
