const express = require("express");
const { Webhook } = require("svix");
const User = require("../models/User");
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
module.exports = router;
