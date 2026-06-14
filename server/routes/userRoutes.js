const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getDashboardStats,
  getMySellerStatus,
  setMySellerCollege,
  adminSetSellerCollege,
  requestSellerAccess,
  getSellerRequests,
  approveSellerRequest,
  rejectSellerRequest,
  suspendSeller,
  reinstateSeller,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/dashboard", protect, authorize("admin"), getDashboardStats);
router.get("/", protect, authorize("admin"), getUsers);

// Seller lifecycle: the signed-in user's own status and application
router.get("/me/seller", protect, getMySellerStatus);
router.put("/me/seller-college", protect, setMySellerCollege);
router.post("/seller-request", protect, requestSellerAccess);
// Seller requests contain phone numbers and room details, so they are admin-only in every environment.
router.get("/seller-requests", protect, authorize("admin"), getSellerRequests);
router.put("/:id/seller-approve", protect, authorize("admin"), approveSellerRequest);
router.put("/:id/seller-reject", protect, authorize("admin"), rejectSellerRequest);
router.put("/:id/seller-suspend", protect, authorize("admin"), suspendSeller);
router.put("/:id/seller-reinstate", protect, authorize("admin"), reinstateSeller);
router.put("/:id/seller-college", protect, authorize("admin"), adminSetSellerCollege);

// Other user operations (keep after seller-specific routes to avoid :id conflicts)
router.get("/:id", protect, authorize("admin"), getUser);
router.put("/:id", protect, authorize("admin"), updateUser);
router.delete("/:id", protect, authorize("admin"), deleteUser);

module.exports = router;
