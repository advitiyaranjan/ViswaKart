// End-to-end HTTP tests for the seller lifecycle, product permissions and Stripe card checkout.
// Clerk is stubbed so a bearer token is simply the user's clerkId; Stripe is replaced with an in-memory fake.
process.env.NODE_ENV = "test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
// Uploads in tests use the local-disk fallback; never send test files to the real Cloudinary account.
process.env.CLOUDINARY_URL = "";
process.env.SERVER_URL = "http://test.local";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Stripe = require("stripe");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

require.cache[require.resolve("@clerk/backend")] = {
  id: "clerk-stub", filename: "clerk-stub", loaded: true,
  exports: {
    verifyToken: async (token) => ({ sub: token }),
    createClerkClient: () => ({ users: { getUser: async () => { throw Object.assign(new Error("Unknown user"), { statusCode: 401 }); } } }),
  },
};

const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const User = require("../models/User");
const PaymentAttempt = require("../models/PaymentAttempt");
const WebhookEvent = require("../models/WebhookEvent");
const College = require("../models/College");
const paymentService = require("../services/paymentService");

/** Minimal stand-in for the Stripe API surface the checkout uses. */
function fakeStripe() {
  const intents = new Map();
  const byIdempotencyKey = new Map();
  const refunds = [];
  let counter = 0;
  return {
    intents, refunds,
    paymentIntents: {
      async create(params, options = {}) {
        if (options.idempotencyKey && byIdempotencyKey.has(options.idempotencyKey)) return { ...intents.get(byIdempotencyKey.get(options.idempotencyKey)) };
        const id = `pi_test${++counter}`;
        const intent = { id, client_secret: `${id}_secret_x`, status: "requires_payment_method", amount_received: 0, last_payment_error: null, ...params };
        intents.set(id, intent);
        if (options.idempotencyKey) byIdempotencyKey.set(options.idempotencyKey, id);
        return { ...intent };
      },
      async retrieve(id) {
        if (!intents.has(id)) throw Object.assign(new Error("No such payment_intent"), { statusCode: 404 });
        return { ...intents.get(id) };
      },
      async cancel(id) {
        intents.get(id).status = "canceled";
        return { ...intents.get(id) };
      },
    },
    refunds: Object.assign(refunds, {
      async create(params, options = {}) {
        const existing = refunds.find((refund) => refund.idempotencyKey === options.idempotencyKey);
        if (existing) return existing;
        const refund = { id: `re_test${refunds.length + 1}`, idempotencyKey: options.idempotencyKey, ...params };
        refunds.push(refund);
        return refund;
      },
    }),
    succeed(id, overrides = {}) {
      const intent = intents.get(id);
      Object.assign(intent, { status: "succeeded", amount_received: intent.amount }, overrides);
    },
  };
}

const address = { street: "12 Hostel Road", city: "Gwalior", state: "MP", zipCode: "474015", country: "India" };
let replSet, server, baseUrl, stripe;
let buyer, seller, admin, outsider, category, campus, otherCollege;

test.before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri());
  await Promise.all([Order.init(), Product.init(), User.init(), PaymentAttempt.init(), WebhookEvent.init(), College.init()]);
  const app = require("../app");
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  paymentService.setStripeClientForTests(null);
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await mongoose.disconnect();
  await replSet?.stop({ doCleanup: true, force: false });
});

