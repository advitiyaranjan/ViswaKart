const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const { verifyToken } = require("@clerk/backend");
const { validationResult } = require("express-validator");

// @desc    Get all products (with pagination, filtering, search)
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  const {
    page = 1,
    limit = 12,
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    featured,
  } = req.query;

  // Build base filters (search, category, price, featured) first
  const baseFilter = {};

  // Search by name
  if (search) {
    baseFilter.name = { $regex: search, $options: "i" };
  }

  // Filter by category slug or id
  if (category) {
    const cat = await Category.findOne({ slug: category });
    if (cat) baseFilter.category = cat._id;
    else baseFilter.category = category; // allow direct ObjectId
  }

  // Price range
  if (minPrice || maxPrice) {
    baseFilter.price = {};
    if (minPrice) baseFilter.price.$gte = Number(minPrice);
    if (maxPrice) baseFilter.price.$lte = Number(maxPrice);
  }

  // Featured filter
  if (featured === "true") baseFilter.isFeatured = true;

  const skip = (Number(page) - 1) * Number(limit);

  // Support filtering by seller id, sellerEmail or sellerMobile.
  // If the requester is the same seller (or an admin), include their inactive items too.
  let finalQuery = {};
  const sellerId = req.query.seller;
  const sellerEmail = req.query.sellerEmail;
  const sellerMobile = req.query.sellerMobile;

  if (sellerId || sellerEmail || sellerMobile) {
    console.log('[GET_PRODUCTS] seller filter used:', { sellerId, sellerEmail, sellerMobile });

    const requesterIsAdmin = req.user && req.user.role === 'admin';
    const requesterIsSellerById = req.user && (req.user.id === sellerId || req.user._id?.toString() === sellerId);
    const requesterIsSellerByEmail = req.user && sellerEmail && ((req.user.email || '').toLowerCase() === String(sellerEmail).toLowerCase());
    const requesterIsSellerByMobile = req.user && sellerMobile && ((req.user.sellerProfile?.mobileNumber || '') === String(sellerMobile));

    if (sellerId) {
      if (requesterIsSellerById || requesterIsAdmin) {
        finalQuery = { ...baseFilter, seller: sellerId };
      } else {
        finalQuery = { ...baseFilter, seller: sellerId, isActive: true };
      }
    } else if (sellerEmail) {
      const normalized = String(sellerEmail).toLowerCase();
      if (requesterIsSellerByEmail || requesterIsAdmin) {
        finalQuery = { ...baseFilter, sellerEmail: normalized };
      } else {
        finalQuery = { ...baseFilter, sellerEmail: normalized, isActive: true };
      }
    } else {
      // sellerMobile
      const normalizedMobile = String(sellerMobile || "").trim();
      if (requesterIsSellerByMobile || requesterIsAdmin) {
        finalQuery = { ...baseFilter, sellerMobile: normalizedMobile };
      } else {
        finalQuery = { ...baseFilter, sellerMobile: normalizedMobile, isActive: true };
      }
    }
  } else {
    // Public listing: only active products
    finalQuery = { ...baseFilter, isActive: true };
  }

  // Default sort: show user-added (seller) products first, then newest
  const sortOrder = sort ? sort : { seller: -1, createdAt: -1 };

  const [products, total] = await Promise.all([
    Product.find(finalQuery)
      .populate("category", "name slug")
      .sort(sortOrder)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(finalQuery),
  ]);

  if (req.query.seller) console.log('[GET_PRODUCTS] returning', products.length, 'products for seller', req.query.seller);

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    products,
  });
};

// @desc    Get single product by ID or slug
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res) => {
  const { id } = req.params;
  const query = id.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: id }
    : { slug: id };

  const product = await Product.findOne({ ...query, isActive: true }).populate(
    "category",
    "name slug"
  );

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  res.status(200).json({ success: true, product });
};

