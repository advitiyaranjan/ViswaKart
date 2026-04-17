const express = require("express");
const router = express.Router();
const {
  getMe, updateProfile,
  addAddress, updateAddress, deleteAddress,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { sendLoginAlertEmail } = require("../utils/email");

// Profile (Clerk-authenticated)
router.get("/me", protect, getMe);
router.put("/me", protect, updateProfile);

// Addresses
router.post("/me/addresses", protect, addAddress);
router.put("/me/addresses/:addrId", protect, updateAddress);
router.delete("/me/addresses/:addrId", protect, deleteAddress);

// Login alert email (called client-side after Clerk sign-in)
router.post("/login-alert", protect, async (req, res) => {
  const { email, name } = req.body;
  if (email) sendLoginAlertEmail(email, name || "there").catch(() => {});
  res.json({ success: true });
});

module.exports = router;

