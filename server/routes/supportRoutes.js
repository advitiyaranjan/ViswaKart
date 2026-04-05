const express = require("express");
const router = express.Router();
const { createMessage, getAllMessages, replyToMessage, updateStatus } = require("../controllers/supportController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/", protect, createMessage);
router.get("/", protect, authorize("admin"), getAllMessages);
router.post("/:id/reply", protect, authorize("admin"), replyToMessage);
router.put("/:id/status", protect, authorize("admin"), updateStatus);

module.exports = router;
