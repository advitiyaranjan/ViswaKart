const express = require("express");
const router = express.Router();
const {
  getMe, updateProfile,
  addAddress, updateAddress, deleteAddress,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { sendLoginAlertEmail } = require("../utils/email");
const User = require("../models/User");

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

// ── Wishlist ────────────────────────────────────────────────────────────────

// GET /api/auth/wishlist  — returns array of product IDs
router.get("/wishlist", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("wishlist").lean();
  res.json({ success: true, wishlist: (user?.wishlist ?? []).map(String) });
});

// POST /api/auth/wishlist/:productId — add
router.post("/wishlist/:productId", protect, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, {
    $addToSet: { wishlist: req.params.productId },
  });
  res.json({ success: true });
});

// DELETE /api/auth/wishlist/:productId — remove
router.delete("/wishlist/:productId", protect, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, {
    $pull: { wishlist: req.params.productId },
  });
  res.json({ success: true });
});

// PUT /api/auth/wishlist/sync — bulk sync (merge localStorage on login)
router.put("/wishlist/sync", protect, async (req, res) => {
  const { ids } = req.body; // array of product id strings
  if (Array.isArray(ids) && ids.length > 0) {
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { wishlist: { $each: ids } },
    });
  }
  const user = await User.findById(req.user.id).select("wishlist").lean();
  res.json({ success: true, wishlist: (user?.wishlist ?? []).map(String) });
});

module.exports = router;

