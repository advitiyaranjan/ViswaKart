const User = require("../models/User");
const { fail } = require("../utils/commerce");

function identityFromClerk(profile) {
  const emails = profile.emailAddresses || profile.email_addresses || [];
  const primaryId = profile.primaryEmailAddressId || profile.primary_email_address_id;
  const primary = emails.find((entry) => entry.id === primaryId) || emails[0];
  const email = (primary?.emailAddress || primary?.email_address || "").trim().toLowerCase();
  const name = `${profile.firstName || profile.first_name || ""} ${profile.lastName || profile.last_name || ""}`.trim() || profile.username || email || "Customer";
  return { clerkId: profile.id, email: email || undefined, name, avatar: profile.imageUrl || profile.image_url || "", isVerified: primary?.verification?.status === "verified" };
}

async function syncClerkUser(profile) {
  const identity = identityFromClerk(profile);
  if (!identity.clerkId) fail("Invalid authentication identity", 401);
  let user = await User.findOne({ clerkId: identity.clerkId });
  // Only a verified address can link a legacy account; never reassign another Clerk identity.
  if (!user && identity.email && identity.isVerified) {
    user = await User.findOneAndUpdate({ email: identity.email, $or: [{ clerkId: null }, { clerkId: { $exists: false } }] }, { $set: { clerkId: identity.clerkId } }, { new: true });
  }
  if (user) {
    Object.assign(user, identity);
    await user.save();
    return { user, created: false };
  }
  try {
    return { user: await User.create(identity), created: true };
  } catch (error) {
    if (error.code !== 11000) throw error;
    // Webhook and first authenticated request can arrive concurrently.
    user = await User.findOne({ clerkId: identity.clerkId });
    if (!user) fail("This email is already associated with another account", 409);
    return { user, created: false };
  }
}

module.exports = { identityFromClerk, syncClerkUser };
