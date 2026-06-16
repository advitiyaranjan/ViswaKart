const Stripe = require("stripe");
const Order = require("../models/Order");
const User = require("../models/User");
const PaymentAttempt = require("../models/PaymentAttempt");
const { quoteOrder, createOrder } = require("./orderService");
const { notifyOrder } = require("./orderNotifications");
const { cartFingerprint, validateAddress, normalizeRequestId, money, fail } = require("../utils/commerce");

const CURRENCY = "inr";
// Stripe's minimum charge for INR is ₹0.50.
const MIN_AMOUNT = 50;
const toMinor = (rupees) => Math.round(money(rupees) * 100);

let client = null;
let testClient = null;

function isEnabled() {
  return Boolean(testClient || process.env.STRIPE_SECRET_KEY);
}

function getStripe() {
  if (testClient) return testClient;
  if (!process.env.STRIPE_SECRET_KEY) fail("Card payments are currently unavailable", 503);
  client ||= new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, appInfo: { name: "ViswaKart" } });
  return client;
}

/** Lets tests replace the Stripe API with a fake. */
function setStripeClientForTests(fake) {
  testClient = fake;
}

/** Startup check: reports misconfiguration loudly instead of failing at the first payment. */
function checkConfig(log = console) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) {
    log.warn("[STRIPE] STRIPE_SECRET_KEY is not set: card payments are disabled; cash on delivery still works.");
    return { enabled: false };
  }
  if (!/^(sk|rk)_(test|live)_/.test(key)) throw new Error("STRIPE_SECRET_KEY must be a Stripe secret (sk_) or restricted (rk_) key");
  const live = /_live_/.test(key);
  if (live && process.env.NODE_ENV !== "production") throw new Error("Refusing to use a live Stripe key outside production. Use a test key (sk_test_...) in development.");
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    log.warn("[STRIPE] STRIPE_WEBHOOK_SECRET is not set: orders are confirmed only when the customer returns from payment. Configure the webhook before going live.");
  } else if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET must be a webhook signing secret (whsec_...)");
  }
  log.log(`[STRIPE] Card payments enabled in ${live ? "LIVE" : "test"} mode.`);
  return { enabled: true, live };
}

const REUSABLE = ["requires_payment_method", "requires_confirmation", "requires_action"];

/**
 * Prices the cart from the database and returns a PaymentIntent for exactly that amount.
 * Retrying the same checkout (same request ID and cart) reuses the same PaymentIntent.
 */
async function createIntent(user, body) {
  const shippingAddress = validateAddress(body.shippingAddress);
  const requestId = normalizeRequestId(body.requestId);
  if (!requestId) fail("A checkout request ID is required");
  const quote = await quoteOrder(body);
  const amount = toMinor(quote.breakdown.totalPrice);
  if (amount < MIN_AMOUNT) fail("Card payments need an order total of at least ₹0.50");
  const cartHash = cartFingerprint(quote.items, quote.shippingMethod);
  const stripe = getStripe();

  const previous = await PaymentAttempt.find({ user: user.id, requestId }).sort("-createdAt");
  const settled = previous.find((attempt) => ["paid", "processing"].includes(attempt.status));
  if (settled) fail("This checkout has already been paid. Check My Orders for its status.", 409);

  // A changed cart, delivery speed or price gets a fresh PaymentIntent; stale ones are cancelled.
  for (const attempt of previous.filter((entry) => entry.status === "created" && (entry.cartHash !== cartHash || entry.amount !== amount))) {
    try {
      await stripe.paymentIntents.cancel(attempt.paymentIntentId);
      attempt.status = "canceled";
      await attempt.save();
    } catch (error) {
      console.warn("[STRIPE] Could not cancel stale PaymentIntent", attempt.paymentIntentId, error.message);
    }
  }

  // Same checkout and same amount: Stripe's idempotency key returns the original PaymentIntent.
  const intent = await stripe.paymentIntents.create(
    {
      amount, currency: CURRENCY, automatic_payment_methods: { enabled: true },
      description: `ViswaKart order (${quote.items.length} item${quote.items.length === 1 ? "" : "s"})`,
      receipt_email: user.email || undefined,
      metadata: { userId: String(user.id), requestId, cartHash },
    },
    { idempotencyKey: `checkout-${user.id}-${requestId}-${cartHash.slice(0, 24)}-${amount}` }
  );
  if (!REUSABLE.includes(intent.status)) fail("This payment can no longer be changed. Refresh checkout to start again.", 409);

  const attempt = await PaymentAttempt.findOneAndUpdate(
    { paymentIntentId: intent.id },
    {
      $setOnInsert: { user: user.id, requestId, paymentIntentId: intent.id, amount, currency: CURRENCY, cartHash, status: "created" },
      // The address may still change until the customer pays.
      $set: { items: quote.items.map(({ product, quantity }) => ({ product, quantity })), shippingAddress, shippingMethod: quote.shippingMethod },
    },
    { upsert: true, new: true, runValidators: true }
  );
  if (String(attempt.user) !== String(user.id)) fail("Payment belongs to another account", 403);
  return { clientSecret: intent.client_secret, paymentIntentId: intent.id, breakdown: quote.breakdown, items: quote.items };
}