test.beforeEach(async () => {
  await Promise.all([Order, Product, User, Category, PaymentAttempt, WebhookEvent, College].map((model) => model.deleteMany({})));
  stripe = fakeStripe();
  paymentService.setStripeClientForTests(stripe);
  [campus, otherCollege] = await College.create([
    { name: "ABV-IIITM Gwalior", slug: "iiitm-gwalior", city: "Gwalior", state: "Madhya Pradesh", emailDomains: ["iiitm.ac.in"] },
    { name: "IIT Madras", slug: "iit-madras", city: "Chennai", state: "Tamil Nadu", emailDomains: ["iitm.ac.in"] },
  ]);
  [buyer, seller, admin, outsider] = await User.create([
    { name: "Buyer", email: "buyer@example.com", clerkId: "user_buyer" },
    { name: "Seller", email: "seller@example.com", clerkId: "user_seller", sellerStatus: "approved", isSeller: true, sellerApproved: true, sellerProfile: { college: campus._id } },
    { name: "Admin", email: "admin@example.com", clerkId: "user_admin", role: "admin" },
    { name: "Outsider", email: "outsider@example.com", clerkId: "user_outsider" },
  ]);
  category = await Category.create({ name: "Books" });
});

async function call(method, path, token, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const listing = (overrides = {}) => ({
  name: "Data Structures textbook", description: "Clean copy with no highlighting, 3rd edition.", price: 350, originalPrice: 500,
  stock: 2, category: String(category._id), sellerMobile: "9876543210", sellerHostelNumber: "BH-2", sellerRoomNumber: "101", ...overrides,
});
const application = { name: "Outsider Person", mobileNumber: "98765 43210", hostelNumber: "BH-1", roomNumber: "12", message: "I sell books" };
const withCollege = () => ({ ...application, collegeId: String(otherCollege._id) });

// ─── Seller lifecycle ─────────────────────────────────────────────────────────

test("a customer applies, is rejected with a reason, resubmits and is approved", async () => {
  assert.equal((await call("GET", "/users/me/seller", "user_outsider")).body.seller.status, "none");
  assert.equal((await call("POST", "/products", "user_outsider", listing())).status, 403);

  const invalid = await call("POST", "/users/seller-request", "user_outsider", { name: "X", mobileNumber: "12" });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.errors.mobileNumber && invalid.body.errors.hostelNumber && invalid.body.errors.roomNumber && invalid.body.errors.collegeId);

  const applied = await call("POST", "/users/seller-request", "user_outsider", withCollege());
  assert.equal(applied.status, 201);
  assert.equal(applied.body.seller.status, "pending");
  assert.equal(applied.body.seller.profile.mobileNumber, "9876543210");
  assert.equal(applied.body.seller.college.name, "IIT Madras");
  assert.equal((await call("POST", "/users/seller-request", "user_outsider", withCollege())).status, 409, "duplicate application");

  const pendingListing = await call("POST", "/products", "user_outsider", listing());
  assert.equal(pendingListing.status, 403);
  assert.match(pendingListing.body.message, /under review/);

  const queue = await call("GET", "/users/seller-requests", "user_admin");
  assert.deepEqual(queue.body.users.map((user) => user.email), ["outsider@example.com"]);
  assert.equal((await call("PUT", `/users/${outsider._id}/seller-approve`, "user_buyer")).status, 403, "only admins review");

  assert.equal((await call("PUT", `/users/${outsider._id}/seller-reject`, "user_admin", { reason: "Add your hostel details" })).status, 200);
  const rejected = (await call("GET", "/users/me/seller", "user_outsider")).body.seller;
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reason, "Add your hostel details");
  assert.equal(rejected.message, "I sell books", "the applicant's own message is preserved");

  assert.equal((await call("POST", "/users/seller-request", "user_outsider", withCollege())).body.seller.status, "pending");
  assert.equal((await call("PUT", `/users/${outsider._id}/seller-approve`, "user_admin")).status, 200);
  const approved = (await call("GET", "/users/me/seller", "user_outsider")).body.seller;
  assert.equal(approved.status, "approved");
  assert.equal(approved.canSell, true);
  const created = await call("POST", "/products", "user_outsider", listing());
  assert.equal(created.status, 201);
  assert.equal(created.body.product.college.name, "IIT Madras", "listed under the college chosen on the application");
});

