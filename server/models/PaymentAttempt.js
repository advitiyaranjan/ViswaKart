const mongoose = require("mongoose");

// Server-side snapshot of a card checkout, keyed by its Stripe PaymentIntent.
// The order is built from this snapshot (never from data the browser sends after paying),
// so the webhook and the browser confirmation produce the same single order.
const paymentAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestId: { type: String, required: true },
    paymentIntentId: { type: String, required: true, unique: true },
    items: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    shippingMethod: { type: String, enum: ["standard", "express", "overnight"], default: "standard" },
    // Amount in the currency's minor unit (paise), exactly as sent to Stripe.
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    cartHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["created", "processing", "paid", "failed", "canceled", "refunded", "review_required"],
      default: "created",
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

paymentAttemptSchema.index({ user: 1, requestId: 1, createdAt: -1 });

module.exports = mongoose.model("PaymentAttempt", paymentAttemptSchema);
