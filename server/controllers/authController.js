const User = require("../models/User");
const { validateAddress, fail } = require("../utils/commerce");

exports.getMe = async (req, res) => res.json({ success: true, user: req.user });

exports.updateProfile = async (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) {
    if (typeof req.body.name !== "string" || req.body.name.trim().length < 2) fail("Name must contain at least two characters");
    updates.name = req.body.name.trim();
  }
  if (req.body.phone !== undefined) {
    if (typeof req.body.phone !== "string" || !/^[0-9]{7,15}$/.test(req.body.phone)) fail("Phone must contain 7 to 15 digits");
    updates.phone = req.body.phone;
  }
  if (req.body.avatar !== undefined) {
    if (typeof req.body.avatar !== "string" || (req.body.avatar && !/^https?:\/\//.test(req.body.avatar))) fail("Avatar must be an image URL");
    updates.avatar = req.body.avatar;
  }
  const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true });
  if (!user) fail("User not found", 404);
  res.json({ success: true, user });
};

function addressFields(body) {
  if (typeof body.name !== "string" || body.name.trim().length < 2) fail("Name is required");
  if (typeof body.phone !== "string" || !/^[0-9]{7,15}$/.test(body.phone)) fail("Phone number must contain 7 to 15 digits");
  return { ...validateAddress(body), name: body.name.trim(), phone: body.phone, label: String(body.label || "Home").slice(0, 50) };
}

function normalizeDefault(user, preferredId) {
  const chosen = user.addresses.id(preferredId) || user.addresses.find((address) => address.isDefault) || user.addresses[0];
  user.addresses.forEach((address) => { address.isDefault = String(address._id) === String(chosen?._id); });
  user.address = chosen ? { street: chosen.street, city: chosen.city, state: chosen.state, zipCode: chosen.zipCode, country: chosen.country } : undefined;
}

exports.addAddress = async (req, res) => {
  const fields = addressFields(req.body);
  const user = await User.findById(req.user.id);
  if (!user) fail("User not found", 404);
  user.addresses.push(fields);
  normalizeDefault(user, req.body.isDefault === true ? user.addresses.at(-1)._id : null);
  await user.save();
  res.status(201).json({ success: true, addresses: user.addresses });
};

exports.updateAddress = async (req, res) => {
  const fields = addressFields(req.body);
  const user = await User.findById(req.user.id);
  if (!user) fail("User not found", 404);
  const address = user.addresses.id(req.params.addrId);
  if (!address) fail("Address not found", 404);
  Object.assign(address, fields);
  normalizeDefault(user, req.body.isDefault === true ? address._id : null);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
};

exports.deleteAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) fail("User not found", 404);
  const address = user.addresses.id(req.params.addrId);
  if (!address) fail("Address not found", 404);
  address.deleteOne();
  normalizeDefault(user);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
};
