const fs = require('fs');
const path = require('path');
const Settings = require('../models/Settings');

async function getSettings(req, res) {
  const settings = await Settings.getSingleton();
  res.json({ settings });
}

// Payment details a shop/partner needs to top up their balance (UPI id, payee, contact).
// Readable by any logged-in user; no secrets are exposed.
async function getPaymentInfo(req, res) {
  const settings = await Settings.getSingleton();
  const p = settings.payments || {};
  res.json({
    payments: {
      upiId: p.upiId || '',
      payeeName: p.payeeName || 'Munchbox',
      phone: p.phone || '',
      note: p.note || '',
    },
  });
}

async function updateSettings(req, res) {
  const settings = await Settings.getSingleton();
  const { sms, app, partnerApp, payments, finance } = req.body;

  if (payments) {
    if (!settings.payments) settings.payments = {};
    if (payments.upiId !== undefined) settings.payments.upiId = payments.upiId;
    if (payments.payeeName !== undefined) settings.payments.payeeName = payments.payeeName;
    if (payments.phone !== undefined) settings.payments.phone = payments.phone;
    if (payments.note !== undefined) settings.payments.note = payments.note;
  }

  if (sms) {
    if (sms.provider !== undefined) settings.sms.provider = sms.provider;
    if (sms.apiKey !== undefined) settings.sms.apiKey = sms.apiKey;
    if (sms.apiSecret !== undefined) settings.sms.apiSecret = sms.apiSecret;
    if (sms.senderId !== undefined) settings.sms.senderId = sms.senderId;
    if (sms.enabled !== undefined) settings.sms.enabled = sms.enabled === true || sms.enabled === 'true';
  }

  if (app) {
    if (app.latestVersionCode !== undefined) settings.app.latestVersionCode = Number(app.latestVersionCode);
    if (app.latestVersionName !== undefined) settings.app.latestVersionName = app.latestVersionName;
    if (app.apkUrl !== undefined) settings.app.apkUrl = app.apkUrl;
    if (app.updateMessage !== undefined) settings.app.updateMessage = app.updateMessage;
    if (app.mandatory !== undefined) settings.app.mandatory = app.mandatory === true || app.mandatory === 'true';
  }

  if (partnerApp) {
    if (!settings.partnerApp) settings.partnerApp = {};
    if (partnerApp.latestVersionCode !== undefined) settings.partnerApp.latestVersionCode = Number(partnerApp.latestVersionCode);
    if (partnerApp.latestVersionName !== undefined) settings.partnerApp.latestVersionName = partnerApp.latestVersionName;
    if (partnerApp.apkUrl !== undefined) settings.partnerApp.apkUrl = partnerApp.apkUrl;
    if (partnerApp.updateMessage !== undefined) settings.partnerApp.updateMessage = partnerApp.updateMessage;
    if (partnerApp.mandatory !== undefined) settings.partnerApp.mandatory = partnerApp.mandatory === true || partnerApp.mandatory === 'true';
  }

  if (finance) {
    if (!settings.finance) settings.finance = {};
    if (finance.taxPercent !== undefined) settings.finance.taxPercent = Number(finance.taxPercent) || 0;
  }

  await settings.save();
  res.json({ settings });
}

function getPublicBaseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL || process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
  return String(configured).replace(/\/$/, '');
}

async function publishApk(req, res) {
  if (!req.user?.role || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can publish APKs' });
  }

  const { appType = 'customer', versionCode, versionName, updateMessage, mandatory } = req.body;
  if (!req.file) {
    return res.status(400).json({ message: 'APK file is required' });
  }

  const downloadsDir = path.join(__dirname, '..', '..', 'downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  const targetName = appType === 'partner' ? 'MunchboxPartner.apk' : 'Munchbox.apk';
  const targetPath = path.join(downloadsDir, targetName);
  fs.copyFileSync(req.file.path, targetPath);
  fs.unlinkSync(req.file.path);

  const settings = await Settings.getSingleton();
  const targetApp = appType === 'partner' ? settings.partnerApp : settings.app;
  if (targetApp) {
    const currentVersionCode = Number(targetApp.latestVersionCode || 1);
    const requestedVersionCode = Number(versionCode);
    const nextVersionCode = Number.isFinite(requestedVersionCode) && requestedVersionCode > currentVersionCode
      ? requestedVersionCode
      : currentVersionCode + 1;

    targetApp.latestVersionCode = nextVersionCode;
    targetApp.latestVersionName = versionName || targetApp.latestVersionName || '1.0';
    const publicBaseUrl = getPublicBaseUrl(req).replace(/\/$/, '');
    targetApp.apkUrl = `${publicBaseUrl}/downloads/${targetName}`;
    targetApp.updateMessage = updateMessage || targetApp.updateMessage || 'A new version is available.';
    targetApp.mandatory = mandatory === true || mandatory === 'true' || targetApp.mandatory === true;
  }

  await settings.save();
  res.json({ settings, apkUrl: targetApp.apkUrl, fileName: targetName });
}

module.exports = { getSettings, getPaymentInfo, updateSettings, publishApk };
