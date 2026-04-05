/**
 * Seeder — fetches products from dummyjson.com and seeds MongoDB.
 * Run:     node utils/seeder.js
 * Destroy: node utils/seeder.js --destroy
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const https = require("https");
const connectDB = require("../config/db");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");

const fetchJSON = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });

const run = async () => {
  await connectDB();

  if (process.argv[2] === "--destroy") {
    await Promise.all([User.deleteMany(), Category.deleteMany(), Product.deleteMany()]);
    console.log("Data destroyed");
    process.exit(0);
  }

  await Promise.all([Category.deleteMany(), Product.deleteMany()]);

  const existing = await User.findOne({ email: "admin@example.com" });
  if (!existing) {
    await User.create({ name: "Admin User", email: "admin@example.com", password: "admin123", role: "admin" });
    console.log("Admin user created: admin@example.com / admin123");
  }

  const existingUser = await User.findOne({ email: "user@example.com" });
  if (!existingUser) {
    await User.create({ name: "Test User", email: "user@example.com", password: "password123", role: "user" });
    console.log("Test user created: user@example.com / password123");
  }

  console.log("Fetching products from dummyjson.com...");
  const data = await fetchJSON("https://dummyjson.com/products?limit=100");
  const dummyProducts = data.products;

  // Build unique categories
  const uniqueCategories = [...new Set(dummyProducts.map((p) => p.category))];
  const categoryMap = {};
  for (const slug of uniqueCategories) {
    const label = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const cat = await Category.create({ name: label, description: "Products in " + label });
    categoryMap[slug] = cat._id;
    console.log("Category: " + label);
  }

  const toInsert = dummyProducts.map((p) => ({
    name: p.title,
    description: p.description,
    price: p.price,
    originalPrice: p.price + Math.round(p.price * (p.discountPercentage / 100)),
    category: categoryMap[p.category],
    images: p.images && p.images.length > 0 ? p.images : [p.thumbnail],
    stock: p.stock ?? Math.floor(Math.random() * 80) + 20,
    brand: p.brand || "",
    isFeatured: p.rating >= 4.5,
    ratings: p.rating ?? 0,
    numReviews: p.reviews ? p.reviews.length : Math.floor(Math.random() * 300) + 10,
  }));

  for (const p of toInsert) {
    await Product.create(p);
  }
  console.log(toInsert.length + " products seeded successfully!");
  process.exit(0);
};

run().catch((err) => {
  console.error("Seeder error:", err.message);

});
