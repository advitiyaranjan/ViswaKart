const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage, IMAGE_TYPES } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) return cb(null, true);
    const error = new Error('Only JPEG, PNG, WebP or GIF images can be uploaded');
    error.statusCode = 400;
    return cb(error);
  },
});

// Only signed-in users (sellers and admins) may upload; anonymous uploads were an open file host.
router.post('/', protect, upload.single('image'), uploadImage);

module.exports = router;
