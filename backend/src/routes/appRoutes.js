const express = require('express');
const Settings = require('../models/Settings');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function getPublicBaseUrl(req) {
  return (process.env.PUBLIC_BASE_URL || process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function withDefaultApkUrl(req, appSettings, fileName) {
  const app = appSettings?.toObject ? appSettings.toObject() : { ...(appSettings || {}) };
  if (!app.apkUrl) {
    app.apkUrl = `${getPublicBaseUrl(req)}/downloads/${fileName}`;
  }
  if (app.apkUrl && !/^https?:\/\//i.test(app.apkUrl)) {
    app.apkUrl = `${getPublicBaseUrl(req)}${app.apkUrl}`;
  }
  return app;
}

function toPlainApp(appSettings) {
  return appSettings?.toObject ? appSettings.toObject() : { ...(appSettings || {}) };
}

// Public: the app calls this on launch to see if a newer build is available.
router.get(
  '/version',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton();
    const type = String(req.query.type || req.query.app || 'customer').toLowerCase();
    const isPartner = ['partner', 'delivery', 'delivery-partner'].includes(type);
    const app = isPartner ? toPlainApp(settings.partnerApp) : withDefaultApkUrl(req, settings.app, 'Munchbox.apk');
    res.json({ app, type: isPartner ? 'partner' : 'customer' });
  })
);

module.exports = router;
