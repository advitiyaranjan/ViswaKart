const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { pagination, escapeRegex, fail } = require("../utils/commerce");

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

exports.requestSellerAccess = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) fail("User not found", 404);
  if (user.sellerApproved) return res.json({ success: true, message: "Seller access is already approved" });
  const mobileNumber = String(req.body.mobileNumber || user.sellerProfile?.mobileNumber || "").replace(/\D/g, "");
  if (!/^[0-9]{7,15}$/.test(mobileNumber)) fail("Provide a valid mobile number");
  user.sellerRequested = true;
  user.sellerRequestedAt = new Date();
  user.sellerProfile = {
    ...user.sellerProfile?.toObject?.(), name: req.body.name || user.name,
    hostelNumber: req.body.hostelNumber || user.sellerProfile?.hostelNumber || "",
    roomNumber: req.body.roomNumber || user.sellerProfile?.roomNumber || "",
    courseYear: req.body.courseYear || user.sellerProfile?.courseYear || "", mobileNumber,
  };
  user.sellerRequestMessage = String(req.body.message || "").slice(0, 2000);
  await user.save();
  res.json({ success: true, message: "Seller access requested" });
};

exports.getSellerRequests = async (req, res) => {
  const { page, limit, skip } = pagination(req.query, 50);
  const query = { sellerRequested: true };
  const [users, total] = await Promise.all([User.find(query).sort("-sellerRequestedAt").skip(skip).limit(limit), User.countDocuments(query)]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), users });
};

exports.approveSellerRequest = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) fail("User not found", 404);
  user.isSeller = true; user.sellerApproved = true; user.sellerApprovedAt = new Date(); user.sellerRequested = false;
  await user.save();
  res.json({ success: true, user });
};

exports.rejectSellerRequest = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) fail("User not found", 404);
  user.sellerRequested = false; user.sellerApproved = false; user.isSeller = false;
  user.sellerRequestMessage = String(req.body.reason || user.sellerRequestMessage || "").slice(0, 2000);
  await user.save();
  res.json({ success: true, user });
};

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
