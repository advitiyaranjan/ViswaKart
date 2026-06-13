const mongoose = require("mongoose");
const slugify = require("slugify");

// Authoritative list of supported colleges. College Mode, seller affiliations and product
// associations all reference these documents by _id; names are never copied elsewhere.
const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "College name is required"], trim: true, maxlength: 150 },
    // Stable, human-readable key used by the seed list so re-running it never creates duplicates.
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    city: { type: String, trim: true, default: "", maxlength: 80 },
    state: { type: String, trim: true, default: "", maxlength: 80 },
    country: { type: String, trim: true, default: "India", maxlength: 80 },
    // Verified email domains of the institution (e.g. "iiitm.ac.in"); used for the campus selling rule.
    emailDomains: [{ type: String, lowercase: true, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

collegeSchema.pre("validate", function (next) {
  if (!this.slug && this.name) this.slug = slugify(`${this.name} ${this.city || ""}`, { lower: true, strict: true });
  next();
});

collegeSchema.index({ isActive: 1, name: 1 });
collegeSchema.index({ emailDomains: 1 });

module.exports = mongoose.model("College", collegeSchema);
