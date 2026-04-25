const { body } = require("express-validator");

exports.productValidator = [
  body("name")
    .trim()
    .notEmpty().withMessage("Product name is required")
    .isLength({ max: 200 }).withMessage("Name cannot exceed 200 characters"),
  body("description")
    .trim()
    .notEmpty().withMessage("Description is required"),
  body("price")
    .notEmpty().withMessage("Price is required")
    .isFloat({ min: 0 }).withMessage("Price must be a non-negative number"),
  body("category")
    .notEmpty().withMessage("Category is required"),
  body("stock")
    .optional()
    .isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),
  // Require seller contact/location when a non-admin creates product
  body("sellerMobile").custom((val, { req }) => {
    // If admin, allow absent
    if (req.user && req.user.role === 'admin') return true;
    const hasTop = val && String(val).trim() !== "";
    const hasProfile = req.body.sellerProfile && req.body.sellerProfile.mobileNumber && String(req.body.sellerProfile.mobileNumber).trim() !== "";
    if (!hasTop && !hasProfile) throw new Error("Seller mobile number is required");
    return true;
  }),
  body("sellerHostelNumber").custom((val, { req }) => {
    if (req.user && req.user.role === 'admin') return true;
    const hasTop = val && String(val).trim() !== "";
    const hasProfile = req.body.sellerProfile && req.body.sellerProfile.hostelNumber && String(req.body.sellerProfile.hostelNumber).trim() !== "";
    if (!hasTop && !hasProfile) throw new Error("Seller hostel number is required");
    return true;
  }),
  body("sellerRoomNumber").custom((val, { req }) => {
    if (req.user && req.user.role === 'admin') return true;
    const hasTop = val && String(val).trim() !== "";
    const hasProfile = req.body.sellerProfile && req.body.sellerProfile.roomNumber && String(req.body.sellerProfile.roomNumber).trim() !== "";
    if (!hasTop && !hasProfile) throw new Error("Seller room number is required");
    return true;
  }),
];

exports.categoryValidator = [
  body("name")
    .trim()
    .notEmpty().withMessage("Category name is required")
    .isLength({ max: 100 }).withMessage("Name cannot exceed 100 characters"),
];
