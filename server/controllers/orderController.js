const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const { sendOrderConfirmationEmail, sendSellerOrderNotificationEmail, sendItemStatusUpdateEmail } = require("../utils/email");

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod, shippingPrice: shippingPriceFromClient } = req.body;
  const normalizedPaymentMethod = typeof paymentMethod === "string" ? paymentMethod.toLowerCase() : paymentMethod;
  try {
    console.log(`[ORDER] createOrder paymentMethod raw=${paymentMethod} normalized=${normalizedPaymentMethod}`);
  } catch (e) {}

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "No order items" });
  }

  // Fetch real prices from DB to prevent price tampering
  const productIds = items.map((i) => i.product);
  const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = Object.fromEntries(dbProducts.map((p) => [p._id.toString(), p]));

  // Preload seller user records for name fallbacks.
  // Also preload users referenced by product.sellerEmail so we can link email-only sellers.
  const sellerIds = Array.from(new Set(dbProducts.map((p) => (p.seller ? String(p.seller) : null)).filter(Boolean)));
  const sellerEmails = Array.from(new Set(dbProducts.map((p) => (p.sellerEmail ? String(p.sellerEmail).toLowerCase() : null)).filter(Boolean)));
  let sellerMap = {};
  if (sellerIds.length > 0) {
    const sellers = await User.find({ _id: { $in: sellerIds } }).lean();
    sellerMap = Object.fromEntries(sellers.map((s) => [String(s._id), s]));
  }

  let emailUserMap = {};
  if (sellerEmails.length > 0) {
    const emailUsers = await User.find({ email: { $in: sellerEmails } }).lean();
    emailUserMap = Object.fromEntries(emailUsers.map((s) => [String((s.email || "").toLowerCase()), s]));
  }

  const resolvedItems = items.map((item) => {
    const dbProduct = productMap[item.product];
    if (!dbProduct) throw new Error(`Product ${item.product} not found`);

    // Determine linked seller user (prefer explicit product.seller, otherwise match by sellerEmail)
    let sellerId = dbProduct.seller ? String(dbProduct.seller) : null;
    let sellerUser = sellerId ? sellerMap[sellerId] : null;
    if (!sellerUser && dbProduct.sellerEmail) {
      const emailKey = String(dbProduct.sellerEmail || "").toLowerCase();
      const matchedUser = emailUserMap[emailKey];
      if (matchedUser) {
        sellerId = String(matchedUser._id);
        sellerUser = matchedUser;
      }
    }

    // Determine MRP and final selling price.
    // Use `originalPrice` as the MRP when available; otherwise fall back to `price`.
    const mrp = Number(dbProduct.originalPrice ?? dbProduct.price ?? 0);
    const discountPct = Number(dbProduct.discount ?? 0);
    const discount = Number.isFinite(discountPct) ? Math.max(0, Math.min(100, discountPct)) : 0;
    let finalPrice;
    if (dbProduct.originalPrice !== undefined && dbProduct.originalPrice !== null) {
      // If originalPrice is present, compute final price from MRP and discount
      finalPrice = parseFloat((mrp * (1 - discount / 100)).toFixed(2));
    } else {
      // No recorded MRP — assume `price` is already the final selling price
      finalPrice = Number(dbProduct.price ?? 0);
    }

    return {
      product: dbProduct._id,
      name: dbProduct.name,
      image: dbProduct.images && dbProduct.images.length ? dbProduct.images[0] : "",
      // Snapshot both original and final prices so financials remain auditable
      originalPrice: basePrice,
      discount: discount,
      price: finalPrice,
      quantity: Number(item.quantity) || 1,
      // snapshot seller contact/location
      seller: sellerId || (dbProduct.seller || null),
      sellerName: (dbProduct.sellerProfile && dbProduct.sellerProfile.name) || (sellerUser && (sellerUser.sellerProfile?.name || sellerUser.name)) || "",
      sellerEmail: dbProduct.sellerEmail || (sellerUser && sellerUser.email) || "",
      sellerMobile: dbProduct.sellerMobile || (sellerUser && sellerUser.sellerProfile?.mobileNumber) || "",
      sellerHostelNumber: dbProduct.sellerHostelNumber || (sellerUser && sellerUser.sellerProfile?.hostelNumber) || "",
      sellerRoomNumber: dbProduct.sellerRoomNumber || (sellerUser && sellerUser.sellerProfile?.roomNumber) || "",
      // initial per-item status
      itemStatus: item.itemStatus || "Pending",
    };
  });

  const itemsPrice = resolvedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  // Allow client to pass shippingPrice (e.g., Buy Now delivery selection). Fallback to default logic.
  const shippingPrice = typeof shippingPriceFromClient === "number" ? shippingPriceFromClient : (itemsPrice > 50 ? 0 : 9.99);
  const taxPrice = parseFloat((itemsPrice * 0.1).toFixed(2));
  const totalPrice = parseFloat((itemsPrice + shippingPrice + taxPrice).toFixed(2));

  const order = await Order.create({
    user: req.user.id,
    items: resolvedItems,
    shippingAddress,
    paymentMethod: normalizedPaymentMethod,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
  });

  // Send order confirmation email (non-blocking)
  // Send buyer confirmation
  User.findById(req.user.id)
    .lean()
    .then((user) => {
      if (user?.email) {
        sendOrderConfirmationEmail(user.email, user.name || "Customer", order).catch(() => {});
      }
    })
    .catch(() => {});

  // Notify each seller about items sold (group by seller id or by seller email for unlinked sellers)
  const sellerItemsByUser = {};
  const sellerItemsByEmail = {};
  for (const item of resolvedItems) {
    const prod = productMap[item.product.toString()];
    const sellerId = item.seller ? String(item.seller) : null;
    if (sellerId) {
      sellerItemsByUser[sellerId] = sellerItemsByUser[sellerId] || [];
      sellerItemsByUser[sellerId].push({ productId: prod._id, name: prod.name, quantity: item.quantity, price: item.price });
    } else if (item.sellerEmail) {
      const emailKey = String(item.sellerEmail).toLowerCase();
      sellerItemsByEmail[emailKey] = sellerItemsByEmail[emailKey] || [];
      sellerItemsByEmail[emailKey].push({ productId: prod._id, name: prod.name, quantity: item.quantity, price: item.price });
    }
  }

  // Fetch buyer details once
  const buyer = await User.findById(req.user.id).lean();

  // Send notifications to linked users
  for (const sellerId of Object.keys(sellerItemsByUser)) {
    try {
      const sellerUser = await User.findById(sellerId).lean();
      if (!sellerUser || !sellerUser.email) continue;
      sendSellerOrderNotificationEmail(
        sellerUser.email,
        sellerUser.sellerProfile?.name || sellerUser.name || "Seller",
        sellerItemsByUser[sellerId],
        {
          buyerName: buyer?.name || "",
          buyerEmail: buyer?.email || "",
          shippingAddress,
        },
        order
      ).catch(() => {});
    } catch (err) {
      // ignore per-seller errors
    }
  }

  // Send notifications to email-only sellers (try to resolve to a registered user first)
  for (const emailKey of Object.keys(sellerItemsByEmail)) {
    try {
      const resolvedUser = await User.findOne({ email: emailKey }).lean();
      const toEmail = emailKey;
      const sellerName = resolvedUser ? (resolvedUser.sellerProfile?.name || resolvedUser.name || "Seller") : emailKey;
      sendSellerOrderNotificationEmail(
        toEmail,
        sellerName,
        sellerItemsByEmail[emailKey],
        {
          buyerName: buyer?.name || "",
          buyerEmail: buyer?.email || "",
          shippingAddress,
        },
        order
      ).catch(() => {});
    } catch (err) {
      // ignore
    }
  }

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
    // Decrease stock for ordered products instead of removing listings
    for (const item of order.items) {
      try {
        const p = await Product.findById(item.product);
        if (p) {
          const currentStock = Number(p.stock) || 0;
          const qty = Number(item.quantity) || 0;
          p.stock = Math.max(0, currentStock - qty);
          if (p.stock <= 0) p.isActive = false;
          await p.save();
        }
      } catch (err) {
        // continue on error
      }
    }
  }

  await order.save();
  res.status(200).json({ success: true, order });
};

