const Order = require("../models/Order");
const User = require("../models/User");
const orderService = require("../services/orderService");
const { pagination, escapeRegex, STATUSES, fail } = require("../utils/commerce");
const { sendOrderConfirmationEmail, sendSellerOrderNotificationEmail, sendItemStatusUpdateEmail } = require("../utils/email");

async function notifyOrder(order, buyer) {
  if (buyer.email) await sendOrderConfirmationEmail(buyer.email, buyer.name || "Customer", order).catch(() => {});
  for (const item of order.items) {
    if (item.sellerEmail) await sendSellerOrderNotificationEmail(item.sellerEmail, item.sellerName || "Seller", [{ productId: item.product, name: item.name, quantity: item.quantity, price: item.price }], { buyerName: buyer.name, buyerEmail: buyer.email, shippingAddress: order.shippingAddress }, order).catch(() => {});
  }
}

exports.quoteOrder = async (req, res) => {
  const quote = await orderService.quoteOrder(req.body);
  res.json({ success: true, ...quote });
};

exports.createOrder = async (req, res) => {
  if (typeof req.body.paymentMethod !== "undefined" && req.body.paymentMethod !== "cod") fail("Card payments must be completed through secure payment checkout");
  const { order, created } = await orderService.createOrder(req.user.id, req.body);
  if (created) void notifyOrder(order, req.user).catch(() => {});
  res.status(created ? 201 : 200).json({ success: true, order });
};

exports.getMyOrders = async (req, res) => {
  const { page, limit, skip } = pagination(req.query, 10);
  const query = { user: req.user.id };
  const [orders, total] = await Promise.all([
    Order.find(query).sort("-createdAt").skip(skip).limit(limit).populate("items.product", "name images"),
    Order.countDocuments(query),
  ]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), orders });
};

exports.getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email").populate("items.product", "name images");
  if (!order) fail("Order not found", 404);
  if (String(order.user?._id) !== String(req.user.id) && req.user.role !== "admin") fail("Not authorized", 403);
  res.json({ success: true, order });
};

exports.getAllOrders = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const query = {};
  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) fail("Invalid order status");
    query.status = req.query.status;
  }
  if (req.query.search) {
    const search = String(req.query.search).trim().slice(0, 100);
    const users = await User.find({ $or: [{ name: { $regex: escapeRegex(search), $options: "i" } }, { email: { $regex: escapeRegex(search), $options: "i" } }] }).select("_id").lean();
    query.$or = [{ user: { $in: users.map((user) => user._id) } }];
    if (/^[a-f\d]{24}$/i.test(search)) query.$or.push({ _id: search });
  }
  const [orders, total] = await Promise.all([
    Order.find(query).sort("-createdAt").skip(skip).limit(limit).populate("user", "name email"),
    Order.countDocuments(query),
  ]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), orders });
};

exports.updateOrderStatus = async (req, res) => {
  const order = await orderService.updateStatus(req.params.id, req.body.status, { user: req.user });
  res.json({ success: true, order });
};

exports.updateOrderItemStatus = async (req, res) => {
  const order = await orderService.updateStatus(req.params.orderId, req.body.status, { itemId: req.params.itemId, user: req.user });
  const buyer = await User.findById(order.user).lean();
  if (buyer?.email) void sendItemStatusUpdateEmail(buyer.email, buyer.name, order, order.items.id(req.params.itemId), req.body.status).catch(() => {});
  res.json({ success: true, order });
};

exports.getSellerOrders = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const query = { "items.seller": req.user.id };
  const [results, total] = await Promise.all([
    Order.find(query).sort("-createdAt").skip(skip).limit(limit).populate("user", "name email").populate("items.product", "name images").lean(),
    Order.countDocuments(query),
  ]);
  const orders = results.map((order) => {
    const items = order.items.filter((item) => String(item.seller) === String(req.user.id));
    const itemsPrice = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    return { ...order, items, itemsPrice, totalPrice: itemsPrice, shippingPrice: 0, taxPrice: 0 };
  });
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), orders });
};

exports.cancelOrder = async (req, res) => {
  const order = await orderService.updateStatus(req.params.id, "Cancelled", { user: req.user, ownerOnly: true });
  res.json({ success: true, order });
};
