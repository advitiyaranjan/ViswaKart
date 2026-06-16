const mongoose = require("mongoose");

// Stripe delivers webhooks at least once; remembering handled event IDs makes redeliveries a no-op.
const webhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  // Kept for 30 days, comfortably longer than Stripe's 3-day retry window.
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
