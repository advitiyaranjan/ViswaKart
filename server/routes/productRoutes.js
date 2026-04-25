const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { productValidator } = require("../validators/productValidator");

router.get("/", getProducts);
router.get("/:id", getProduct);
router.post("/", protect, productValidator, createProduct);
router.put("/:id", protect, updateProduct);
router.delete("/:id", protect, deleteProduct);
router.post("/:id/reviews", protect, addReview);

module.exports = router;