// @desc    Update single order item's status (seller or admin)
// @route   PUT /api/orders/:orderId/items/:itemId/status
// @access  Private (seller or admin)
exports.updateOrderItemStatus = async (req, res) => {
  const { orderId, itemId } = req.params;
  const { status } = req.body;
  const allowed = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  const item = order.items.id(itemId);
  if (!item) return res.status(404).json({ success: false, message: "Order item not found" });

  const sellerId = item.seller ? String(item.seller) : null;
  const itemSellerEmail = item.sellerEmail ? String(item.sellerEmail).toLowerCase() : null;
  const itemSellerMobile = item.sellerMobile ? String(item.sellerMobile).trim() : null;

  const requesterId = req.user?.id;
  const requesterEmail = req.user?.email ? String(req.user.email).toLowerCase() : null;
  const requesterMobile = req.user?.sellerProfile?.mobileNumber ? String(req.user.sellerProfile.mobileNumber).trim() : null;

  const isSellerOwner = sellerId && requesterId && sellerId === requesterId;
  const isEmailMatch = itemSellerEmail && requesterEmail && itemSellerEmail === requesterEmail;
  const isMobileMatch = itemSellerMobile && requesterMobile && itemSellerMobile === requesterMobile;

  if (req.user.role !== "admin" && !isSellerOwner && !isEmailMatch && !isMobileMatch) {
    return res.status(403).json({ success: false, message: "Not authorized to update this item" });
  }

  // If seller matched by email/mobile and the item wasn't linked to a user, attach the user id for future convenience
  if (!sellerId && (isEmailMatch || isMobileMatch) && requesterId) {
    item.seller = requesterId;
    if (!item.sellerName) item.sellerName = req.user.sellerProfile?.name || req.user.name || "";
    if (!item.sellerEmail) item.sellerEmail = req.user.email || "";
    if (!item.sellerMobile) item.sellerMobile = req.user.sellerProfile?.mobileNumber || "";
  }

  // Debug: log who requested the change and the requested status
  try {
    console.log(`[ORDER] updateItemStatus requested: order=${orderId}, item=${itemId}, requestedBy=${req.user?.id || req.user?._id}, role=${req.user?.role}, newStatus=${status}`);
  } catch (e) {}

  item.itemStatus = status;
  try { console.log(`[ORDER] item ${itemId} status set to ${item.itemStatus} (order ${orderId})`); } catch (e) {}

  // If delivered, mark product sold and remove from listings
  if (status === "Delivered") {
    try {
      const p = await Product.findById(item.product);
      if (p) {
        const currentStock = Number(p.stock) || 0;
        const qty = Number(item.quantity) || 0;
        p.stock = Math.max(0, currentStock - qty);
        if (p.stock <= 0) p.isActive = false;
        await p.save();
      }
    } catch (e) {
      // ignore
    }
  }

  // Recompute overall order status based on per-item statuses to maintain integrity
  // Rules:
  // - If all items are "Cancelled" => order.status = "Cancelled"
  // - Else if all items are "Delivered" => order.status = "Delivered" (mark delivered)
  // - Else order.status is the highest-progress status among items: Pending < Processing < Shipped < Delivered
  const statusRank = { Pending: 0, Processing: 1, Shipped: 2, Delivered: 3 };
  const itemStatuses = order.items.map((it) => it.itemStatus || "Pending");

  const allCancelled = itemStatuses.every((s) => s === "Cancelled");
  const allDelivered = itemStatuses.every((s) => s === "Delivered");

  if (allCancelled) {
    order.status = "Cancelled";
  } else if (allDelivered) {
    order.status = "Delivered";
    order.isDelivered = true;
    order.deliveredAt = order.deliveredAt || Date.now();
  } else {
    // compute highest status ignoring 'Cancelled'
    let maxRank = 0;
    for (const s of itemStatuses) {
      if (s === "Cancelled") continue;
      const r = statusRank[s] ?? 0;
      if (r > maxRank) maxRank = r;
    }
    const rankToStatus = Object.entries(statusRank).reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {});
    order.status = rankToStatus[maxRank] || "Pending";
    // if status moves away from Delivered, ensure isDelivered flag is unset
    if (order.status !== "Delivered") {
      order.isDelivered = false;
    }
  }

  try { console.log(`[ORDER] recomputed order ${orderId} status=${order.status} (itemStatuses=${JSON.stringify(itemStatuses)})`); } catch (e) {}
  await order.save();
  try { console.log(`[ORDER] saved order ${order._id} with status=${order.status}`); } catch (e) {}

  // Notify buyer about this item's status update (non-blocking)
  try {
    const buyer = await User.findById(order.user).lean();
    if (buyer?.email) {
      // sendItemStatusUpdateEmail defined in utils/email
      await sendItemStatusUpdateEmail(buyer.email, buyer.name || "", order, item, status).catch(() => {});
    }
  } catch (e) {
    // ignore notification errors
  }

  res.status(200).json({ success: true, order });
};

