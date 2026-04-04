const express = require("express");
const { Webhook } = require("svix");
const User = require("../models/User");
const crypto = require("crypto");

const router = express.Router();

// POST /api/webhooks/clerk  — raw body required (mounted before express.json)
router.post("/clerk", express.raw({ type: "application/json" }), async (req, res) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: "CLERK_WEBHOOK_SECRET not set" });
  }

  const svixId = req.headers["svix-id"];
  const svixTimestamp = req.headers["svix-timestamp"];
  const svixSignature = req.headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: "Missing svix headers" });
  }

  let event;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(req.body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    return res.status(400).json({ error: "Webhook verification failed" });
  }

  const { type, data } = event;

  if (type === "user.created" || type === "user.updated") {
    const clerkId = data.id;
    const email = data.email_addresses?.[0]?.email_address ?? "";
    const name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || email;
    const avatar = data.image_url ?? "";

    await User.findOneAndUpdate(
      { clerkId },
      {
        $setOnInsert: {
          clerkId,
          email,
          name,
          avatar,
          password: crypto.randomBytes(32).toString("hex"),
        },
        // Always keep name/email/avatar in sync on update
        $set: { name, email, avatar },
      },
      { upsert: true, new: true }
    );
  }

  if (type === "user.deleted") {
    await User.findOneAndUpdate(
      { clerkId: data.id },
      { isActive: false }
    );
  }

  res.status(200).json({ received: true });
});

module.exports = router;
