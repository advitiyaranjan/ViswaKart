const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});

const supportMessageSchema = new mongoose.Schema(
  {
    userId: { type: String }, // Clerk user ID (optional for guests)
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "replied", "closed"],
      default: "open",
    },
    replies: [replySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportMessage", supportMessageSchema);
