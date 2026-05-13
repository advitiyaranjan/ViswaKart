const { createClerkClient, verifyToken } = require("@clerk/backend");
const User = require("../models/User");
const { syncClerkUser } = require("../services/clerkUserService");

exports.protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "Not authenticated" });
  let payload;
  try {
    payload = await verifyToken(authHeader.slice(7), { secretKey: process.env.CLERK_SECRET_KEY });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
  try {
    let user = await User.findOne({ clerkId: payload.sub });
    if (!user) {
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const profile = await clerk.users.getUser(payload.sub);
      ({ user } = await syncClerkUser(profile));
    }
    if (!user.isActive) return res.status(401).json({ success: false, message: "Account deactivated" });
    req.user = user;
    return next();
  } catch (error) {
    // Database/provider failures are server failures, not an expired login.
    return next(error);
  }
};

exports.optionalAuth = (req, res, next) => req.headers.authorization ? exports.protect(req, res, next) : next();

exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, message: "Not authorized to access this resource" });
  return next();
};
