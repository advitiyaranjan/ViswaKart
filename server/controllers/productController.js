const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const { validationResult } = require("express-validator");
const { pagination, fail, escapeRegex, normalizePricing } = require("../utils/commerce");
const { canSell, sellerStatusOf, legacyFlags } = require("../utils/seller");
const College = require("../models/College");
const { isObjectId, requireActiveCollege, sellerCollegeId } = require("../utils/college");
const COLLEGE_FIELDS = "name slug city state";

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
  // College Mode: restrict to one campus. Enforced here, in the query, so every listing/search/category view obeys it.
  if (req.query.college !== undefined && req.query.college !== "") {
    if (!isObjectId(String(req.query.college))) fail("Invalid college");
    if (!await College.exists({ _id: req.query.college, isActive: true })) fail("This college isn't available in College Mode", 404);
    query.college = req.query.college;
  }
  if (!(req.user?.role === "admin" && req.query.includeInactive === "true") && !owner) query.isActive = true;
  const allowedSorts = ["price", "-price", "name", "-name", "ratings", "-ratings", "createdAt", "-createdAt", "-numReviews"];
  if (req.query.sort && !allowedSorts.includes(req.query.sort)) fail("Invalid product sort");
  const sort = req.query.sort || "-createdAt";
  const [products, total] = await Promise.all([
    Product.find(query).populate("category", "name slug").populate("college", COLLEGE_FIELDS).sort(`${sort} _id`).skip(skip).limit(limit).lean(),
    Product.countDocuments(query),
  ]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), products });
};

exports.getProduct = async (req, res) => {
  const query = /^[a-f\d]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { slug: req.params.id };
  const product = await Product.findOne({ ...query, isActive: true }).populate("category", "name slug").populate("college", COLLEGE_FIELDS);
  if (!product) fail("Product not found", 404);
  res.json({ success: true, product });
};

const MAX_STOCK = 100000;

function productFields(body, user, current = {}) {
  const allowed = ["name", "description", "category", "images", "stock", "specifications", "productAge", "sellerMobile", "sellerHostelNumber", "sellerRoomNumber", "isActive"];
  if (user.role === "admin") allowed.push("isFeatured");
  const payload = Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || payload.name.trim().length < 2 || payload.name.trim().length > 200) fail("Product name must be 2–200 characters");
    payload.name = payload.name.trim();
  }
  if (payload.description !== undefined) {
    if (typeof payload.description !== "string" || payload.description.trim().length < 10 || payload.description.length > 5000) fail("Description must be 10–5000 characters");
    payload.description = payload.description.trim();
  }
  if (payload.stock !== undefined) {
    const stock = Number(payload.stock);
    if (!Number.isSafeInteger(stock) || stock < 0 || stock > MAX_STOCK) fail(`Stock must be a whole number between 0 and ${MAX_STOCK}`);
    payload.stock = stock;
  }
  if (payload.isActive !== undefined && typeof payload.isActive !== "boolean") fail("Published state must be true or false");
  if (payload.isFeatured !== undefined && typeof payload.isFeatured !== "boolean") fail("Featured must be true or false");
  if (payload.productAge !== undefined) payload.productAge = String(payload.productAge).trim().slice(0, 100);
  if (payload.specifications !== undefined) {
    const spec = payload.specifications;
    const ok = spec === null || (typeof spec === "string" && spec.length <= 5000) || (typeof spec === "object" && !Array.isArray(spec) && JSON.stringify(spec).length <= 5000);
    if (!ok) fail("Specifications must be text or key/value details under 5000 characters");
    if (typeof spec === "string") payload.specifications = spec.trim();
  }
  if (payload.images !== undefined && (!Array.isArray(payload.images) || payload.images.length > 12 || payload.images.some((url) => typeof url !== "string" || url.length > 2048 || !/^(https?:\/\/|\/uploads\/)/.test(url)))) fail("Images must be up to 12 valid image URLs");
  if (body.price !== undefined || body.originalPrice !== undefined || !current._id) {
    Object.assign(payload, normalizePricing(body, current));
    if (!(payload.price > 0)) fail("Price must be greater than zero");
  }
  const profile = body.sellerProfile || {};
  for (const [field, source] of [["sellerMobile", "mobileNumber"], ["sellerHostelNumber", "hostelNumber"], ["sellerRoomNumber", "roomNumber"]]) {
    // The editor's own profile only fills gaps on a new listing; editing never copies an admin's details onto a seller's product.
    const value = body[field] ?? profile[source] ?? (current._id ? undefined : user.sellerProfile?.[source]);
    if (value !== undefined) payload[field] = String(value).trim().slice(0, 50);
  }
  if (payload.sellerMobile) {
    payload.sellerMobile = payload.sellerMobile.replace(/\D/g, "");
    if (!/^[0-9]{7,15}$/.test(payload.sellerMobile)) fail("Seller mobile number must contain 7–15 digits");
  }
  if (payload.stock !== undefined) payload.sold = payload.stock === 0;
  return payload;
}

