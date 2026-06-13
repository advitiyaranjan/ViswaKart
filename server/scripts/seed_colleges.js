// Adds the initial college list without touching colleges that already exist (matched by slug).
// Usage: npm run seed:colleges
require("dotenv").config();
const mongoose = require("mongoose");
const College = require("../models/College");
const colleges = require("../data/colleges");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  let created = 0;
  for (const college of colleges) {
    const result = await College.updateOne({ slug: college.slug }, { $setOnInsert: { ...college, country: "India", isActive: true } }, { upsert: true });
    created += result.upsertedCount;
  }
  console.log(`Colleges: ${created} added, ${colleges.length - created} already present.`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