// @desc    Get orders for seller (their products)
// @route   GET /api/orders/seller/my
// @access  Private (seller)
exports.getSellerOrders = async (req, res) => {
  // Find products owned by this seller. Support three matching strategies:
  // 1) products with `seller` set to this user's id
  // 2) products with `sellerEmail` matching this user's email
  // 3) products with `sellerMobile` matching this user's seller profile mobile
  const sellerEmailNormalized = req.user?.email ? String(req.user.email).toLowerCase() : null;
  const sellerMobileNormalized = req.user?.sellerProfile?.mobileNumber ? String(req.user.sellerProfile.mobileNumber).trim() : null;

  const orFilters = [{ seller: req.user.id }];
  if (sellerEmailNormalized) orFilters.push({ sellerEmail: sellerEmailNormalized });
  if (sellerMobileNormalized) orFilters.push({ sellerMobile: sellerMobileNormalized });

  const sellerProducts = await Product.find({ $or: orFilters }).select("_id").lean();
  const productIds = sellerProducts.map((p) => p._id);

  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const query = { "items.product": { $in: productIds } };

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort("-createdAt")
      .skip(skip)
      .limit(Number(limit))
      .populate("user", "name email")
      .populate("items.product", "name images"),
    Order.countDocuments(query),
  ]);

  res.status(200).json({ success: true, total, page: Number(page), orders });
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
