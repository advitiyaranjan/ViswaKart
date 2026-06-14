const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { pagination, escapeRegex, fail } = require("../utils/commerce");
const { SELLER_STATUSES, sellerStatusOf, sellerSummaryWithCollege, legacyFlags, isCampusEligible } = require("../utils/seller");
const { requireActiveCollege } = require("../utils/college");

exports.getUsers = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const query = {};
  if (req.query.search) {
    const pattern = { $regex: escapeRegex(String(req.query.search).slice(0, 100)), $options: "i" };
    query.$or = [{ name: pattern }, { email: pattern }];
  }
  if (req.query.role) {
    if (!["user", "admin"].includes(req.query.role)) fail("Invalid role filter");
    query.role = req.query.role;
  }
  const [users, total] = await Promise.all([
    User.find(query).sort("-createdAt").skip(skip).limit(limit), User.countDocuments(query),
  ]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), users });
};

exports.getUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) fail("User not found", 404);
  res.json({ success: true, user });
};

exports.updateUser = async (req, res) => {
  const updates = {};
  if (req.body.role !== undefined) {
    if (!["user", "admin"].includes(req.body.role)) fail("Invalid user role");
    updates.role = req.body.role;
  }
  if (req.body.isActive !== undefined) {
    if (typeof req.body.isActive !== "boolean") fail("Active status must be true or false");
    updates.isActive = req.body.isActive;
  }
  if (String(req.params.id) === String(req.user.id) && (updates.role === "user" || updates.isActive === false)) fail("You cannot remove your own administrator access");
  const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
  if (!user) fail("User not found", 404);
  res.json({ success: true, user });
};

const SELLER_TEXT = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

exports.getMySellerStatus = async (req, res) => {
  res.json({ success: true, seller: await sellerSummaryWithCollege(req.user) });
};

// PUT /api/users/me/seller-college — a seller without an affiliation (accounts created before colleges existed)
// may choose one once. After that only an admin can change it, so listings can't be moved between campuses.
exports.setMySellerCollege = async (req, res) => {
  const college = await requireActiveCollege(req.body.collegeId);
  const updated = await User.findOneAndUpdate(
    { _id: req.user.id, $or: [{ "sellerProfile.college": null }, { "sellerProfile.college": { $exists: false } }] },
    { $set: { "sellerProfile.college": college._id } },
    { new: true }
  );
  if (!updated) fail("Your college is already set. Contact support to change it.", 409);
  res.json({ success: true, seller: await sellerSummaryWithCollege(updated) });
};

// PUT /api/users/:id/seller-college — admin correction. Applies to future listings only; existing products and orders keep their college.
exports.adminSetSellerCollege = async (req, res) => {
  const college = await requireActiveCollege(req.body.collegeId);
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { "sellerProfile.college": college._id } }, { new: true });
  if (!user) fail("User not found", 404);
  res.json({ success: true, user, college });
};

exports.requestSellerAccess = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) fail("User not found", 404);
  const status = sellerStatusOf(user);
  if (status === "approved" || user.role === "admin") return res.json({ success: true, message: "Seller access is already approved", seller: await sellerSummaryWithCollege(user) });
  if (status === "pending") fail("Your seller application is already waiting for review", 409);
  if (status === "suspended") fail("Your seller account is suspended. Contact support to have it reviewed.", 403);

  const name = SELLER_TEXT(req.body.name, 100) || user.name;
  const mobileNumber = String(req.body.mobileNumber ?? "").replace(/\D/g, "");
  const hostelNumber = SELLER_TEXT(req.body.hostelNumber, 50);
  const roomNumber = SELLER_TEXT(req.body.roomNumber, 50);
  const courseYear = SELLER_TEXT(req.body.courseYear, 50);
  const message = SELLER_TEXT(req.body.message, 1000);
  const errors = {};
  if (name.length < 2) errors.name = "Enter your full name";
  if (!/^[0-9]{7,15}$/.test(mobileNumber)) errors.mobileNumber = "Enter a valid 7–15 digit mobile number";
  if (!hostelNumber) errors.hostelNumber = "Enter your hostel or block so buyers know where to collect";
  if (!roomNumber) errors.roomNumber = "Enter your room number";
  let college = null;
  try {
    college = await requireActiveCollege(req.body.collegeId, "Select your college from the list");
  } catch (error) {
    errors.collegeId = error.message;
  }
  if (Object.keys(errors).length) return res.status(400).json({ success: false, message: Object.values(errors)[0], errors });

  // Atomic guard: two quick submissions cannot both create an application.
  const updated = await User.findOneAndUpdate(
    { _id: user._id, sellerStatus: { $nin: ["pending", "approved", "suspended"] }, sellerRequested: { $ne: true } },
    {
      $set: {
        ...legacyFlags("pending"), sellerRequestedAt: new Date(), sellerRejectionReason: "", sellerRequestMessage: message,
        sellerProfile: { name, mobileNumber, hostelNumber, roomNumber, courseYear, college: college._id },
      },
    },
    { new: true, runValidators: true }
  );
  if (!updated) fail("Your seller application is already waiting for review", 409);
  res.status(201).json({ success: true, message: "Seller application submitted", seller: await sellerSummaryWithCollege(updated) });
};

