const User = require("../models/User");

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, user });
};

// @desc    Update user profile
// @route   PUT /api/auth/me
// @access  Private
exports.updateProfile = async (req, res) => {
  const { name, phone, avatar } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { name, phone, avatar },
    { new: true, runValidators: true }
  );
  res.status(200).json({ success: true, user });
};

// @desc    Add address
// @route   POST /api/auth/me/addresses
// @access  Private
exports.addAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const { label, phone, street, city, state, zipCode, country, isDefault } = req.body;
  if (isDefault) {
    user.addresses.forEach((a) => { a.isDefault = false; });
  }
  user.addresses.push({ label, phone, street, city, state, zipCode, country, isDefault: !!isDefault });
  await user.save();
  res.status(201).json({ success: true, addresses: user.addresses });
};

// @desc    Update address
// @route   PUT /api/auth/me/addresses/:addrId
// @access  Private
exports.updateAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const addr = user.addresses.id(req.params.addrId);
  if (!addr) return res.status(404).json({ success: false, message: "Address not found" });
  const { label, phone, street, city, state, zipCode, country, isDefault } = req.body;
  if (isDefault) {
    user.addresses.forEach((a) => { a.isDefault = false; });
  }
  Object.assign(addr, { label, phone, street, city, state, zipCode, country, isDefault: !!isDefault });
  await user.save();
  res.status(200).json({ success: true, addresses: user.addresses });
};

// @desc    Delete address
// @route   DELETE /api/auth/me/addresses/:addrId
// @access  Private
exports.deleteAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const addr = user.addresses.id(req.params.addrId);
  if (!addr) return res.status(404).json({ success: false, message: "Address not found" });
  addr.deleteOne();
  await user.save();
  res.status(200).json({ success: true, addresses: user.addresses });
};


// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select("+password");
  if (!(await user.matchPassword(currentPassword))) {
    return res.status(400).json({ success: false, message: "Current password is incorrect" });
  }

  user.password = newPassword;
  await user.save();
  sendTokenResponse(user, 200, res);
};

// @desc    Send OTP for email verification before registration
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOtp = async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ success: false, message: "Name, email and password are required" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: "Email already registered" });
  }

  // Generate 6-digit OTP
  const otp = String(crypto.randomInt(100000, 999999));
  const passwordHash = await bcrypt.hash(password, 12);

  // Remove any previous OTP for this email
  await Otp.deleteMany({ email });

  await Otp.create({ email, otp, pendingUser: { name, passwordHash } });

  await sendOtpEmail(email, otp);

  res.status(200).json({ success: true, message: "OTP sent to your email" });
};

// @desc    Verify OTP and complete registration
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP are required" });
  }

  const record = await Otp.findOne({ email });
  if (!record) {
    return res.status(400).json({ success: false, message: "OTP expired or not found. Please request a new one." });
  }

  if (record.otp !== String(otp).trim()) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  // Create user with pre-hashed password (skip the bcrypt pre-save hook)
  const user = new User({
    name: record.pendingUser.name,
    email,
    password: record.pendingUser.passwordHash,
    isVerified: true,
  });
  // Mark password as NOT modified so pre-save hook won't re-hash
  user.$locals.skipHashPassword = true;
  await user.save();

  await Otp.deleteMany({ email });

  sendTokenResponse(user, 201, res);
};

// @desc    Send OTP to verify email/phone change (for logged-in users)
// @route   POST /api/auth/send-contact-otp
// @access  Private
exports.sendContactOtp = async (req, res) => {
  const { type, newValue } = req.body;
  if (!type || !newValue) {
    return res.status(400).json({ success: false, message: "type and newValue are required" });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  let sendTo = user.email; // default: send OTP to current account email

  if (type === "email") {
    // Check new email not already taken
    const exists = await User.findOne({ email: newValue.toLowerCase().trim() });
    if (exists) return res.status(400).json({ success: false, message: "This email is already in use" });
    sendTo = newValue.trim(); // send OTP to the new email
  }

  if (!sendTo) {
    return res.status(400).json({ success: false, message: "No email address available to send OTP" });
  }

  const otp = String(crypto.randomInt(100000, 999999));

  // Store under a unique key: userId + type
  const key = `contact_update_${req.user.id}_${type}`;
  await Otp.deleteMany({ email: key });
  await Otp.create({ email: key, otp, pendingUser: { name: newValue } });

  await sendOtpEmail(sendTo, otp);

  res.status(200).json({ success: true, message: `OTP sent to ${sendTo}` });
};

// @desc    Verify OTP and apply email/phone update
// @route   POST /api/auth/verify-contact-otp
// @access  Private
exports.verifyContactOtp = async (req, res) => {
  const { type, newValue, otp } = req.body;
  if (!type || !newValue || !otp) {
    return res.status(400).json({ success: false, message: "type, newValue and otp are required" });
  }

  const key = `contact_update_${req.user.id}_${type}`;
  const record = await Otp.findOne({ email: key });
  if (!record) {
    return res.status(400).json({ success: false, message: "OTP expired or not found. Please request a new one." });
  }

  if (record.otp !== String(otp).trim()) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  const update = type === "email" ? { email: newValue.toLowerCase().trim() } : { phone: newValue.trim() };
  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true });
  await Otp.deleteMany({ email: key });

  res.status(200).json({ success: true, user });
};


// @access  Internal (called from passport strategy)
exports.googleCallback = async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error("No email from Google"), null);

    let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
    if (user) {
      if (!user.googleId) {
        user.googleId = profile.id;
        await user.save();
      }
    } else {
      user = await User.create({
        name: profile.displayName || email.split("@")[0],
        email,
        googleId: profile.id,
        avatar: profile.photos?.[0]?.value || "",
        isVerified: true,
      });
    }
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
};

// @desc    Add address
// @route   POST /api/auth/me/addresses
// @access  Private
exports.addAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const { label, phone, street, city, state, zipCode, country, isDefault } = req.body;
  if (isDefault) {
    user.addresses.forEach((a) => { a.isDefault = false; });
  }
  user.addresses.push({ label, phone, street, city, state, zipCode, country, isDefault: !!isDefault });
  await user.save();
  res.status(201).json({ success: true, addresses: user.addresses });
};

// @desc    Update address
// @route   PUT /api/auth/me/addresses/:addrId
// @access  Private
exports.updateAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const addr = user.addresses.id(req.params.addrId);
  if (!addr) return res.status(404).json({ success: false, message: "Address not found" });
  const { label, phone, street, city, state, zipCode, country, isDefault } = req.body;
  if (isDefault) {
    user.addresses.forEach((a) => { a.isDefault = false; });
  }
  Object.assign(addr, { label, phone, street, city, state, zipCode, country, isDefault: !!isDefault });
  await user.save();
  res.status(200).json({ success: true, addresses: user.addresses });
};

// @desc    Delete address
// @route   DELETE /api/auth/me/addresses/:addrId
// @access  Private
exports.deleteAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const addr = user.addresses.id(req.params.addrId);
  if (!addr) return res.status(404).json({ success: false, message: "Address not found" });
  addr.deleteOne();
  await user.save();
  res.status(200).json({ success: true, addresses: user.addresses });
};
