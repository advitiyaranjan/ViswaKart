const express = require("express");
const Stripe = require("stripe");
const { Webhook } = require("svix");
const User = require("../models/User");
const WebhookEvent = require("../models/WebhookEvent");
const paymentService = require("../services/paymentService");
const { syncClerkUser } = require("../services/clerkUserService");
const { sendWelcomeEmail } = require("../utils/email");
const router = express.Router();

router.post("/clerk", express.raw({ type: "application/json" }), async (req, res) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "Webhook is not configured" });
  const headers = { "svix-id": req.headers["svix-id"], "svix-timestamp": req.headers["svix-timestamp"], "svix-signature": req.headers["svix-signature"] };
  if (Object.values(headers).some((value) => !value)) return res.status(400).json({ error: "Missing webhook headers" });
  let event;
  try { event = new Webhook(secret).verify(req.body.toString("utf8"), headers); }
  catch { return res.status(400).json({ error: "Webhook verification failed" }); }
  if (["user.created", "user.updated"].includes(event.type)) {
    const { user, created } = await syncClerkUser(event.data);
    if (created && user.email) void sendWelcomeEmail(user.email, user.name).catch(() => {});
  }
  if (event.type === "user.deleted") await User.findOneAndUpdate({ clerkId: event.data.id }, { $set: { isActive: false } });
  res.json({ received: true });
});

const PAYMENT_INTENT_EVENTS = ["payment_intent.succeeded", "payment_intent.processing", "payment_intent.payment_failed", "payment_intent.canceled"];

// Stripe signs the exact bytes it sends, so this route must receive the raw body (it is mounted before express.json).
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "Webhook is not configured" });
  const signature = req.headers["stripe-signature"];
  if (!signature || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: "Missing webhook signature" });
  let event;
  try {
    event = Stripe.webhooks.constructEvent(req.body, signature, secret);
  } catch (error) {
    console.warn("[STRIPE_WEBHOOK] Signature verification failed:", error.message);
    return res.status(400).json({ error: "Webhook verification failed" });
  }
  if (await WebhookEvent.exists({ eventId: event.id })) return res.json({ received: true, duplicate: true });

  try {
    if (PAYMENT_INTENT_EVENTS.includes(event.type)) {
      // The event only says "look again": finalizePayment re-reads the PaymentIntent from Stripe.
      await paymentService.finalizePayment(event.data.object.id).catch((error) => {
        // Payments not created by this checkout (or test events) are acknowledged, not retried.
        if (error.statusCode === 404) return console.warn("[STRIPE_WEBHOOK] No checkout for", event.data.object.id);
        if (error.statusCode && error.statusCode < 500) return console.error("[STRIPE_WEBHOOK]", event.data.object.id, error.message);
        throw error;
      });
    } else if (event.type === "charge.refunded") {
      await paymentService.syncChargeRefund(event.data.object);
    }
  } catch (error) {
    // A 500 makes Stripe redeliver the event with backoff.
    console.error("[STRIPE_WEBHOOK] Handling", event.type, event.id, "failed:", error.stack || error.message);
    return res.status(500).json({ error: "Webhook handling failed" });
  }
  await WebhookEvent.create({ eventId: event.id, type: event.type }).catch((error) => {
    if (error.code !== 11000) throw error;
  });
  res.json({ received: true });
});

module.exports = router;
