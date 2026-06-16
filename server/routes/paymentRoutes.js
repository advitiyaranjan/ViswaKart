const express = require("express");
const router = express.Router();
const { getConfig, createPaymentIntent, confirmOrder } = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

router.get("/config", getConfig);
router.post("/create-intent", protect, createPaymentIntent);
router.post("/confirm-order", protect, confirmOrder);

module.exports = router;
