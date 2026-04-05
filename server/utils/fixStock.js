const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Product = require('../models/Product');
  const all = await Product.find({}).select('_id stock').lean();
  const total = all.length;
  const outOfStockCount = Math.floor(total * 0.05);

  const shuffled = all.sort(() => Math.random() - 0.5);
  const outOfStockIds = shuffled.slice(0, outOfStockCount).map(p => p._id);
  const inStockIds = shuffled.slice(outOfStockCount).map(p => p._id);

  await Product.updateMany({ _id: { $in: outOfStockIds } }, { stock: 0 });

  // Ensure all in-stock products have at least 15 units
  for (const id of inStockIds) {
    const p = await Product.findById(id).select('stock');
    if (p.stock < 10) {
      await Product.updateOne({ _id: id }, { stock: Math.floor(Math.random() * 50) + 15 });
    }
  }

  const inStock = await Product.countDocuments({ stock: { $gt: 0 } });
  const outStock = await Product.countDocuments({ stock: 0 });
  console.log(`In stock: ${inStock} | Out of stock: ${outStock} | Total: ${total}`);
  mongoose.disconnect();
});
