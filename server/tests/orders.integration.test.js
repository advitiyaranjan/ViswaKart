// Runs the order service and HTTP layer against an in-memory MongoDB replica set (transactions need one).
process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const User = require("../models/User");
const orderService = require("../services/orderService");

const address = { street: "12 Hostel Road", city: "Gwalior", state: "MP", zipCode: "474015", country: "India" };
let replSet;
let server;
let baseUrl;
let buyer;
let seller;
let category;

test.before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri());
  await Promise.all([Order.init(), Product.init(), User.init()]);
  const app = require("../app");
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await mongoose.disconnect();
  await replSet?.stop({ doCleanup: true, force: false });
});

test.beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), Product.deleteMany({}), User.deleteMany({}), Category.deleteMany({})]);
  [buyer, seller] = await User.create([
    { name: "Buyer", email: "buyer@example.com", clerkId: "user_buyer" },
    { name: "Seller", email: "seller@example.com", clerkId: "user_seller", isSeller: true, sellerApproved: true },
  ]);
  category = await Category.create({ name: "Books" });
});

function makeProduct(overrides = {}) {
  return Product.create({
    name: "Algorithms", description: "A textbook", price: 450, originalPrice: 600, discount: 5, stock: 3,
    category: category._id, seller: seller._id, ...overrides,
  });
}

test("createOrder charges database prices and reserves stock", async () => {
  const product = await makeProduct();
  const { order, created } = await orderService.createOrder(buyer._id, {
    items: [{ product: String(product._id), quantity: 2, price: 1 }], shippingAddress: address, shippingMethod: "express",
  });
  assert.equal(created, true);
  assert.equal(order.itemsPrice, 900);
  assert.equal(order.totalPrice, 912.99);
  // The stored discount (5%) was stale; the order snapshot reflects the prices actually charged.
  assert.equal(order.items[0].discount, 25);
  assert.equal((await Product.findById(product._id)).stock, 1);
});

test("createOrder refuses to oversell and leaves stock untouched", async () => {
  const product = await makeProduct({ stock: 1 });
  await assert.rejects(
    orderService.createOrder(buyer._id, { items: [{ product: String(product._id), quantity: 2 }], shippingAddress: address }),
    (error) => error.statusCode === 409 && /Only 1 available/.test(error.message),
  );
  assert.equal((await Product.findById(product._id)).stock, 1);
  assert.equal(await Order.countDocuments(), 0);
});

test("createOrder rejects a stale expected total", async () => {
  const product = await makeProduct();
  await assert.rejects(
    orderService.createOrder(buyer._id, { items: [{ product: String(product._id), quantity: 1 }], shippingAddress: address, expectedTotal: 400 }),
    (error) => error.statusCode === 409,
  );
});

test("a repeated checkout request creates exactly one order", async () => {
  const product = await makeProduct();
  const body = { items: [{ product: String(product._id), quantity: 1 }], shippingAddress: address, requestId: "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e" };
  const results = await Promise.all([orderService.createOrder(buyer._id, body), orderService.createOrder(buyer._id, body)]);
  assert.equal(String(results[0].order._id), String(results[1].order._id));
  assert.deepEqual(results.map((result) => result.created).sort(), [false, true]);
  const again = await orderService.createOrder(buyer._id, body);
  assert.equal(again.created, false);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal((await Product.findById(product._id)).stock, 2);
});

test("cancelling returns reserved stock and only the owner may cancel", async () => {
  const product = await makeProduct();
  const { order } = await orderService.createOrder(buyer._id, { items: [{ product: String(product._id), quantity: 2 }], shippingAddress: address });
  await assert.rejects(orderService.updateStatus(order._id, "Cancelled", { user: seller, ownerOnly: true }), (error) => error.statusCode === 403);
  const cancelled = await orderService.updateStatus(order._id, "Cancelled", { user: buyer, ownerOnly: true });
  assert.equal(cancelled.status, "Cancelled");
  assert.equal((await Product.findById(product._id)).stock, 3);
  // Cancelling twice must not return the stock twice.
  await assert.rejects(orderService.updateStatus(order._id, "Cancelled", { user: buyer, ownerOnly: true }));
  assert.equal((await Product.findById(product._id)).stock, 3);
});

