const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      sparse: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      select: false,
    },
    googleId: {
      type: String,
      default: null,
    },
    clerkId: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    avatar: {
      type: String,
      default: "",
    },
    phone: { type: String, default: "" },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    addresses: [
      {
        name: { type: String, default: "" },
        label: { type: String, default: "Home" },
        phone: { type: String, default: "" },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        country: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Seller fields
    isSeller: {
      type: Boolean,
      default: false,
    },
    sellerApproved: {
      type: Boolean,
      default: false,
    },
    sellerRequested: {
      type: Boolean,
      default: false,
    },
    // Authoritative seller lifecycle state; the booleans above are kept in sync for older code paths.
    sellerStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected", "suspended"],
      default: "none",
    },
    sellerRejectionReason: { type: String, default: "" },
    sellerSuspensionReason: { type: String, default: "" },
    sellerReviewedAt: Date,
    sellerRequestedAt: Date,
    sellerApprovedAt: Date,
    // Profile info provided by seller when listing products
    sellerProfile: {
      name: { type: String, default: "" },
      hostelNumber: { type: String, default: "" },
      roomNumber: { type: String, default: "" },
      courseYear: { type: String, default: "" },
      mobileNumber: { type: String, default: "" },
      // College this seller's listings belong to. Set on the application; afterwards only admins change it.
      college: { type: mongoose.Schema.Types.ObjectId, ref: "College", default: null },
    },
    // College Mode shopping preference. Turning the mode off keeps the college for next time.
    collegePreference: {
      college: { type: mongoose.Schema.Types.ObjectId, ref: "College", default: null },
      enabled: { type: Boolean, default: false },
    },
    sellerRequestMessage: { type: String, default: "" },
  },
  { timestamps: true, optimisticConcurrency: true }
);

// Hash password before saving (only if password is set)
userSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) return next();
  if (this.$locals && this.$locals.skipHashPassword) return next(); // already hashed
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Match entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.index({ clerkId: 1 }, { unique: true, partialFilterExpression: { clerkId: { $type: "string" } } });
module.exports = mongoose.model("User", userSchema);
