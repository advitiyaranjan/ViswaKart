const Category = require("../models/Category");
const Product = require("../models/Product");
const { validationResult } = require("express-validator");
const { fail } = require("../utils/commerce");

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort("name");

  // Attach product count using aggregation
  const counts = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.filter((c) => c._id).map((c) => [c._id.toString(), c.count]));

  const result = categories.map((cat) => ({
    ...cat.toObject(),
    productCount: countMap[cat._id.toString()] || 0,
  }));

  res.status(200).json({ success: true, categories: result });
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
exports.getCategory = async (req, res) => {
  const { id } = req.params;
  const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id };
  const category = await Category.findOne({ ...query, isActive: true });

  if (!category) {
    return res.status(404).json({ success: false, message: "Category not found" });
  }

  res.status(200).json({ success: true, category });
};

// @desc    Create category
// @route   POST /api/categories
// @access  Admin
exports.createCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const exists = await Category.findOne({ name: req.body.name });
  if (exists) {
    return res.status(400).json({ success: false, message: "Category already exists" });
  }

  const { name, description, image } = req.body;
  const category = await Category.create({ name, description, image });
  res.status(201).json({ success: true, category });
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Admin
exports.updateCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return res.status(404).json({ success: false, message: "Category not found" });
  }

  for (const key of ["name", "description", "image"]) {
    if (req.body[key] !== undefined) category[key] = req.body[key];
  }
  await category.save();
  res.status(200).json({ success: true, category });
};

// @desc    Delete category (soft delete)
// @route   DELETE /api/categories/:id
// @access  Admin
exports.deleteCategory = async (req, res) => {
  if (await Product.exists({ category: req.params.id, isActive: true })) fail("Move or archive this category's active products before deleting it", 409);
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!category) {
    return res.status(404).json({ success: false, message: "Category not found" });
  }

  res.status(200).json({ success: true, message: "Category deleted" });
};
