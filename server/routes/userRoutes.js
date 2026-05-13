const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getDashboardStats,
  requestSellerAccess,
  getSellerRequests,
  approveSellerRequest,
  rejectSellerRequest,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/dashboard", protect, authorize("admin"), getDashboardStats);
router.get("/", protect, authorize("admin"), getUsers);

// Seller request flow
router.post("/seller-request", protect, requestSellerAccess);
// Seller requests contain phone numbers and room details, so they are admin-only in every environment.
router.get("/seller-requests", protect, authorize("admin"), getSellerRequests);
router.put("/:id/seller-approve", protect, authorize("admin"), approveSellerRequest);
router.put("/:id/seller-reject", protect, authorize("admin"), rejectSellerRequest);

// Other user operations (keep after seller-specific routes to avoid :id conflicts)
router.get("/:id", protect, authorize("admin"), getUser);
router.put("/:id", protect, authorize("admin"), updateUser);
router.delete("/:id", protect, authorize("admin"), deleteUser);

module.exports = router;