exports.getSellerRequests = async (req, res) => {
  const { page, limit, skip } = pagination(req.query, 50);
  const status = req.query.status || "pending";
  if (!SELLER_STATUSES.includes(status) || status === "none") fail("Invalid seller status filter");
  // Legacy accounts without `sellerStatus` are matched through their boolean flags.
  const legacy = { $or: [{ sellerStatus: { $exists: false } }, { sellerStatus: "none" }] };
  const query = status === "pending"
    ? { $or: [{ sellerStatus: "pending" }, { ...legacy, sellerRequested: true }] }
    : status === "approved"
      ? { $or: [{ sellerStatus: "approved" }, { ...legacy, isSeller: true, sellerApproved: true }] }
      : { sellerStatus: status };
  const sort = status === "pending" ? "-sellerRequestedAt" : "-sellerReviewedAt";
  const [users, total] = await Promise.all([User.find(query).sort(sort).skip(skip).limit(limit).populate("sellerProfile.college", "name city state isActive"), User.countDocuments(query)]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), users: users.map((user) => ({ ...user.toObject(), sellerStatus: sellerStatusOf(user) })) });
};

async function setSellerStatus(req, res, { from, to, reasonField, message }) {
  const user = await User.findById(req.params.id);
  if (!user) fail("User not found", 404);
  // A campus account that sells without applying is treated as an approved seller (it can be suspended).
  const current = sellerStatusOf(user) === "none" && isCampusEligible(user) ? "approved" : sellerStatusOf(user);
  if (!from.includes(current)) fail(`This seller is ${current === "none" ? "not an applicant" : current} and cannot be ${message}`, 409);
  if (String(user._id) === String(req.user.id) && to === "suspended") fail("You cannot suspend your own account");
  Object.assign(user, legacyFlags(to), { sellerReviewedAt: new Date() });
  if (to === "approved") {
    user.sellerApprovedAt = new Date();
    user.sellerRejectionReason = "";
    user.sellerSuspensionReason = "";
  }
  if (reasonField) user[reasonField] = SELLER_TEXT(req.body?.reason, 1000);
  await user.save();
  res.json({ success: true, user: { ...user.toObject(), sellerStatus: to } });
}

exports.approveSellerRequest = (req, res) => setSellerStatus(req, res, { from: ["pending", "rejected"], to: "approved", message: "approved" });
exports.rejectSellerRequest = (req, res) => setSellerStatus(req, res, { from: ["pending"], to: "rejected", reasonField: "sellerRejectionReason", message: "rejected" });
exports.suspendSeller = (req, res) => setSellerStatus(req, res, { from: ["approved"], to: "suspended", reasonField: "sellerSuspensionReason", message: "suspended" });
exports.reinstateSeller = (req, res) => setSellerStatus(req, res, { from: ["suspended"], to: "approved", message: "reinstated" });

exports.deleteUser = async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) fail("You cannot deactivate your own administrator account");
  // Keep order/product references and the Clerk identity intact.
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true });
  if (!user) fail("User not found", 404);
  res.json({ success: true, message: "User deactivated", user });
};

exports.getDashboardStats = async (req, res) => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const paid = { isPaid: true, status: { $ne: "Cancelled" } };
  const [totalProducts, totalCategories, totalOrders, totalUsers, revenue, monthly, recentOrders] = await Promise.all([
    Product.countDocuments({ isActive: true }), Category.countDocuments({ isActive: true }), Order.countDocuments(), User.countDocuments({ isActive: true }),
    Order.aggregate([{ $match: paid }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }]),
    Order.aggregate([{ $match: { ...paid, createdAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } }, sales: { $sum: "$totalPrice" } } }, { $sort: { _id: 1 } }]),
    Order.find().sort("-createdAt").limit(5).populate("user", "name email"),
  ]);
  const salesData = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1)).toISOString().slice(0, 7);
    return { _id: month, month, sales: monthly.find((entry) => entry._id === month)?.sales || 0 };
  });
  res.json({ success: true, stats: { totalProducts, totalCategories, totalOrders, totalUsers, revenue: revenue[0]?.total || 0 }, salesData, recentOrders });
};
