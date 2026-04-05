const express = require("express");
const router = express.Router();
const { sendNewsletterWelcomeEmail } = require("../utils/email");

// POST /api/newsletter/subscribe
router.post("/subscribe", async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "A valid email address is required." });
  }

  await sendNewsletterWelcomeEmail(email.trim().toLowerCase());

  res.json({ success: true, message: "Subscribed successfully! Check your inbox." });
});

module.exports = router;
