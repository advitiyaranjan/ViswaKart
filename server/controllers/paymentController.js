const paymentService = require("../services/paymentService");

const STATUS_BY_STATE = { paid: 200, processing: 202, requires_action: 202, failed: 402, canceled: 402, refunded: 409 };

// GET /api/payments/config — tells checkout whether card payments can be offered. Never exposes keys.
exports.getConfig = async (req, res) => {
  res.json({ success: true, cardEnabled: paymentService.isEnabled(), currency: paymentService.CURRENCY });
};

// POST /api/payments/create-intent — prices the cart on the server and returns a PaymentIntent client secret.
exports.createPaymentIntent = async (req, res) => {
  const result = await paymentService.createIntent(req.user, req.body);
  res.json({ success: true, ...result });
};

// POST /api/payments/confirm-order — the browser reports it finished paying; Stripe is asked for the real outcome.
exports.confirmOrder = async (req, res) => {
  const result = await paymentService.finalizePayment(req.body.paymentIntentId, { userId: req.user.id });
  const status = result.state === "paid" && result.created ? 201 : STATUS_BY_STATE[result.state] || 200;
  res.status(status).json({ success: result.state === "paid", state: result.state, order: result.order, message: result.message });
};
