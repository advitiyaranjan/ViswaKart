const Stripe = require("stripe");
const Order = require("../models/Order");
const { quoteOrder, createOrder } = require("../services/orderService");
const { cartFingerprint, fail } = require("../utils/commerce");

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) fail("Card payments are currently unavailable", 503);
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

exports.createPaymentIntent = async (req, res) => {
  const quote = await quoteOrder(req.body);
  const intent = await getStripe().paymentIntents.create({
    amount: Math.round(quote.breakdown.totalPrice * 100), currency: "inr", automatic_payment_methods: { enabled: true },
    metadata: { userId: String(req.user.id), cartHash: cartFingerprint(quote.items, quote.shippingMethod), shippingMethod: quote.shippingMethod },
  });
  res.json({ success: true, clientSecret: intent.client_secret, paymentIntentId: intent.id, breakdown: quote.breakdown });
};

exports.confirmOrder = async (req, res) => {
  if (typeof req.body.paymentIntentId !== "string" || !/^pi_[A-Za-z0-9]+$/.test(req.body.paymentIntentId)) fail("Invalid payment intent");
  const intent = await getStripe().paymentIntents.retrieve(req.body.paymentIntentId);
  if (intent.status !== "succeeded") fail("Payment not completed");
  if (intent.metadata.userId !== String(req.user.id)) fail("Payment belongs to another account", 403);
  if (intent.currency !== "inr") fail("Payment currency does not match checkout");
  const existing = await Order.findOne({ "paymentResult.id": intent.id });
  if (existing) return res.json({ success: true, order: existing });
  const body = { ...req.body, shippingMethod: intent.metadata.shippingMethod };
  const { order } = await createOrder(req.user.id, body, {
    id: intent.id,
    validate(quote) {
      if (intent.metadata.cartHash !== cartFingerprint(quote.items, quote.shippingMethod) || intent.amount_received !== Math.round(quote.breakdown.totalPrice * 100)) {
        fail("Payment does not match this cart. Contact support before retrying.", 409);
      }
    },
  });
  res.status(201).json({ success: true, order });
};