test("customers cannot cancel after shipping", async () => {
  const product = await makeProduct();
  const { order } = await orderService.createOrder(buyer._id, { items: [{ product: String(product._id), quantity: 1 }], shippingAddress: address });
  await orderService.updateStatus(order._id, "Shipped", { user: { role: "admin", _id: new mongoose.Types.ObjectId() } });
  await assert.rejects(orderService.updateStatus(order._id, "Cancelled", { user: buyer, ownerOnly: true }), /already shipped/);
});

test("admins can advance an order after one of its items was cancelled", async () => {
  const [first, second] = await Promise.all([makeProduct(), makeProduct({ name: "Compilers" })]);
  const { order } = await orderService.createOrder(buyer._id, {
    items: [{ product: String(first._id), quantity: 1 }, { product: String(second._id), quantity: 1 }], shippingAddress: address,
  });
  const admin = { role: "admin", _id: new mongoose.Types.ObjectId() };
  await orderService.updateStatus(order._id, "Cancelled", { user: admin, itemId: order.items[0]._id });
  const shipped = await orderService.updateStatus(order._id, "Shipped", { user: admin });
  assert.deepEqual(shipped.items.map((item) => item.itemStatus), ["Cancelled", "Shipped"]);
  const delivered = await orderService.updateStatus(order._id, "Delivered", { user: admin });
  assert.equal(delivered.status, "Delivered");
  assert.equal(delivered.isPaid, true, "cash on delivery is paid once delivered");
});

test("sellers may only update their own items", async () => {
  const product = await makeProduct();
  const { order } = await orderService.createOrder(buyer._id, { items: [{ product: String(product._id), quantity: 1 }], shippingAddress: address });
  const itemId = order.items[0]._id;
  await assert.rejects(orderService.updateStatus(order._id, "Shipped", { user: buyer, itemId }), (error) => error.statusCode === 403);
  const updated = await orderService.updateStatus(order._id, "Shipped", { user: seller, itemId });
  assert.equal(updated.status, "Shipped");
});

test("GET /products lists only active products with a consistent total", async () => {
  await makeProduct();
  await makeProduct({ name: "Hidden", isActive: false });
  const response = await fetch(`${baseUrl}/products?limit=5`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.total, 1);
  assert.deepEqual(body.products.map((product) => product.name), ["Algorithms"]);
});

test("GET /products applies the rating and in-stock filters the storefront offers", async () => {
  await makeProduct({ name: "Rated", ratings: 4.5, numReviews: 2 });
  await makeProduct({ name: "Unrated" });
  await makeProduct({ name: "Empty", stock: 0 });
  await makeProduct({ name: "Sold listing", sold: true });
  const names = async (query) => (await (await fetch(`${baseUrl}/products?${query}`)).json()).products.map((product) => product.name).sort();
  assert.deepEqual(await names("minRating=4"), ["Rated"]);
  assert.deepEqual(await names("inStock=true"), ["Rated", "Unrated"]);
  assert.equal((await fetch(`${baseUrl}/products?minRating=9`)).status, 400);
});

test("GET /products validates filters", async () => {
  assert.equal((await fetch(`${baseUrl}/products?sort=$where`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/products?minPrice=10&maxPrice=5`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/products?limit=500`)).status, 400);
});

test("protected and admin endpoints reject anonymous requests", async () => {
  for (const [method, path] of [["POST", "/orders"], ["POST", "/orders/quote"], ["GET", "/orders"], ["GET", "/users/seller-requests"], ["GET", "/users/dashboard"], ["POST", "/uploads"]]) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined });
    assert.equal(response.status, 401, `${method} ${path}`);
  }
});