// @desc    Create product
// @route   POST /api/products
// @access  Admin
exports.createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn('[CREATE_PRODUCT] validation failed', { errors: errors.array(), body: req.body, user: req.user?._id });
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  // Permission: Admins or approved sellers
  if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
  if (req.user.role !== "admin") {
    // Allow if user is an approved seller
    let allowed = false;
    if (req.user.isSeller && req.user.sellerApproved) allowed = true;
    // Also allow users from the IIITM domain to list immediately (UI already exposes seller flow for this domain)
    const email = (req.user.email || "").toLowerCase();
    if (!allowed && email.endsWith("@iiitm.ac.in")) {
      allowed = true;
      // Persist seller flag so future requests recognize them
      try {
        await User.findByIdAndUpdate(req.user.id, { isSeller: true, sellerApproved: true, sellerApprovedAt: new Date() });
      } catch (e) {
        console.warn('[CREATE_PRODUCT] failed to update user seller flags', e.message || e);
      }
    }

    if (!allowed) {
      return res.status(403).json({ success: false, message: "Not authorized to create products" });
    }
  }

  const payload = { ...req.body };
  console.log('[CREATE_PRODUCT] incoming', { user: req.user?._id || req.user?.clerkId, payloadSample: { name: payload.name, price: payload.price, category: payload.category, imagesCount: Array.isArray(payload.images) ? payload.images.length : 0 } });
  if (req.user.role !== "admin") payload.seller = req.user.id;

  // Snapshot seller contact details on the product for easy lookup
  try {
    if (req.user) {
      if (!payload.sellerEmail && req.user.email) payload.sellerEmail = String(req.user.email).toLowerCase();
      // Prefer explicit seller fields in the request (payload.sellerMobile or payload.sellerProfile),
      // otherwise fall back to server-side user profile if available. Always normalize/trim.
      const mobileFromPayloadProfile = payload.sellerProfile && payload.sellerProfile.mobileNumber ? String(payload.sellerProfile.mobileNumber).trim() : "";
      const mobileFromUserProfile = req.user && req.user.sellerProfile && req.user.sellerProfile.mobileNumber ? String(req.user.sellerProfile.mobileNumber).trim() : "";
      const rawMobile = (!payload.sellerMobile ? (mobileFromPayloadProfile || mobileFromUserProfile || "") : String(payload.sellerMobile).trim());
      // Keep only digits to avoid accidental formatting issues; preserve full sequence of digits
      payload.sellerMobile = String(rawMobile).replace(/\D/g, "");

      const hostelFromPayload = payload.sellerProfile && payload.sellerProfile.hostelNumber ? String(payload.sellerProfile.hostelNumber).trim() : "";
      const hostelFromUserProfile = req.user && req.user.sellerProfile && req.user.sellerProfile.hostelNumber ? String(req.user.sellerProfile.hostelNumber).trim() : "";
      if (!payload.sellerHostelNumber) payload.sellerHostelNumber = hostelFromPayload || hostelFromUserProfile || "";
      else payload.sellerHostelNumber = String(payload.sellerHostelNumber).trim();

      const roomFromPayload = payload.sellerProfile && payload.sellerProfile.roomNumber ? String(payload.sellerProfile.roomNumber).trim() : "";
      const roomFromUserProfile = req.user && req.user.sellerProfile && req.user.sellerProfile.roomNumber ? String(req.user.sellerProfile.roomNumber).trim() : "";
      if (!payload.sellerRoomNumber) payload.sellerRoomNumber = roomFromPayload || roomFromUserProfile || "";
      else payload.sellerRoomNumber = String(payload.sellerRoomNumber).trim();
    }
  } catch (e) {
    // non-fatal
  }

  try { console.log('[CREATE_PRODUCT] sellerMobile snapshot:', payload.sellerMobile); } catch(e) {}

  // Save seller profile on the user record if provided
  if (payload.sellerProfile && req.user.role !== "admin") {
    try {
      // sanitize any sellerProfile fields before persisting to user record
      try {
        if (payload.sellerProfile.mobileNumber) payload.sellerProfile.mobileNumber = String(payload.sellerProfile.mobileNumber).trim().replace(/\D/g, "");
        if (payload.sellerProfile.hostelNumber) payload.sellerProfile.hostelNumber = String(payload.sellerProfile.hostelNumber).trim();
        if (payload.sellerProfile.roomNumber) payload.sellerProfile.roomNumber = String(payload.sellerProfile.roomNumber).trim();
      } catch (e) {}
      const updated = await User.findByIdAndUpdate(req.user.id, { sellerProfile: payload.sellerProfile }, { new: true });
      try { console.log('[CREATE_PRODUCT] updated user sellerProfile.mobileNumber after save:', updated?.sellerProfile?.mobileNumber); } catch (e) {}
    } catch (err) {
      // non-fatal
    }
  }

  const product = await Product.create(payload);
  console.log('[CREATE_PRODUCT] created product', { id: product._id, seller: product.seller, isActive: product.isActive });
  await product.populate("category", "name slug");
  res.status(201).json({ success: true, product });
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Admin
exports.updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  // Only admin or owning seller can update
  if (req.user.role !== "admin" && product.seller?.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: "Not authorized to update this product" });
  }

  Object.assign(product, req.body);
  // If update payload included sellerProfile, ensure top-level seller contact snapshot fields are kept in sync
  try {
    if (req.body && req.body.sellerProfile) {
      const sp = req.body.sellerProfile;
      if (sp.mobileNumber) product.sellerMobile = String(sp.mobileNumber).trim().replace(/\D/g, "");
      if (sp.hostelNumber) product.sellerHostelNumber = String(sp.hostelNumber).trim();
      if (sp.roomNumber) product.sellerRoomNumber = String(sp.roomNumber).trim();
    }
    if (req.body && req.body.sellerMobile) product.sellerMobile = String(req.body.sellerMobile).trim().replace(/\D/g, "");
    if (req.body && req.body.sellerHostelNumber) product.sellerHostelNumber = String(req.body.sellerHostelNumber).trim();
    if (req.body && req.body.sellerRoomNumber) product.sellerRoomNumber = String(req.body.sellerRoomNumber).trim();
  } catch (e) {
    // non-fatal
  }

  await product.save();
  await product.populate("category", "name slug");
  res.status(200).json({ success: true, product });
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
// @access  Admin
exports.deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  // Log who requested deletion for audit
  console.log('[DELETE_PRODUCT] requested by', req.user?.id || req.user?._id, 'role=', req.user?.role, 'for', req.params.id);

  // Only admin or owning seller can delete
  if (req.user.role !== "admin" && product.seller?.toString() !== req.user.id) {
    console.log('[DELETE_PRODUCT] unauthorized attempt by', req.user?.id || req.user?._id);
    return res.status(403).json({ success: false, message: "Not authorized to delete this product" });
  }

  product.isActive = false;
  await product.save();
  console.log('[DELETE_PRODUCT] completed for', req.params.id, 'by', req.user?.id || req.user?._id);
  res.status(200).json({ success: true, message: "Product deleted" });
};

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private
exports.addReview = async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  // Prevent duplicate review from same user
  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user.id.toString()
  );
  if (alreadyReviewed) {
    return res
      .status(400)
      .json({ success: false, message: "You already reviewed this product" });
  }

  product.reviews.push({
    user: req.user.id,
    name: req.user.name,
    rating: Number(rating),
    comment,
  });

  product.calcAverageRatings();
  await product.save();

  res.status(201).json({ success: true, message: "Review added" });
};
