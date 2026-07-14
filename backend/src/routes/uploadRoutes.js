const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/', protect, (req, res) => {
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload failed' });
    }

    const uploaded = req.files?.image?.[0] || req.files?.file?.[0];
    if (!uploaded) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    res.status(201).json({ url: `/uploads/${uploaded.filename}` });
  });
});

module.exports = router;
