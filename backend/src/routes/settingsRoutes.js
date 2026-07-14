const express = require('express');
const { getSettings, getPaymentInfo, updateSettings, publishApk } = require('../controllers/settingsController');
const { protect, adminOnly } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const upload = require('../middleware/upload');

const router = express.Router();

// Only the main admin can view or change application settings (e.g. SMS API).
router.get('/payment-info', protect, asyncHandler(getPaymentInfo));
router.get('/', protect, adminOnly, asyncHandler(getSettings));
router.put('/', protect, adminOnly, asyncHandler(updateSettings));
router.post('/publish-apk', protect, adminOnly, upload.single('apk'), asyncHandler(publishApk));

module.exports = router;
