const express = require("express");
const router = express.Router();
const {
  getMe, updateProfile,
  addAddress, updateAddress, deleteAddress,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Profile (Clerk-authenticated)
router.get("/me", protect, getMe);
router.put("/me", protect, updateProfile);

// Addresses
router.post("/me/addresses", protect, addAddress);
router.put("/me/addresses/:addrId", protect, updateAddress);
router.delete("/me/addresses/:addrId", protect, deleteAddress);

module.exports = router;