async function checkCategory(id) {
  if (!/^[a-f\d]{24}$/i.test(String(id)) || !await Category.exists({ _id: id, isActive: true })) fail("Select an active category");
}

const SELLER_DENIED = {
  pending: "Your seller application is still under review. You can list products once it is approved.",
  rejected: "Your seller application was not approved. You can update and resubmit it from the Sell page.",
  suspended: "Your seller account is suspended, so listings cannot be created or changed.",
  none: "Seller approval is required to list products.",
};

exports.createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array(), message: errors.array()[0].msg });
  if (!canSell(req.user)) fail(SELLER_DENIED[sellerStatusOf(req.user)] || SELLER_DENIED.none, 403);
  const payload = productFields(req.body, req.user);
  await checkCategory(payload.category);
  if (req.user.role === "admin") {
    // Admin catalogue items may optionally belong to a college; otherwise they are global-only.
    if (req.body.college) payload.college = (await requireActiveCollege(String(req.body.college)))._id;
  } else {
    // The college comes from the seller's trusted affiliation, never from the request body.
    const collegeId = await sellerCollegeId(req.user);
    if (!collegeId) fail("Add your college to your seller profile before listing products.", 409);
    payload.college = (await requireActiveCollege(String(collegeId), "Your college is no longer available. Contact support to update your seller profile."))._id;
  }
  if (req.user.role !== "admin") {
    // Ownership always comes from the authenticated seller; caller-supplied seller fields are ignored.
    payload.seller = req.user.id;
    payload.sellerEmail = req.user.email;
    const update = {
      sellerProfile: {
        ...req.user.sellerProfile?.toObject?.(), name: req.user.sellerProfile?.name || req.user.name,
        mobileNumber: payload.sellerMobile, hostelNumber: payload.sellerHostelNumber, roomNumber: payload.sellerRoomNumber,
        // Records a campus account's email-derived college so later listings stay with the same campus.
        college: payload.college,
      },
    };
    // Campus accounts become recorded sellers on their first listing so admins can see and moderate them.
    if (sellerStatusOf(req.user) !== "approved") Object.assign(update, legacyFlags("approved"), { sellerApprovedAt: new Date() });
    await User.findByIdAndUpdate(req.user.id, { $set: update }, { runValidators: true });
  }
  const product = await Product.create(payload);
  await product.populate([{ path: "category", select: "name slug" }, { path: "college", select: COLLEGE_FIELDS }]);
  res.status(201).json({ success: true, product });
};

exports.updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) fail("Product not found", 404);
  const isAdmin = req.user.role === "admin";
  if (!isAdmin && String(product.seller) !== String(req.user.id)) fail("Not authorized to update this product", 403);
  // A seller who lost selling rights may still take a listing down, but nothing else.
  const onlyUnpublishing = Object.keys(req.body).length === 1 && req.body.isActive === false;
  if (!isAdmin && !canSell(req.user) && !onlyUnpublishing) fail(SELLER_DENIED[sellerStatusOf(req.user)] || SELLER_DENIED.none, 403);
  const payload = productFields(req.body, req.user, product);
  // Republishing re-checks the category, which may have been retired while the listing was hidden.
  if (payload.category !== undefined || (payload.isActive === true && !product.isActive)) await checkCategory(payload.category ?? product.category);
  // Sellers can never move a listing to another campus; admins may correct it.
  if (isAdmin && req.body.college !== undefined) payload.college = req.body.college ? (await requireActiveCollege(String(req.body.college)))._id : null;
  Object.assign(product, payload);
  await product.save();
  await product.populate([{ path: "category", select: "name slug" }, { path: "college", select: COLLEGE_FIELDS }]);
  res.json({ success: true, product });
};

exports.deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) fail("Product not found", 404);
  if (req.user.role !== "admin" && String(product.seller) !== String(req.user.id)) fail("Not authorized to delete this product", 403);
  // Soft delete: orders keep pointing at the product and its history.
  product.isActive = false;
  await product.save();
  res.json({ success: true, message: "Product removed from the store" });
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
