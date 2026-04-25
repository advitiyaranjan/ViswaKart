require("dotenv").config();
require("express-async-errors"); // Handles async errors without try/catch

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const errorHandler = require("./middleware/errorMiddleware");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userRoutes = require("./routes/userRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const supportRoutes = require("./routes/supportRoutes");

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());

// Rate limiting — adjustable for development vs production
const isDev = process.env.NODE_ENV === "development";
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 100,
  // enable standard RateLimit headers and disable legacy headers
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});
// CORS — only allow the configured client origin
app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(",").map((o) => o.trim())
      : ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

// Apply rate limiter only in production by default. For local development we allow a much higher limit
if (isDev) {
  console.log("[RATE_LIMIT] Development mode: rate limiter set to a high threshold");
  app.use("/api", limiter);
} else {
  app.use("/api", limiter);
}

// ─── Webhook Routes (must come before express.json to access raw body) ────────
app.use("/api/webhooks", webhookRoutes);

// ─── General Middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize()); // Prevent MongoDB injection via user input

// Prevent caching for API responses (avoid 304 Not Modified for dynamic endpoints)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Serve uploaded files (local fallback)
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/orders", orderRoutes);

// Log incoming user-related API requests for debugging missing routes
app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith("/api/users")) {
    console.log("[REQ_LOG]", req.method, req.originalUrl, "Auth:", !!req.headers.authorization);
  }
  next();
});

app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/support", supportRoutes);

// Health check
// Dev-only debug endpoint to list seller requests (no auth)
if (process.env.NODE_ENV === "development") {
  const User = require("./models/User");
  app.get("/api/debug/seller-requests", async (req, res) => {
    const users = await User.find({ sellerRequested: true }).select(
      "name email sellerProfile sellerRequestMessage sellerRequestedAt"
    );
    res.status(200).json({ success: true, users });
  });

  // Dev-only: list recent products (optionally filter by seller)
  const Product = require("./models/Product");
  app.get("/api/debug/products", async (req, res) => {
    try {
      const { seller, sellerEmail, sellerMobile } = req.query;
      const q = {};
      if (seller) q.seller = seller;
      else if (sellerEmail) q.sellerEmail = String(sellerEmail).toLowerCase();
      else if (sellerMobile) q.sellerMobile = String(sellerMobile).trim();
      const products = await Product.find(q).sort({ createdAt: -1 }).limit(100).lean();
      return res.status(200).json({ success: true, products });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Dev-only: create a product quickly for local testing
  app.post("/api/debug/create-product", async (req, res) => {
    try {
      const { name, price, category, seller, images, description, stock } = req.body || {};
      // pick a category if not provided
      let catId = category;
      const Category = require("./models/Category");
      if (!catId) {
        const first = await Category.findOne();
        if (!first) return res.status(400).json({ success: false, message: "No categories available. Create a category first." });
        catId = first._id;
      }

      const payload = {
        name: name || `Dev Product ${Date.now()}`,
        description: description || "Dev-created product",
        price: price !== undefined ? Number(price) : 99,
        originalPrice: price !== undefined ? Number(price) : 99,
        category: catId,
        images: Array.isArray(images) && images.length ? images : ["/placeholder.png"],
        stock: stock !== undefined ? Number(stock) : 1,
        seller: seller || null,
        sellerEmail: req.body.sellerEmail ? String(req.body.sellerEmail).toLowerCase() : undefined,
        sellerMobile: req.body.sellerMobile ? String(req.body.sellerMobile).trim().replace(/\D/g, "") : undefined,
        sellerHostelNumber: req.body.sellerHostelNumber ? String(req.body.sellerHostelNumber).trim() : undefined,
        sellerRoomNumber: req.body.sellerRoomNumber ? String(req.body.sellerRoomNumber).trim() : undefined,
      };

      const product = await Product.create(payload);
      await product.populate("category", "name slug");
      return res.status(201).json({ success: true, product });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Dev-only: toggle product active state
  app.post("/api/debug/product/:id/active", async (req, res) => {
    try {
      const { id } = req.params;
      const { active } = req.body;
      const prod = await Product.findByIdAndUpdate(id, { isActive: !!active }, { new: true }).lean();
      if (!prod) return res.status(404).json({ success: false, message: "Product not found" });
      return res.status(200).json({ success: true, product: prod });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Dev-only: fetch a single order by id (no auth) for local debugging
  const Order = require("./models/Order");
  app.get("/api/debug/order/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.findById(id).lean();
      if (!order) return res.status(404).json({ success: false, message: "Order not found" });
      return res.status(200).json({ success: true, order });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });
}

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

// Handle unknown routes
app.use((req, res) => {
  // Log unknown route for debugging
  console.warn("[404]", req.method, req.originalUrl, "Auth:", !!req.headers.authorization);
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Error Handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
