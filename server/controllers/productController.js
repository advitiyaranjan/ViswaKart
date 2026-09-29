const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const { validationResult } = require("express-validator");
const { pagination, fail, escapeRegex, normalizePricing } = require("../utils/commerce");

exports.getProducts = async (req, res) => {
  const { page, limit, skip } = pagination(req.query, 12);
  const query = {};
  if (req.query.search) query.name = { $regex: escapeRegex(String(req.query.search).slice(0, 200)), $options: "i" };
  if (req.query.category) {
    const category = String(req.query.category);
    const cat = await Category.findOne(/^[a-f\d]{24}$/i.test(category) ? { _id: category, isActive: true } : { slug: category, isActive: true });
    if (!cat) return res.json({ success: true, total: 0, page, pages: 0, products: [] });
    query.category = cat._id;
  }
  for (const [key, operator] of [["minPrice", "$gte"], ["maxPrice", "$lte"]]) {
    if (req.query[key] !== undefined && req.query[key] !== "") {
      const value = Number(req.query[key]);
      if (!Number.isFinite(value) || value < 0) fail("Price filters must be non-negative numbers");
      query.price = { ...query.price, [operator]: value };
    }
  }
  if (query.price?.$gte > query.price?.$lte) fail("Minimum price must not exceed maximum price");
  if (req.query.minRating !== undefined && req.query.minRating !== "") {
    const minRating = Number(req.query.minRating);
    if (!Number.isFinite(minRating) || minRating < 0 || minRating > 5) fail("Minimum rating must be between 0 and 5");
    if (minRating > 0) query.ratings = { $gte: minRating };
  }
  // Same availability rule checkout enforces: in stock and not marked sold.
  if (req.query.inStock === "true") Object.assign(query, { stock: { $gt: 0 }, sold: { $ne: true } });
  if (req.query.featured === "true") query.isFeatured = true;
  let owner = false;
  if (req.query.seller) {
    if (!/^[a-f\d]{24}$/i.test(req.query.seller)) fail("Invalid seller ID");
    query.seller = req.query.seller;
    owner = String(req.user?.id) === req.query.seller;
  } else if (req.query.sellerEmail) {
    query.sellerEmail = String(req.query.sellerEmail).trim().toLowerCase();
    owner = req.user?.email === query.sellerEmail;
  } else if (req.query.sellerMobile) {
    query.sellerMobile = String(req.query.sellerMobile).replace(/\D/g, "");
    // A freely editable phone number is not proof of ownership.
  }
  if (!(req.user?.role === "admin" && req.query.includeInactive === "true") && !owner) query.isActive = true;
  const allowedSorts = ["price", "-price", "name", "-name", "ratings", "-ratings", "createdAt", "-createdAt", "-numReviews"];
  if (req.query.sort && !allowedSorts.includes(req.query.sort)) fail("Invalid product sort");
  const sort = req.query.sort || "-createdAt";
  const [products, total] = await Promise.all([
    Product.find(query).populate("category", "name slug").sort(`${sort} _id`).skip(skip).limit(limit).lean(),
    Product.countDocuments(query),
  ]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), products });
};

exports.getProduct = async (req, res) => {
  const query = /^[a-f\d]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { slug: req.params.id };
  const product = await Product.findOne({ ...query, isActive: true }).populate("category", "name slug");
  if (!product) fail("Product not found", 404);
  res.json({ success: true, product });
};

