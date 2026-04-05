const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const { sendOrderConfirmationEmail } = require("../utils/email");

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "No order items" });
  }

  // Fetch real prices from DB to prevent price tampering
  const productIds = items.map((i) => i.product);
  const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = Object.fromEntries(dbProducts.map((p) => [p._id.toString(), p]));

  const resolvedItems = items.map((item) => {
    const dbProduct = productMap[item.product];
    if (!dbProduct) throw new Error(`Product ${item.product} not found`);
    return {
      product: dbProduct._id,
      name: dbProduct.name,
      image: dbProduct.images[0] || "",
      price: dbProduct.price,
      quantity: item.quantity,
    };
  });

  const itemsPrice = resolvedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingPrice = itemsPrice > 50 ? 0 : 9.99;
  const taxPrice = parseFloat((itemsPrice * 0.1).toFixed(2));
  const totalPrice = parseFloat((itemsPrice + shippingPrice + taxPrice).toFixed(2));

  const order = await Order.create({
    user: req.user.id,
    items: resolvedItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
  });

  // Send order confirmation email (non-blocking)
  User.findById(req.user.id).lean().then((user) => {
    if (user?.email) {
      sendOrderConfirmationEmail(user.email, user.name || "Customer", order).catch(() => {});
    }
  }).catch(() => {});

  res.status(201).json({ success: true, order });
};

// @desc    Get logged-in user's orders
// @route   GET /api/orders/my
// @access  Private
exports.getMyOrders = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    Order.find({ user: req.user.id })
      .sort("-createdAt")
      .skip(skip)
      .limit(Number(limit))
      .populate("items.product", "name images"),
    Order.countDocuments({ user: req.user.id }),
  ]);

  res.status(200).json({ success: true, total, orders });
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "name email")
    .populate("items.product", "name images");

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // Users can only see their own orders; admins can see all
  if (order.user._id.toString() !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  res.status(200).json({ success: true, order });
};

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Admin
exports.getAllOrders = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const query = status ? { status } : {};

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort("-createdAt")
      .skip(skip)
      .limit(Number(limit))
      .populate("user", "name email"),
    Order.countDocuments(query),
  ]);

  res.status(200).json({ success: true, total, page: Number(page), orders });
};

// @desc    Update order status (admin)
// @route   PUT /api/orders/:id/status
// @access  Admin
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  order.status = status;

  if (status === "Delivered") {
    order.isDelivered = true;
    order.deliveredAt = Date.now();
  }

  await order.save();
  res.status(200).json({ success: true, order });
};

// @desc    Cancel own order
// @route   PUT /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  if (order.user.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  if (!["Pending", "Processing"].includes(order.status)) {
    return res.status(400).json({ success: false, message: "Order cannot be cancelled at this stage" });
  }

  order.status = "Cancelled";
  await order.save();
  res.status(200).json({ success: true, order });
};