test("a suspended seller cannot list or edit, but can take listings down", async () => {
  const created = await call("POST", "/products", "user_seller", listing());
  assert.equal(created.status, 201);
  const id = created.body.product._id;
  assert.equal((await call("PUT", `/users/${seller._id}/seller-suspend`, "user_admin", { reason: "Reported listing" })).status, 200);

  const status = (await call("GET", "/users/me/seller", "user_seller")).body.seller;
  assert.deepEqual([status.status, status.canSell, status.reason], ["suspended", false, "Reported listing"]);
  assert.match((await call("POST", "/products", "user_seller", listing())).body.message, /suspended/);
  assert.equal((await call("PUT", `/products/${id}`, "user_seller", { stock: 5 })).status, 403);
  assert.equal((await call("PUT", `/products/${id}`, "user_seller", { isActive: false })).status, 200);
  assert.equal((await call("POST", "/users/seller-request", "user_seller", withCollege())).status, 403);

  assert.equal((await call("PUT", `/users/${seller._id}/seller-reinstate`, "user_admin")).status, 200);
  assert.equal((await call("PUT", `/products/${id}`, "user_seller", { isActive: true, stock: 5 })).status, 200);
});

test("verified campus accounts can sell without applying and become moderatable sellers", async () => {
  await User.create({ name: "Student", email: "student@iiitm.ac.in", clerkId: "user_student", isVerified: true });
  const status = (await call("GET", "/users/me/seller", "user_student")).body.seller;
  assert.deepEqual([status.status, status.canSell, status.campusEligible], ["none", true, true]);
  assert.equal(status.college.name, "ABV-IIITM Gwalior", "college derived from the verified campus domain");
  const created = await call("POST", "/products", "user_student", listing());
  assert.equal(created.status, 201);
  assert.equal(created.body.product.college._id, String(campus._id));
  const after = (await call("GET", "/users/me/seller", "user_student")).body.seller;
  assert.deepEqual([after.status, after.collegeSource], ["approved", "profile"], "the derived college is recorded on the profile");
});

// ─── Product management ───────────────────────────────────────────────────────

test("product validation, ownership and publishing are enforced on the server", async () => {
  for (const [bad, pattern] of [[{ price: 0 }, /greater than zero/], [{ description: "short" }, /10–5000/], [{ name: "" }, /required/], [{ stock: -1 }, /Stock/], [{ category: "x" }, /active category/], [{ images: ["javascript:alert(1)"] }, /image URLs/]]) {
    const response = await call("POST", "/products", "user_seller", listing(bad));
    assert.equal(response.status, 400, JSON.stringify(bad));
    assert.match(response.body.message, pattern);
  }
  const created = await call("POST", "/products", "user_seller", { ...listing(), seller: String(buyer._id), isFeatured: true });
  const product = created.body.product;
  assert.equal(product.seller, String(seller._id), "ownership comes from the token, not the body");
  assert.equal(product.isFeatured, false, "sellers cannot feature their own listings");
  assert.equal((await call("GET", `/products?category=${category.slug}`)).body.total, 1, "listed in its category");

  await User.updateOne({ _id: outsider._id }, { $set: { sellerStatus: "approved" } });
  assert.equal((await call("PUT", `/products/${product._id}`, "user_outsider", { price: 1 })).status, 403, "another seller's product");
  assert.equal((await call("DELETE", `/products/${product._id}`, "user_outsider")).status, 403);
  assert.equal((await call("PUT", `/products/${product._id}`, "user_seller", { description: "tiny" })).status, 400, "updates are validated too");

  const restocked = await call("PUT", `/products/${product._id}`, "user_seller", { stock: 0 });
  assert.deepEqual([restocked.body.product.stock, restocked.body.product.sold], [0, true]);
  await call("PUT", `/products/${product._id}`, "user_seller", { stock: 4 });
  assert.equal((await call("PUT", `/products/${product._id}`, "user_seller", { isActive: false })).status, 200);
  assert.equal((await call("GET", "/products")).body.total, 0, "unpublished listings leave the storefront");
  assert.equal((await call("GET", `/products?seller=${seller._id}`, "user_seller")).body.total, 1, "but stay visible to their seller");
  await call("PUT", `/products/${product._id}`, "user_seller", { isActive: true });
  assert.equal((await call("GET", "/products?search=structures")).body.total, 1, "republished listings are searchable");
});

