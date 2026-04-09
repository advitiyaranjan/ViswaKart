const Stripe = require("stripe");
const Order = require("../models/Order");
const Product = require("../models/Product");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// @desc   Create a Stripe PaymentIntent for the cart total
// @route  POST /api/payments/create-intent
// @access Private
exports.createPaymentIntent = async (req, res) => {
  const { items, shippingPrice = 0, couponDiscount = 0 } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "No items in cart" });
  }

  // Fetch real prices from DB to avoid price tampering
  const productIds = items.map((i) => i.product);
  const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = Object.fromEntries(dbProducts.map((p) => [p._id.toString(), p]));

  const itemsPrice = items.reduce((sum, item) => {
    const p = productMap[item.product];
    if (!p) throw new Error(`Product ${item.product} not found`);
    return sum + p.price * item.quantity;
  }, 0);

  const taxPrice = itemsPrice * 0.08;
  const total = itemsPrice - couponDiscount + shippingPrice + taxPrice;
  const amountInCents = Math.round(total * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: { userId: req.user._id.toString() },
  });

  res.json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    breakdown: {
      itemsPrice: parseFloat(itemsPrice.toFixed(2)),
      shippingPrice: parseFloat(shippingPrice.toFixed(2)),
      taxPrice: parseFloat(taxPrice.toFixed(2)),
      couponDiscount: parseFloat(couponDiscount.toFixed(2)),
      totalPrice: parseFloat(total.toFixed(2)),
    },
  });
};

// @desc   Confirm order in DB after successful Stripe payment
// @route  POST /api/payments/confirm-order
// @access Private
exports.confirmOrder = async (req, res) => {
  const { paymentIntentId, items, shippingAddress, breakdown } = req.body;

  // Verify payment actually succeeded with Stripe
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded") {
    return res.status(400).json({ success: false, message: "Payment not completed" });
  }

  // Resolve items with real DB prices
  const productIds = items.map((i) => i.product);
  const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = Object.fromEntries(dbProducts.map((p) => [p._id.toString(), p]));

  const resolvedItems = items.map((item) => {
    const p = productMap[item.product];
    if (!p) throw new Error(`Product ${item.product} not found`);
    return {
      product: p._id,
      name: p.name,
      image: p.images?.[0] || "",
      price: p.price,
      quantity: item.quantity,
    };
  });

  const order = await Order.create({
    user: req.user._id,
    items: resolvedItems,
    shippingAddress,
    paymentMethod: "card",
    paymentResult: {
      id: intent.id,
      status: intent.status,
      update_time: new Date().toISOString(),
    },
    itemsPrice: breakdown.itemsPrice,
    shippingPrice: breakdown.shippingPrice,
    taxPrice: breakdown.taxPrice,
    totalPrice: breakdown.totalPrice,
    isPaid: true,
    paidAt: new Date(),
    status: "Processing",
  });

  res.status(201).json({ success: true, order });
};
