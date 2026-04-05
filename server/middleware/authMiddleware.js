const { createClerkClient } = require("@clerk/backend");
const User = require("../models/User");

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Protect routes — verify Clerk session token
exports.protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await clerk.verifyToken(token);
    const clerkUserId = payload.sub;

    // Find or auto-create the user record in MongoDB keyed by Clerk user ID
    let user = await User.findOne({ clerkId: clerkUserId });
    if (!user) {
      // Fetch user details from Clerk to populate the record
      const clerkUser = await clerk.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? "";
      const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || email;
      user = await User.create({
        clerkId: clerkUserId,
        name,
        email,
        avatar: clerkUser.imageUrl,
        // password not required for Clerk-managed users — set a random value
        password: require("crypto").randomBytes(32).toString("hex"),
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: "Account deactivated" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// Role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};