test("only sellers can upload product images, and only real image types", async () => {
  const fs = require("fs");
  const path = require("path");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const send = (token, type, name, bytes = png) => {
    const form = new FormData();
    form.append("image", new Blob([bytes], { type }), name);
    return fetch(`${baseUrl}/uploads`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  };
  assert.equal((await send("user_buyer", "image/png", "a.png")).status, 403, "customers who aren't sellers");
  assert.equal((await send("user_seller", "text/html", "x.html", Buffer.from("<script>"))).status, 400);
  const ok = await send("user_seller", "image/png", "photo.png");
  assert.equal(ok.status, 200);
  const { url } = await ok.json();
  assert.match(url, /^http:\/\/test\.local\/uploads\/\d+-[a-f0-9]{12}\.png$/, "server-chosen name and extension");
  fs.rmSync(path.join(__dirname, "..", "public", "uploads", url.split("/").pop()), { force: true });
});

// ─── Card checkout ────────────────────────────────────────────────────────────

async function makeProduct(overrides = {}) {
  return Product.create({ name: "Algorithms", description: "A textbook in good shape", price: 450, originalPrice: 600, stock: 3, category: category._id, seller: seller._id, ...overrides });
}

async function startCheckout(product, extra = {}) {
  return call("POST", "/payments/create-intent", "user_buyer", {
    items: [{ product: String(product._id), quantity: 2, price: 1 }], shippingAddress: address, shippingMethod: "express",
    requestId: "checkout-request-0001", amount: 1, ...extra,
  });
}

function signedWebhook(event) {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return fetch(`${baseUrl}/webhooks/stripe`, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": signature }, body: payload });
}

test("the server prices card checkouts and reuses one PaymentIntent per checkout", async () => {
  assert.equal((await call("GET", "/payments/config")).body.cardEnabled, true);
  const product = await makeProduct();
  const first = await startCheckout(product);
  assert.equal(first.status, 200);
  assert.equal(first.body.breakdown.totalPrice, 912.99, "450 × 2 + 12.99 express, ignoring client-sent prices");
  assert.equal(stripe.intents.get(first.body.paymentIntentId).amount, 91299);
  assert.equal(first.body.secretKey, undefined);

  const retry = await startCheckout(product);
  assert.equal(retry.body.paymentIntentId, first.body.paymentIntentId);
  assert.equal(await PaymentAttempt.countDocuments(), 1);

  const changed = await startCheckout(product, { shippingMethod: "standard" });
  assert.notEqual(changed.body.paymentIntentId, first.body.paymentIntentId);
  assert.equal(stripe.intents.get(first.body.paymentIntentId).status, "canceled", "the stale PaymentIntent is cancelled");
});

test("an order is created only after Stripe reports success, exactly once", async () => {
  const product = await makeProduct();
  const { body } = await startCheckout(product);
  const pi = body.paymentIntentId;

  const early = await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: pi });
  assert.equal(early.status, 402);
  assert.equal(await Order.countDocuments(), 0, "a success page alone never creates an order");

  stripe.succeed(pi);
  assert.equal((await call("POST", "/payments/confirm-order", "user_outsider", { paymentIntentId: pi })).status, 404, "other customers can't claim it");
  const confirmed = await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: pi, shippingAddress: { ...address, city: "Elsewhere" } });
  assert.equal(confirmed.status, 201);
  const order = confirmed.body.order;
  assert.deepEqual([order.isPaid, order.paymentMethod, order.status, order.totalPrice], [true, "card", "Processing", 912.99]);
  assert.equal(order.shippingAddress.city, "Gwalior", "the address captured before payment is used");
  assert.equal((await Product.findById(product._id)).stock, 1);

  const again = await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: pi });
  assert.equal(again.status, 200);
  assert.equal(again.body.order._id, order._id);
  const webhook = await signedWebhook({ id: "evt_1", type: "payment_intent.succeeded", data: { object: { id: pi } } });
  assert.equal(webhook.status, 200);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal((await call("GET", `/orders/${order._id}`, "user_outsider")).status, 403);
});

