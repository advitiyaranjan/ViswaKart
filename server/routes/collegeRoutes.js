const express = require("express");
const router = express.Router();
const { getColleges, getCollege, createCollege, updateCollege } = require("../controllers/collegeController");
const { protect, optionalAuth, authorize } = require("../middleware/authMiddleware");

router.get("/", optionalAuth, getColleges);
router.get("/:id", getCollege);
router.post("/", protect, authorize("admin"), createCollege);
router.put("/:id", protect, authorize("admin"), updateCollege);

module.exports = router;