async function refundUnfulfillable(stripe, attempt, reason) {
  await stripe.refunds.create(
    { payment_intent: attempt.paymentIntentId, metadata: { reason: reason.slice(0, 450) } },
    { idempotencyKey: `refund-unfulfillable-${attempt.paymentIntentId}` }
  );
  attempt.status = "refunded";
  attempt.lastError = reason;
  await attempt.save();
}

/**
 * Turns a PaymentIntent into an order, using Stripe as the source of truth for its outcome.
 * Safe to call any number of times, from the browser confirmation or the webhook: at most one order is created.
 * Returns `{ state, order?, message? }` where state is paid | processing | failed | canceled | requires_action | refunded.
 */
async function finalizePayment(paymentIntentId, { userId } = {}) {
  if (typeof paymentIntentId !== "string" || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) fail("Invalid payment reference");
  const attempt = await PaymentAttempt.findOne({ paymentIntentId });
  if (!attempt) fail("Payment not found", 404);
  if (userId && String(attempt.user) !== String(userId)) fail("Payment not found", 404);
  if (attempt.order) return { state: "paid", order: await Order.findById(attempt.order), created: false };
  if (attempt.status === "refunded") return { state: "refunded", message: attempt.lastError || "This payment was refunded." };

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.metadata?.userId !== String(attempt.user)) fail("Payment does not match this account", 409);

  switch (intent.status) {
    case "succeeded": {
      if (intent.currency !== attempt.currency || intent.amount_received !== attempt.amount) {
        attempt.status = "review_required";
        attempt.lastError = `Received ${intent.amount_received} ${intent.currency}, expected ${attempt.amount} ${attempt.currency}`;
        await attempt.save();
        console.error("[STRIPE] Amount mismatch", paymentIntentId, attempt.lastError);
        fail("We received your payment but couldn't match it to your order. Our team has been alerted and will contact you.", 409);
      }
      let result;
      try {
        result = await createOrder(
          attempt.user,
          { items: attempt.items.map(({ product, quantity }) => ({ product: String(product), quantity })), shippingAddress: attempt.shippingAddress.toObject(), shippingMethod: attempt.shippingMethod },
          {
            id: paymentIntentId,
            validate(quote) {
              if (cartFingerprint(quote.items, quote.shippingMethod) !== attempt.cartHash || toMinor(quote.breakdown.totalPrice) !== attempt.amount) {
                fail("Prices or availability changed while you were paying.", 409);
              }
            },
          }
        );
      } catch (error) {
        // The webhook and the browser confirmation raced: the other one created the order.
        if (error.code === 11000) {
          const existing = await Order.findOne({ "paymentResult.id": paymentIntentId });
          if (existing) {
            await PaymentAttempt.updateOne({ _id: attempt._id }, { $set: { status: "paid", order: existing._id } });
            return { state: "paid", order: existing, created: false };
          }
        }
        // Business failures (sold out, price changed) can never succeed on retry, so the customer is refunded.
        // Infrastructure failures are rethrown so Stripe redelivers the webhook later.
        if (error.statusCode && error.statusCode < 500 && error.statusCode !== 403) {
          await refundUnfulfillable(stripe, attempt, error.message);
          return { state: "refunded", message: `${error.message} Your payment has been refunded in full; it can take 5–10 business days to appear.` };
        }
        throw error;
      }
      attempt.status = "paid";
      attempt.order = result.order._id;
      attempt.lastError = "";
      await attempt.save();
      if (result.created) {
        const buyer = await User.findById(attempt.user).lean();
        void notifyOrder(result.order, buyer).catch(() => {});
      }
      return { state: "paid", order: result.order, created: result.created };
    }
    case "processing":
      if (attempt.status !== "processing") await PaymentAttempt.updateOne({ _id: attempt._id }, { $set: { status: "processing" } });
      return { state: "processing", message: "Your payment is processing. We'll confirm your order as soon as your bank does." };
    case "requires_payment_method": {
      const message = intent.last_payment_error?.message || "";
      await PaymentAttempt.updateOne({ _id: attempt._id }, { $set: { status: message ? "failed" : "created", lastError: message } });
      return { state: "failed", message: message || "The payment wasn't completed. You have not been charged." };
    }
    case "canceled":
      await PaymentAttempt.updateOne({ _id: attempt._id }, { $set: { status: "canceled" } });
      return { state: "canceled", message: "This payment was cancelled. You have not been charged." };
    default:
      return { state: "requires_action", message: "Your payment needs another step to finish." };
  }
}

