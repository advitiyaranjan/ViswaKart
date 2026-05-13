const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const {
  normalizeItems, validateAddress, calculateQuote, fail, canTransition, summarizeStatus, normalizePricing,
  normalizeRequestId, FINAL_STATUSES, STATUSES,
} = require("../utils/commerce");

async function quoteOrder(body, session = null) {
  const requested = normalizeItems(body.items);
  const shippingMethod = body.shippingMethod || "standard";
  if (Number(body.couponDiscount || 0) !== 0) fail("This checkout does not support coupon discounts");
  const products = await Product.find({ _id: { $in: requested.map((item) => item.product) } }).session(session).lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const sellerIds = [...new Set(products.filter((product) => product.seller).map((product) => String(product.seller)))];
  const sellers = sellerIds.length ? await User.find({ _id: { $in: sellerIds } }).session(session).lean() : [];
  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller]));
  const items = requested.map(({ product: id, quantity }) => {
    const product = productMap.get(id);
    if (!product || !product.isActive || product.sold) fail("An item in your cart is no longer available", 409);
    if (quantity > product.stock) fail(`Only ${product.stock} available for ${product.name}`, 409);
    if (!Number.isFinite(product.price) || product.price < 0) fail(`Invalid price for ${product.name}`, 409);
    // The stored discount percentage can be stale; derive it from the prices actually charged.
    const pricing = normalizePricing({ price: product.price, originalPrice: product.originalPrice });
    const seller = sellerMap.get(String(product.seller));
    return {
      product: product._id, name: product.name, image: product.images?.[0] || "", ...pricing,
      quantity, seller: product.seller || null, sellerName: seller?.sellerProfile?.name || seller?.name || "",
      sellerEmail: product.sellerEmail || seller?.email || "", sellerMobile: product.sellerMobile || seller?.sellerProfile?.mobileNumber || "",
      sellerHostelNumber: product.sellerHostelNumber || seller?.sellerProfile?.hostelNumber || "",
      sellerRoomNumber: product.sellerRoomNumber || seller?.sellerProfile?.roomNumber || "", itemStatus: "Pending",
    };
  });
  return { items, shippingMethod, breakdown: calculateQuote(items, shippingMethod) };
}

async function inTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } catch (error) {
    if (error.code === 20 || /Transaction numbers are only allowed/.test(error.message)) {
      fail("Checkout requires a MongoDB replica set. Please contact support.", 503);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

/** Returns `{ order, created }`; `created` is false when an earlier identical request already placed the order. */
async function createOrder(userId, body, payment = null) {
  const shippingAddress = validateAddress(body.shippingAddress);
  const clientRequestId = normalizeRequestId(body.requestId);
  try {
    return await inTransaction(async (session) => {
      if (payment) {
        const existing = await Order.findOne({ "paymentResult.id": payment.id }).session(session);
        if (existing) {
          if (String(existing.user) !== String(userId)) fail("Payment belongs to another account", 403);
          return { order: existing, created: false };
        }
      }
      if (clientRequestId) {
        const existing = await Order.findOne({ user: userId, clientRequestId }).session(session);
        if (existing) return { order: existing, created: false };
      }
      const quote = await quoteOrder(body, session);
      if (body.expectedTotal !== undefined && (typeof body.expectedTotal !== "number" || Math.round(body.expectedTotal * 100) !== Math.round(quote.breakdown.totalPrice * 100))) {
        fail("Your order total changed. Review the updated total and try again.", 409);
      }
      if (payment) payment.validate(quote);
      for (const item of quote.items) {
        const reserved = await Product.updateOne(
          { _id: item.product, isActive: true, sold: { $ne: true }, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }, { session }
        );
        if (reserved.modifiedCount !== 1) fail(`${item.name} no longer has enough stock`, 409);
      }
      const [order] = await Order.create([{
        user: userId, clientRequestId,
        items: quote.items.map((item) => ({ ...item, inventoryReserved: true, itemStatus: payment ? "Processing" : "Pending" })),
        shippingAddress, shippingMethod: quote.shippingMethod, paymentMethod: payment ? "card" : "cod", ...quote.breakdown,
        status: payment ? "Processing" : "Pending", isPaid: Boolean(payment), paidAt: payment ? new Date() : undefined,
        paymentResult: payment ? { id: payment.id, status: "succeeded", updateTime: new Date().toISOString() } : undefined,
      }], { session });
      return { order, created: true };
    });
  } catch (error) {
    // Two concurrent submissions of the same checkout: the loser returns the winner's order.
    if (error.code === 11000 && clientRequestId) {
      const existing = await Order.findOne({ user: userId, clientRequestId });
      if (existing) return { order: existing, created: false };
    }
    throw error;
  }
}

async function updateStatus(orderId, status, { itemId, user, ownerOnly = false } = {}) {
  if (!STATUSES.includes(status)) fail("Invalid order status");
  return inTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) fail("Order not found", 404);
    const userId = String(user.id || user._id);
    if (ownerOnly && String(order.user) !== userId) fail("Not authorized", 403);
    let targets;
    if (itemId) {
      const item = order.items.id(itemId);
      if (!item) fail("Order item not found", 404);
      if (user.role !== "admin" && String(item.seller) !== userId) fail("Not authorized to update this item", 403);
      targets = [item];
    } else {
      // Whole-order updates move the items still in progress; delivered or cancelled items stay as they are.
      targets = order.items.filter((item) => !FINAL_STATUSES.includes(item.itemStatus));
      if (!targets.length) fail(`This order is already ${order.status.toLowerCase()}`);
    }
    if (ownerOnly && targets.some((item) => !["Pending", "Processing"].includes(item.itemStatus))) {
      fail("This order has already shipped and can no longer be cancelled");
    }
    for (const item of targets) {
      if (!canTransition(item.itemStatus, status)) fail(`Cannot change ${item.itemStatus} to ${status}`);
      if (item.itemStatus === status) continue;
      if (status === "Cancelled" && item.inventoryReserved) {
        await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity }, $set: { sold: false } }, { session });
        item.inventoryReserved = false;
      }
      // Legacy orders created before stock reservation still consume inventory once.
      if (status === "Delivered" && !item.inventoryReserved) {
        const result = await Product.updateOne({ _id: item.product, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { session });
        if (result.modifiedCount !== 1) fail(`Insufficient inventory for ${item.name}`, 409);
        item.inventoryReserved = true;
      }
      item.itemStatus = status;
    }
    order.status = summarizeStatus(order.items);
    order.isDelivered = order.status === "Delivered";
    order.deliveredAt = order.isDelivered ? (order.deliveredAt || new Date()) : undefined;
    if (order.isDelivered && order.paymentMethod === "cod") { order.isPaid = true; order.paidAt ||= new Date(); }
    await order.save({ session });
    return order;
  });
}

module.exports = { quoteOrder, createOrder, updateStatus, inTransaction };