test("the webhook confirms orders on its own, verifies signatures and ignores redeliveries", async () => {
  const product = await makeProduct();
  const pi = (await startCheckout(product)).body.paymentIntentId;
  stripe.succeed(pi);

  const forged = await fetch(`${baseUrl}/webhooks/stripe`, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": "t=1,v1=bad" }, body: "{}" });
  assert.equal(forged.status, 400);
  assert.equal(await Order.countDocuments(), 0);

  const event = { id: "evt_success", type: "payment_intent.succeeded", data: { object: { id: pi } } };
  assert.equal((await signedWebhook(event)).status, 200);
  const duplicate = await signedWebhook(event);
  assert.equal((await duplicate.json()).duplicate, true);
  const orders = await Order.find();
  assert.equal(orders.length, 1);
  assert.equal(orders[0].isPaid, true);
  assert.equal((await PaymentAttempt.findOne({ paymentIntentId: pi })).status, "paid");
  assert.equal((await signedWebhook({ id: "evt_other", type: "payment_intent.succeeded", data: { object: { id: "pi_unknown" } } })).status, 200, "unknown payments are acknowledged");
});

test("declined, processing and mismatched payments never produce a paid order", async () => {
  const product = await makeProduct();
  const pi = (await startCheckout(product)).body.paymentIntentId;

  Object.assign(stripe.intents.get(pi), { last_payment_error: { message: "Your card was declined." } });
  const declined = await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: pi });
  assert.deepEqual([declined.status, declined.body.state, declined.body.message], [402, "failed", "Your card was declined."]);

  stripe.intents.get(pi).status = "processing";
  assert.equal((await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: pi })).status, 202);

  stripe.succeed(pi, { amount_received: 100 });
  assert.equal((await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: pi })).status, 409);
  assert.equal((await PaymentAttempt.findOne({ paymentIntentId: pi })).status, "review_required");
  assert.equal(await Order.countDocuments(), 0);
  assert.equal((await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: "pi_x' || 1" })).status, 400);
});

test("a payment that can no longer be fulfilled is refunded automatically", async () => {
  const product = await makeProduct();
  const pi = (await startCheckout(product)).body.paymentIntentId;
  await Product.updateOne({ _id: product._id }, { $set: { stock: 1 } }); // someone else bought one meanwhile
  stripe.succeed(pi);
  const result = await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: pi });
  assert.equal(result.body.state, "refunded");
  assert.match(result.body.message, /refunded/);
  assert.equal(stripe.refunds.length, 1);
  assert.equal(stripe.refunds[0].payment_intent, pi);
  assert.equal(await Order.countDocuments(), 0);
  assert.equal((await Product.findById(product._id)).stock, 1, "stock untouched");
  await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: pi });
  assert.equal(stripe.refunds.length, 1, "never refunded twice");
});

test("cancelling a paid card order refunds it once and restores stock", async () => {
  const product = await makeProduct();
  const pi = (await startCheckout(product)).body.paymentIntentId;
  stripe.succeed(pi);
  const { order } = (await call("POST", "/payments/confirm-order", "user_buyer", { paymentIntentId: pi })).body;
  const cancelled = await call("PUT", `/orders/${order._id}/cancel`, "user_buyer");
  assert.equal(cancelled.status, 200);
  assert.deepEqual([cancelled.body.order.refundedAmount, cancelled.body.order.paymentResult.status], [912.99, "refunded"]);
  assert.equal(stripe.refunds[0].amount, 91299);
  assert.equal((await Product.findById(product._id)).stock, 3);
  assert.equal((await call("POST", "/orders", "user_buyer", { items: [{ product: String(product._id), quantity: 1 }], shippingAddress: address, paymentMethod: "card" })).status, 400, "card orders can't skip payment");
});