/**
 * Refunds a paid card order for whatever has been cancelled and not yet refunded.
 * Called after an order or item is cancelled. Never throws: a failed refund is recorded on the order for an admin.
 */
async function refundCancelledItems(orderOrId) {
  const order = orderOrId?._id ? orderOrId : await Order.findById(orderOrId);
  if (!order || order.paymentMethod !== "card" || !order.isPaid || !order.paymentResult?.id) return order;
  const allCancelled = order.items.every((item) => item.itemStatus === "Cancelled");
  const cancelledValue = order.items.filter((item) => item.itemStatus === "Cancelled").reduce((sum, item) => sum + item.price * item.quantity, 0);
  const target = money(Math.min(order.totalPrice, cancelledValue + (allCancelled ? order.shippingPrice : 0)));
  const already = money(order.refundedAmount || 0);
  const due = money(target - already);
  if (due <= 0) return order;
  try {
    const refund = await getStripe().refunds.create(
      { payment_intent: order.paymentResult.id, amount: toMinor(due), metadata: { orderId: String(order._id) } },
      { idempotencyKey: `refund-${order._id}-${toMinor(target)}` }
    );
    // Conditional on the previous refunded amount so two concurrent cancellations can't double-count.
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, refundedAmount: order.refundedAmount || 0 },
      {
        $set: { refundedAmount: target, refundError: "", "paymentResult.status": target >= order.totalPrice ? "refunded" : "partially_refunded", "paymentResult.updateTime": new Date().toISOString() },
        $push: { refunds: { id: refund.id, amount: due } },
      },
      { new: true }
    );
    return updated || Order.findById(order._id);
  } catch (error) {
    console.error("[STRIPE] Refund failed for order", String(order._id), error.message);
    return Order.findByIdAndUpdate(order._id, { $set: { refundError: `Refund of ₹${due} failed: ${error.message}` } }, { new: true });
  }
}

/** Records refunds made outside the app (for example in the Stripe Dashboard). */
async function syncChargeRefund(charge) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;
  const refunded = money((charge.amount_refunded || 0) / 100);
  await Order.updateOne(
    { "paymentResult.id": paymentIntentId, refundedAmount: { $lt: refunded } },
    { $set: { refundedAmount: refunded, "paymentResult.status": charge.refunded ? "refunded" : "partially_refunded" } }
  );
}

module.exports = {
  CURRENCY, isEnabled, getStripe, checkConfig, setStripeClientForTests,
  createIntent, finalizePayment, refundCancelledItems, syncChargeRefund,
};
