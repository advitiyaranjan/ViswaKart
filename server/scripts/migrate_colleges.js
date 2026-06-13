// College affiliation backfill for data created before College Mode existed.
//
//   npm run migrate:colleges            -> dry run: reports what lacks a college, changes nothing
//   npm run migrate:colleges -- --apply -> applies ONLY assignments derivable from trusted data:
//     1. a seller with a VERIFIED email whose domain exactly matches one active college's emailDomains;
//     2. a product without a college whose seller now has a college affiliation.
// Nothing else is guessed: sellers without a match keep no college (they are asked to add one before
// their next listing) and their products stay global-only (visible normally, hidden in College Mode).
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const College = require("../models/College");

const apply = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const colleges = await College.find({ isActive: true }).lean();
  if (!colleges.length) console.warn("No active colleges. Run `npm run seed:colleges` first.");
  const byDomain = new Map();
  for (const college of colleges) for (const domain of college.emailDomains || []) byDomain.set(domain, college);

  const sellerQuery = {
    $and: [
      { $or: [{ sellerStatus: { $in: ["pending", "approved", "suspended", "rejected"] } }, { isSeller: true }, { sellerRequested: true }] },
      { $or: [{ "sellerProfile.college": null }, { "sellerProfile.college": { $exists: false } }] },
    ],
  };
  const sellers = await User.find(sellerQuery).select("email isVerified sellerStatus").lean();
  let sellersAssigned = 0;
  for (const seller of sellers) {
    const college = seller.isVerified ? byDomain.get(String(seller.email || "").toLowerCase().split("@")[1]) : null;
    console.log(`seller ${seller._id} (${seller.sellerStatus || "legacy"}): ${college ? `-> ${college.name} (verified email domain)` : "no trusted match, left unassigned"}`);
    if (college && apply) {
      await User.updateOne({ _id: seller._id, "sellerProfile.college": { $in: [null, undefined] } }, { $set: { "sellerProfile.college": college._id } });
    }
    if (college) sellersAssigned += 1;
  }

  const unassigned = await Product.find({ $or: [{ college: null }, { college: { $exists: false } }] }).select("seller name").lean();
  const sellerIds = [...new Set(unassigned.filter((p) => p.seller).map((p) => String(p.seller)))];
  const owners = await User.find({ _id: { $in: sellerIds } }).select("sellerProfile.college email isVerified").lean();
  const ownerCollege = new Map();
  for (const owner of owners) {
    const college = owner.sellerProfile?.college || (owner.isVerified ? byDomain.get(String(owner.email || "").toLowerCase().split("@")[1])?._id : null);
    if (college) ownerCollege.set(String(owner._id), college);
  }
  let productsAssigned = 0;
  for (const product of unassigned) {
    const college = product.seller ? ownerCollege.get(String(product.seller)) : null;
    if (!college) continue;
    productsAssigned += 1;
    if (apply) await Product.updateOne({ _id: product._id, college: { $in: [null, undefined] } }, { $set: { college } });
  }

  console.log(`\n${apply ? "Applied" : "Dry run"}: ${sellersAssigned}/${sellers.length} sellers without a college ${apply ? "were" : "would be"} matched by verified email domain;`);
  console.log(`${productsAssigned}/${unassigned.length} unassigned products ${apply ? "were" : "would be"} linked to their seller's college.`);
  console.log(`${unassigned.length - productsAssigned} products stay global-only (no seller, or seller without a trusted college).`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