// ─── College Mode ─────────────────────────────────────────────────────────────

test("the public college list is searchable, hides inactive colleges and private fields", async () => {
  await College.create({ name: "Closed Institute", slug: "closed", city: "Nowhere", isActive: false });
  const all = (await call("GET", "/colleges")).body;
  assert.deepEqual(all.colleges.map((c) => c.name), ["ABV-IIITM Gwalior", "IIT Madras"]);
  assert.equal(all.colleges[0].emailDomains, undefined);
  assert.deepEqual((await call("GET", "/colleges?search=chennai")).body.colleges.map((c) => c.name), ["IIT Madras"]);
  assert.equal((await call("GET", "/colleges?search=.*")).body.total, 0, "search input is not a regex");
  assert.equal((await call("POST", "/colleges", "user_buyer", { name: "New College" })).status, 403);
  assert.equal((await call("POST", "/colleges", "user_admin", { name: "iit madras", city: "chennai" })).status, 409, "no duplicates");
  const added = await call("POST", "/colleges", "user_admin", { name: "NIT Trichy", city: "Tiruchirappalli", emailDomains: ["@nitt.edu"] });
  assert.equal(added.status, 201);
  assert.deepEqual(added.body.college.emailDomains, ["nitt.edu"]);
  assert.equal((await call("PUT", `/colleges/${added.body.college._id}`, "user_admin", { isActive: false })).body.college.isActive, false);
});

test("College Mode preference: choose, turn off without forgetting, turn on again, handle retired colleges", async () => {
  assert.equal((await call("PUT", "/auth/me/college", "user_buyer", { enabled: true })).status, 400, "needs a college first");
  assert.equal((await call("PUT", "/auth/me/college", "user_buyer", { enabled: true, collegeId: "nope" })).status, 400);
  const chosen = await call("PUT", "/auth/me/college", "user_buyer", { enabled: true, collegeId: String(campus._id) });
  assert.deepEqual([chosen.body.preference.enabled, chosen.body.preference.college.name], [true, "ABV-IIITM Gwalior"]);
  const off = await call("PUT", "/auth/me/college", "user_buyer", { enabled: false });
  assert.deepEqual([off.body.preference.enabled, off.body.preference.college.name], [false, "ABV-IIITM Gwalior"], "college is remembered");
  assert.equal((await call("PUT", "/auth/me/college", "user_buyer", { enabled: true })).body.preference.enabled, true);

  await College.updateOne({ _id: campus._id }, { $set: { isActive: false } });
  const stale = (await call("GET", "/auth/me/college", "user_buyer")).body.preference;
  assert.deepEqual([stale.enabled, stale.unavailable], [false, true]);
  assert.equal((await call("PUT", "/auth/me/college", "user_buyer", { enabled: true })).status, 400);
  assert.equal((await call("GET", "/auth/me/college")).status, 401, "preferences are private");
});

