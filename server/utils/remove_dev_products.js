/**
 * remove_dev_products.js
 * Deletes development products whose name starts with "Dev Product".
 * Usage: node utils/remove_dev_products.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not set in server/.env");
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    const Product = require("../models/Product");

    const devProducts = await Product.find({ name: { $regex: "^Dev Product", $options: "i" } }).lean();
    if (!devProducts || devProducts.length === 0) {
      console.log("No dev products found.");
      process.exit(0);
    }

    console.log("Found dev products:", devProducts.map((p) => ({ id: p._id.toString(), name: p.name })));
    const ids = devProducts.map((p) => p._id);
    const result = await Product.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${result.deletedCount} dev product(s).`);
    process.exit(0);
  } catch (err) {
    console.error("Error removing dev products:", err.message || err);
    process.exit(1);
  }
};

run();
