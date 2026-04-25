const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
const User = require('../models/User');

// Read MONGO_URI from server/.env if present, fall back to process.env
let MONGO_URI = process.env.MONGO_URI;
try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const m = env.match(/MONGO_URI=(.*)/);
  if (m) MONGO_URI = m[1].trim();
} catch (e) {
  // ignore
}

(async () => {
  try {
    if (!MONGO_URI) throw new Error('MONGO_URI not found');
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const users = await User.find({ sellerRequested: true }).select('name email sellerProfile sellerRequestMessage sellerRequestedAt');
    console.log(JSON.stringify(users, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
})();
