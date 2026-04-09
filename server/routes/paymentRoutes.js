const express = require("express");
const router = express.Router();
const { createPaymentIntent, confirmOrder } = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

router.post("/create-intent", protect, createPaymentIntent);
router.post("/confirm-order", protect, confirmOrder);

module.exports = router;
