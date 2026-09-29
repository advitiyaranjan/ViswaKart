const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  image: { type: String, default: "" },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  inventoryReserved: { type: Boolean, default: false },
  // Seller snapshot for this item
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  sellerName: { type: String, default: "" },
  sellerEmail: { type: String, default: "" },
  sellerMobile: { type: String, default: "" },
  sellerHostelNumber: { type: String, default: "" },
  sellerRoomNumber: { type: String, default: "" },
  itemStatus: {
    type: String,
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
    default: "Pending",
  },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["card", "paypal", "cod"],
      default: "cod",
    },
    shippingMethod: { type: String, enum: ["standard", "express", "overnight"], default: "standard" },
    // Idempotency key sent by checkout so a retried submission never creates a second order
    clientRequestId: { type: String },
    paymentResult: {
      id: String,
      status: String,
      updateTime: String,
      emailAddress: String,
    },
    itemsPrice: { type: Number, required: true },
    shippingPrice: { type: Number, required: true, default: 0 },
    taxPrice: { type: Number, required: true, default: 0 },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    isDelivered: { type: Boolean, default: false },
    deliveredAt: Date,
  },
  { timestamps: true }
);

orderSchema.index({ "paymentResult.id": 1 }, { unique: true, partialFilterExpression: { "paymentResult.id": { $type: "string" } } });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ user: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });
module.exports = mongoose.model("Order", orderSchema);