function productFields(body, user, current = {}) {
  const allowed = ["name", "description", "category", "images", "stock", "specifications", "productAge", "sellerMobile", "sellerHostelNumber", "sellerRoomNumber"];
  if (user.role === "admin") allowed.push("isFeatured", "isActive");
  const payload = Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
  if (payload.stock !== undefined && (!Number.isSafeInteger(Number(payload.stock)) || Number(payload.stock) < 0)) fail("Stock must be a non-negative whole number");
  if (payload.images !== undefined && (!Array.isArray(payload.images) || payload.images.length > 12 || payload.images.some((url) => typeof url !== "string" || !/^(https?:\/\/|\/uploads\/)/.test(url)))) fail("Images must contain valid image URLs");
  Object.assign(payload, normalizePricing(body, current));
  const profile = body.sellerProfile || {};
  for (const [field, source] of [["sellerMobile", "mobileNumber"], ["sellerHostelNumber", "hostelNumber"], ["sellerRoomNumber", "roomNumber"]]) {
    // The editor's own profile only fills gaps on a new listing; editing never copies an admin's details onto a seller's product.
    const value = body[field] ?? profile[source] ?? current[field] ?? (current._id ? undefined : user.sellerProfile?.[source]);
    if (value !== undefined) payload[field] = String(value).trim();
  }
  if (payload.sellerMobile) payload.sellerMobile = payload.sellerMobile.replace(/\D/g, "");
  if (payload.stock !== undefined) payload.sold = Number(payload.stock) === 0;
  return payload;
}

async function checkCategory(id) {
  if (!/^[a-f\d]{24}$/i.test(String(id)) || !await Category.exists({ _id: id, isActive: true })) fail("Select an active category");
}

exports.createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array(), message: errors.array()[0].msg });
  const eligible = req.user.isVerified && req.user.email?.toLowerCase().endsWith("@iiitm.ac.in");
  if (req.user.role !== "admin" && !(req.user.isSeller && req.user.sellerApproved) && !eligible) fail("Seller approval is required to list products", 403);
  const payload = productFields(req.body, req.user);
  await checkCategory(payload.category);
  if (req.user.role !== "admin") {
    payload.seller = req.user.id;
    payload.sellerEmail = req.user.email;
    // This profile belongs to the authenticated seller; caller-supplied ownership is ignored.
    await User.findByIdAndUpdate(req.user.id, { isSeller: true, sellerApproved: true, sellerApprovedAt: req.user.sellerApprovedAt || new Date(), sellerProfile: { ...req.user.sellerProfile?.toObject?.(), name: req.user.name, mobileNumber: payload.sellerMobile, hostelNumber: payload.sellerHostelNumber, roomNumber: payload.sellerRoomNumber } }, { runValidators: true });
  }
  const product = await Product.create(payload);
  await product.populate("category", "name slug");
  res.status(201).json({ success: true, product });
};

exports.updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) fail("Product not found", 404);
  if (req.user.role !== "admin" && String(product.seller) !== String(req.user.id)) fail("Not authorized to update this product", 403);
  const payload = productFields(req.body, req.user, product);
  if (payload.category !== undefined) await checkCategory(payload.category);
  Object.assign(product, payload);
  await product.save();
  await product.populate("category", "name slug");
  res.json({ success: true, product });
};

exports.deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) fail("Product not found", 404);
  if (req.user.role !== "admin" && String(product.seller) !== String(req.user.id)) fail("Not authorized to delete this product", 403);
  product.isActive = false;
  await product.save();
  res.json({ success: true, message: "Product deleted" });
};

exports.addReview = async (req, res) => {
  const rating = Number(req.body.rating);
  const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment || comment.length > 2000) fail("Provide a rating from 1 to 5 and a review of up to 2000 characters");
  // Atomic predicate prevents concurrent submissions from duplicating a user's review.
  const product = await Product.findOneAndUpdate({ _id: req.params.id, isActive: true, "reviews.user": { $ne: req.user._id } }, { $push: { reviews: { user: req.user.id, name: req.user.name, rating, comment } } }, { new: true, runValidators: true });
  if (!product) fail("Product unavailable or already reviewed", 409);
  await Product.updateOne({ _id: product._id }, [{ $set: { numReviews: { $size: "$reviews" }, ratings: { $round: [{ $avg: "$reviews.rating" }, 1] } } }]);
  res.status(201).json({ success: true, message: "Review added" });
};