test("products follow the seller's college and sellers cannot move them to another campus", async () => {
  const created = await call("POST", "/products", "user_seller", { ...listing(), college: String(otherCollege._id) });
  assert.equal(created.body.product.college._id, String(campus._id), "client-sent college is ignored");
  const id = created.body.product._id;
  await call("PUT", `/products/${id}`, "user_seller", { college: String(otherCollege._id), stock: 7 });
  const stored = await Product.findById(id);
  assert.deepEqual([String(stored.college), stored.stock], [String(campus._id), 7]);
  assert.equal((await call("PUT", `/products/${id}`, "user_admin", { college: String(otherCollege._id) })).body.product.college.name, "IIT Madras", "admins may correct it");

  // A legacy seller without a college must add one (once) before listing.
  await User.updateOne({ _id: outsider._id }, { $set: { sellerStatus: "approved", isSeller: true, sellerApproved: true } });
  const blocked = await call("POST", "/products", "user_outsider", listing());
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.message, /Add your college/);
  assert.equal((await call("GET", "/users/me/seller", "user_outsider")).body.seller.needsCollege, true);
  assert.equal((await call("PUT", "/users/me/seller-college", "user_outsider", { collegeId: String(otherCollege._id) })).status, 200);
  assert.equal((await call("PUT", "/users/me/seller-college", "user_outsider", { collegeId: String(campus._id) })).status, 409, "only once");
  const first = (await call("POST", "/products", "user_outsider", listing())).body.product;

  // An admin change applies to future listings only.
  assert.equal((await call("PUT", `/users/${outsider._id}/seller-college`, "user_buyer", { collegeId: String(campus._id) })).status, 403);
  assert.equal((await call("PUT", `/users/${outsider._id}/seller-college`, "user_admin", { collegeId: String(campus._id) })).status, 200);
  const second = (await call("POST", "/products", "user_outsider", listing())).body.product;
  assert.equal(String((await Product.findById(first._id)).college), String(otherCollege._id));
  assert.equal(second.college._id, String(campus._id));
});

test("College Mode filtering is enforced by the API across search, category, sort and pagination", async () => {
  const books = category;
  const gadgets = await Category.create({ name: "Gadgets" });
  await Product.create([
    { name: "Campus calculus book", description: "Book in good shape", price: 300, stock: 1, category: books._id, college: campus._id },
    { name: "Campus lamp", description: "Lamp in good shape", price: 500, stock: 1, category: gadgets._id, college: campus._id },
    { name: "Campus hidden book", description: "Unpublished listing", price: 100, stock: 1, category: books._id, college: campus._id, isActive: false },
    { name: "Chennai calculus book", description: "Book in good shape", price: 200, stock: 1, category: books._id, college: otherCollege._id },
    { name: "Global calculus book", description: "Book in good shape", price: 250, stock: 1, category: books._id },
  ]);
  const names = async (query) => { const r = await call("GET", `/products?${query}`); assert.ok(r.body.products, `${query}: ${r.status} ${r.body.message}`); return r.body.products.map((p) => p.name); };
  assert.equal((await call("GET", "/products")).body.total, 4, "College Mode off: the whole published catalogue");
  assert.deepEqual(await names(`college=${campus._id}&sort=price`), ["Campus calculus book", "Campus lamp"]);
  assert.deepEqual(await names(`college=${campus._id}&search=calculus`), ["Campus calculus book"]);
  assert.deepEqual(await names(`college=${campus._id}&category=${books.slug}`), ["Campus calculus book"]);
  assert.deepEqual(await names(`college=${otherCollege._id}`), ["Chennai calculus book"]);
  const page2 = (await call("GET", `/products?college=${campus._id}&sort=price&limit=1&page=2`)).body;
  assert.deepEqual([page2.total, page2.pages, page2.products[0].name], [2, 2, "Campus lamp"]);
  assert.equal(page2.products[0].college.name, "ABV-IIITM Gwalior");
  assert.equal((await call("GET", "/products?college=abc")).status, 400);
  await College.updateOne({ _id: otherCollege._id }, { $set: { isActive: false } });
  assert.equal((await call("GET", `/products?college=${otherCollege._id}`)).status, 404, "retired colleges are reported, not silently emptied");
});

test("orders record each item's college, and the cart works across colleges", async () => {
  const a = await makeProduct({ college: campus._id });
  const b = await makeProduct({ name: "Chennai notes", college: otherCollege._id });
  const { order } = await require("../services/orderService").createOrder(buyer._id, {
    items: [{ product: String(a._id), quantity: 1 }, { product: String(b._id), quantity: 1 }], shippingAddress: address,
  });
  assert.deepEqual(order.items.map((item) => String(item.college)), [String(campus._id), String(otherCollege._id)]);
});
