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

// The four published apps, each built from one Android product flavor. `settingsKey` is
// where an admin-set version/APK URL for that app lives; `file` is the APK the build
// script drops into backend/downloads, used when nothing is set in Settings.
const APPS = {
  customer: {aliases: ['customer', 'user'], settingsKey: 'app', file: 'Munchbox.apk', label: 'Munchbox'},
  partner: {
    aliases: ['partner', 'delivery', 'delivery-partner'],
    settingsKey: 'partnerApp',
    file: 'MunchboxPartner.apk',
    label: 'Munchbox Partner',
  },
  shop: {aliases: ['shop', 'shop-owner'], settingsKey: 'shopApp', file: 'MunchboxShop.apk', label: 'Munchbox Shop'},
  admin: {aliases: ['admin'], settingsKey: 'adminApp', file: 'MunchboxAdmin.apk', label: 'Munchbox Admin'},
};

function resolveAppType(raw) {
  const type = String(raw || 'customer').toLowerCase();
  const match = Object.keys(APPS).find((key) => APPS[key].aliases.includes(type));
  return match || 'customer';
}

// Public: the app calls this on launch to see if a newer build is available.
router.get(
  '/version',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton();
    const type = resolveAppType(req.query.type || req.query.app);
    const {settingsKey, file} = APPS[type];
    res.json({ app: withDefaultApkUrl(req, settings[settingsKey], file), type });
  })
);

// Public: everything the download page needs to list all four apps at once, so the page
// doesn't have to know the APK filenames or make four version calls.
router.get(
  '/downloads',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton();
    res.json({
      apps: Object.keys(APPS).map((type) => ({
        type,
        label: APPS[type].label,
        ...withDefaultApkUrl(req, settings[APPS[type].settingsKey], APPS[type].file),
      })),
    });
  })
);

module.exports = router;
