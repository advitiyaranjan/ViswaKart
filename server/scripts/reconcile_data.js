/**
 * Finds records written under older pricing/status rules and brings them in line with the current ones.
 *
 *   node scripts/reconcile_data.js           # dry run: report only
 *   node scripts/reconcile_data.js --apply   # write the fixes
 *
 * Products: `price` is the selling price. `originalPrice` must be >= price and `discount` is derived from both.
 * Orders:   the order-level status is derived from its item statuses.
 * Order totals are financial records and are only reported, never rewritten.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { normalizePricing, summarizeStatus, money } = require("../utils/commerce");

const apply = process.argv.includes("--apply");

async function reconcileProducts() {
  const fixes = [];
  const cursor = Product.find({}, { name: 1, price: 1, originalPrice: 1, discount: 1, stock: 1 }).lean().cursor();
  for await (const product of cursor) {
    const update = {};
    if (Number.isFinite(product.price) && product.price >= 0) {
      const pricing = normalizePricing({ price: product.price, originalPrice: product.originalPrice ?? product.price });
      if (product.originalPrice !== pricing.originalPrice) update.originalPrice = pricing.originalPrice;
      if (product.discount !== pricing.discount) update.discount = pricing.discount;
    } else {
      console.warn(`  ! ${product._id} "${product.name}" has an invalid price (${product.price}); fix it manually`);
    }
    if (!Number.isSafeInteger(product.stock) || product.stock < 0) update.stock = Math.max(0, Math.floor(Number(product.stock) || 0));
    if (Object.keys(update).length) fixes.push({ updateOne: { filter: { _id: product._id }, update: { $set: update } }, name: product.name, update });
  }
  for (const fix of fixes) console.log(`  product ${fix.updateOne.filter._id} "${fix.name}":`, fix.update);
  if (apply && fixes.length) await Product.bulkWrite(fixes.map(({ updateOne }) => ({ updateOne })));
  return fixes.length;
}

async function reconcileOrders() {
  const fixes = [];
  let totalMismatches = 0;
  const cursor = Order.find({}, { items: 1, status: 1, isDelivered: 1, itemsPrice: 1, shippingPrice: 1, taxPrice: 1, totalPrice: 1 }).lean().cursor();
  for await (const order of cursor) {
    const items = order.items || [];
    if (!items.length) continue;
    const status = summarizeStatus(items);
    const isDelivered = status === "Delivered";
    if (order.status !== status || Boolean(order.isDelivered) !== isDelivered) {
      fixes.push({ updateOne: { filter: { _id: order._id }, update: { $set: { status, isDelivered } } }, from: order.status });
    }
    const itemsPrice = money(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const expectedTotal = money(itemsPrice + (order.shippingPrice || 0) + (order.taxPrice || 0));
    if (money(order.itemsPrice) !== itemsPrice || money(order.totalPrice) !== expectedTotal) {
      totalMismatches += 1;
      console.warn(`  ! order ${order._id} totals differ from its items (stored ${order.totalPrice}, items imply ${expectedTotal}); review manually`);
    }
  }
  for (const fix of fixes) console.log(`  order ${fix.updateOne.filter._id}: status ${fix.from} -> ${fix.updateOne.update.$set.status}`);
  if (apply && fixes.length) await Order.bulkWrite(fixes.map(({ updateOne }) => ({ updateOne })));
  return { statusFixes: fixes.length, totalMismatches };
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(apply ? "Applying fixes…" : "Dry run (pass --apply to write changes)…");
  console.log("Products:");
  const productFixes = await reconcileProducts();
  console.log("Orders:");
  const { statusFixes, totalMismatches } = await reconcileOrders();
  console.log(`\n${productFixes} product(s) and ${statusFixes} order status(es) ${apply ? "updated" : "need updating"}; ${totalMismatches} order total(s) need manual review.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
