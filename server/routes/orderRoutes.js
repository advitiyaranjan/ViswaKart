const express = require("express");
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  updateOrderItemStatus,
  getSellerOrders,
  cancelOrder,
} = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/", protect, createOrder);
router.get("/my", protect, getMyOrders);
router.get("/seller/my", protect, getSellerOrders);
router.get("/", protect, authorize("admin"), getAllOrders);
router.get("/:id", protect, getOrder);
router.put("/:id/status", protect, authorize("admin"), updateOrderStatus);
router.put("/:orderId/items/:itemId/status", protect, updateOrderItemStatus);
router.put("/:id/cancel", protect, cancelOrder);

module.exports = router;
