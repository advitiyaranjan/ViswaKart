const SupportMessage = require("../models/SupportMessage");
const { sendSupportReplyEmail } = require("../utils/email");

// POST /api/support — user submits a message
exports.createMessage = async (req, res) => {
  const { subject, message } = req.body;
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ success: false, message: "Subject and message are required." });
  }

  const name = req.user?.name || "Guest";
  const email = req.user?.email;
  if (!email) {
    return res.status(400).json({ success: false, message: "Could not determine your email." });
  }

  const doc = await SupportMessage.create({
    userId: req.user?.clerkId,
    name,
    email,
    subject: subject.trim(),
    message: message.trim(),
  });

  res.status(201).json({ success: true, message: "Message sent successfully.", id: doc._id });
};

// GET /api/support — admin: get all messages
exports.getAllMessages = async (req, res) => {
  const messages = await SupportMessage.find().sort({ createdAt: -1 });
  res.json({ success: true, messages });
};

// POST /api/support/:id/reply — admin sends reply
exports.replyToMessage = async (req, res) => {
  const { reply } = req.body;
  if (!reply?.trim()) {
    return res.status(400).json({ success: false, message: "Reply message is required." });
  }

  const doc = await SupportMessage.findById(req.params.id);
  if (!doc) return res.status(404).json({ success: false, message: "Message not found." });

  doc.replies.push({ message: reply.trim() });
  doc.status = "replied";
  await doc.save();

  // Send email to user
  await sendSupportReplyEmail(doc.email, doc.name, doc.subject, reply.trim());

  res.json({ success: true, message: "Reply sent." });
};

// PUT /api/support/:id/status — admin updates status
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  const doc = await SupportMessage.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );
  if (!doc) return res.status(404).json({ success: false, message: "Message not found." });
  res.json({ success: true, message: doc });
};
