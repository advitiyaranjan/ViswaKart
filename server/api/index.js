require("dotenv").config();
const app = require("../app");
const connectDB = require("../config/db");

let isConnected = false;

// Reuse connection across warm invocations
const ensureDB = async () => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
};

module.exports = async (req, res) => {
  await ensureDB();
  return app(req, res);
};
