const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Category = require("../models/Category");

// @desc    Get all users (admin)
// @route   GET /api/users
// @access  Admin
exports.getUsers = async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const query = search ? { name: { $regex: search, $options: "i" } } : {};

  const [users, total] = await Promise.all([
    User.find(query).sort("-createdAt").skip(skip).limit(Number(limit)),
    User.countDocuments(query),
  ]);

  res.status(200).json({ success: true, total, page: Number(page), users });
};

// @desc    Get single user (admin)
// @route   GET /api/users/:id
// @access  Admin
exports.getUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.status(200).json({ success: true, user });
};

// @desc    Update user role / status (admin)
// @route   PUT /api/users/:id
// @access  Admin
exports.updateUser = async (req, res) => {
  const { role, isActive } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role, isActive },
    { new: true, runValidators: true }
  );

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.status(200).json({ success: true, user });
};

// @desc    Delete user (admin)
// @route   DELETE /api/users/:id
// @access  Admin
exports.deleteUser = async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.status(200).json({ success: true, message: "User deleted" });
};

// @desc    Get admin dashboard stats
// @route   GET /api/users/dashboard
// @access  Admin
exports.getDashboardStats = async (req, res) => {
  const [totalProducts, totalCategories, totalOrders, totalUsers, revenueResult] =
    await Promise.all([
      Product.countDocuments({ isActive: true }),
      Category.countDocuments({ isActive: true }),
      Order.countDocuments(),
      User.countDocuments(),
      Order.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } },
      ]),
    ]);

  // Sales by month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const salesData = await Order.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $ne: "Cancelled" } } },
    {
      $group: {
        _id: { $month: "$createdAt" },
        sales: { $sum: "$totalPrice" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Recent 5 orders
  const recentOrders = await Order.find()
    .sort("-createdAt")
    .limit(5)
    .populate("user", "name email");

  res.status(200).json({
    success: true,
    stats: {
      totalProducts,
      totalCategories,
      totalOrders,
      totalUsers,
      revenue: revenueResult[0]?.total || 0,
    },
    salesData,
    recentOrders,
  });
};
