const College = require("../models/College");
const { fail, escapeRegex } = require("../utils/commerce");
const { isObjectId, PUBLIC_FIELDS } = require("../utils/college");

// GET /api/colleges?search=&limit= — public list of active colleges (admins may add includeInactive=true)
exports.getColleges = async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
  const admin = req.user?.role === "admin" && req.query.includeInactive === "true";
  const query = admin ? {} : { isActive: true };
  const search = String(req.query.search || "").trim().slice(0, 100);
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    query.$or = [{ name: pattern }, { city: pattern }, { state: pattern }, { slug: pattern }];
  }
  const [colleges, total] = await Promise.all([
    College.find(query).select(admin ? undefined : PUBLIC_FIELDS).sort("name").limit(limit).lean(),
    College.countDocuments(query),
  ]);
  res.json({ success: true, total, colleges });
};

// GET /api/colleges/:id — includes inactive colleges so saved selections can be recognised as unavailable
exports.getCollege = async (req, res) => {
  if (!isObjectId(req.params.id)) fail("College not found", 404);
  const college = await College.findById(req.params.id).select(PUBLIC_FIELDS).lean();
  if (!college) fail("College not found", 404);
  res.json({ success: true, college });
};

function collegeFields(body, partial = false) {
  const fields = {};
  for (const [key, max] of [["name", 150], ["city", 80], ["state", 80], ["country", 80]]) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string") fail(`${key} must be text`);
    fields[key] = body[key].trim().slice(0, max);
  }
  if (!partial && (!fields.name || fields.name.length < 2)) fail("College name must be at least 2 characters");
  if (partial && fields.name !== undefined && fields.name.length < 2) fail("College name must be at least 2 characters");
  if (body.emailDomains !== undefined) {
    if (!Array.isArray(body.emailDomains) || body.emailDomains.length > 10) fail("Provide up to 10 email domains");
    fields.emailDomains = [...new Set(body.emailDomains.map((d) => String(d).trim().toLowerCase().replace(/^@/, "")).filter(Boolean))];
    if (fields.emailDomains.some((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))) fail("Email domains must look like example.ac.in");
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") fail("Active must be true or false");
    fields.isActive = body.isActive;
  }
  return fields;
}

exports.createCollege = async (req, res) => {
  const fields = collegeFields(req.body);
  const duplicate = await College.findOne({ name: { $regex: `^${escapeRegex(fields.name)}$`, $options: "i" }, city: { $regex: `^${escapeRegex(fields.city || "")}$`, $options: "i" } });
  if (duplicate) fail("This college is already in the list", 409);
  const college = await College.create(fields);
  res.status(201).json({ success: true, college });
};

// Colleges are never deleted: sellers, products and orders reference them. Deactivate instead.
exports.updateCollege = async (req, res) => {
  if (!isObjectId(req.params.id)) fail("College not found", 404);
  const college = await College.findByIdAndUpdate(req.params.id, { $set: collegeFields(req.body, true) }, { new: true, runValidators: true });
  if (!college) fail("College not found", 404);
  res.json({ success: true, college });
};
