const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const name = (file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  const allowedExt = /\.(jpe?g|png|webp|heic|heif|pdf|apk)$/;
  const allowedMime = /^(image\/(jpeg|jpg|png|webp|heic|heif)|application\/pdf|application\/vnd\.android\.package-archive)$/;
  const extOk = allowedExt.test(name);
  const mimeOk = allowedMime.test(mime);
  if (extOk && mimeOk) return cb(null, true);
  cb(new Error('Only image/PDF/APK files are allowed'));
}

const upload = multer({
  storage,
  fileFilter,
  // APKs (debug builds especially, being unminified) run well past image/PDF sizes.
  limits: { fileSize: 200 * 1024 * 1024 },
});

module.exports = upload;
