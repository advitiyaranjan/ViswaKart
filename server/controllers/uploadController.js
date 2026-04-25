const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let cloudinary;
if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
  // cloudinary is optional; will be required only when env is present
  cloudinary = require('cloudinary').v2;
  // If CLOUDINARY_URL is provided, parse it (format: cloudinary://key:secret@cloudname)
  if (process.env.CLOUDINARY_URL) {
    const m = process.env.CLOUDINARY_URL.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (m) {
      cloudinary.config({ cloud_name: m[3], api_key: m[1], api_secret: m[2], secure: true });
    } else {
      // fallback to individual env vars
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

// POST /api/uploads
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const buffer = req.file.buffer;

    if (cloudinary) {
      // upload using base64 data URI to avoid extra deps
      const dataUri = `data:${req.file.mimetype};base64,${buffer.toString('base64')}`;
      const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'ecommerce';
      try {
        const result = await cloudinary.uploader.upload(dataUri, { folder, resource_type: 'image' });
        return res.status(200).json({ success: true, url: result.secure_url });
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Cloud upload failed', error: err.message || err });
      }
    }

    // local fallback: save to server/public/uploads
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const ext = (req.file.originalname || '').split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);

    const base = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${base}/uploads/${filename}`;
    return res.status(200).json({ success: true, url });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Upload error', error: err.message });
  }
};
