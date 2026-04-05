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
];

exports.categoryValidator = [
  body("name")
    .trim()
    .notEmpty().withMessage("Category name is required")
    .isLength({ max: 100 }).withMessage("Name cannot exceed 100 characters"),
];
