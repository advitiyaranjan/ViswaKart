require('dotenv').config();
const connectDB = require('../config/db');
const Product = require('../models/Product');

async function run() {
  try {
    await connectDB();
    console.log('Connected. Normalizing products...');
    const products = await Product.find().lean();
    console.log(`Found ${products.length} products`);
    for (const p of products) {
      const upd = {};
      if (!Array.isArray(p.images)) upd.images = [];

      if ((p.originalPrice === undefined || p.originalPrice === null) && (p.discount || p.discount === 0)) {
        const d = Number(p.discount) || 0;
        if (d > 0 && d < 100 && p.price != null) {
          upd.originalPrice = Number((Number(p.price) / (1 - d / 100)).toFixed(2));
        } else if (p.price != null) {
          upd.originalPrice = p.price;
        }
      } else if ((p.originalPrice === undefined || p.originalPrice === null) && p.price != null) {
        upd.originalPrice = p.price;
      }

      if (Object.keys(upd).length > 0) {
        await Product.updateOne({ _id: p._id }, { $set: upd });
        console.log(`Updated ${p._id}:`, upd);
      }
    }
    console.log('Normalization complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
