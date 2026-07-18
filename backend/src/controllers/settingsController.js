const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');
const Settings = require('../models/Settings');
const { callProvider } = require('../utils/sms');

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
  const { sms, app, partnerApp, shopApp, payments, razorpay, finance, maps } = req.body;

  if (payments) {
    if (!settings.payments) settings.payments = {};
    if (payments.upiId !== undefined) settings.payments.upiId = payments.upiId;
    if (payments.payeeName !== undefined) settings.payments.payeeName = payments.payeeName;
    if (payments.phone !== undefined) settings.payments.phone = payments.phone;
    if (payments.note !== undefined) settings.payments.note = payments.note;
  }

  if (razorpay) {
    if (!settings.razorpay) settings.razorpay = {};
    if (razorpay.keyId !== undefined) settings.razorpay.keyId = razorpay.keyId;
    if (razorpay.keySecret !== undefined) settings.razorpay.keySecret = razorpay.keySecret;
    if (razorpay.enabled !== undefined) settings.razorpay.enabled = razorpay.enabled === true || razorpay.enabled === 'true';
  }

  if (sms) {
    if (sms.provider !== undefined) settings.sms.provider = sms.provider;
    if (sms.apiKey !== undefined) settings.sms.apiKey = sms.apiKey;
    if (sms.apiSecret !== undefined) settings.sms.apiSecret = sms.apiSecret;
    if (sms.senderId !== undefined) settings.sms.senderId = sms.senderId;
    if (sms.dltEntityId !== undefined) settings.sms.dltEntityId = sms.dltEntityId;
    if (sms.dltTemplateId !== undefined) settings.sms.dltTemplateId = sms.dltTemplateId;
    if (sms.otpMessageTemplate !== undefined) settings.sms.otpMessageTemplate = sms.otpMessageTemplate;
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

  if (shopApp) {
    if (!settings.shopApp) settings.shopApp = {};
    if (shopApp.latestVersionCode !== undefined) settings.shopApp.latestVersionCode = Number(shopApp.latestVersionCode);
    if (shopApp.latestVersionName !== undefined) settings.shopApp.latestVersionName = shopApp.latestVersionName;
    if (shopApp.apkUrl !== undefined) settings.shopApp.apkUrl = shopApp.apkUrl;
    if (shopApp.updateMessage !== undefined) settings.shopApp.updateMessage = shopApp.updateMessage;
    if (shopApp.mandatory !== undefined) settings.shopApp.mandatory = shopApp.mandatory === true || shopApp.mandatory === 'true';
  }

  if (finance) {
    if (!settings.finance) settings.finance = {};
    if (finance.taxPercent !== undefined) settings.finance.taxPercent = Number(finance.taxPercent) || 0;
  }

  if (maps) {
    if (!settings.maps) settings.maps = {};
    if (maps.googleMapsApiKey !== undefined) settings.maps.googleMapsApiKey = maps.googleMapsApiKey;
  }

  await settings.save();
  res.json({ settings });
}

// Sends one real SMS using whatever provider/key/sender is passed in — NOT necessarily
// what's already saved, so the admin can test a key before committing to it (and catch
// a typo'd key or wrong sender ID immediately instead of only discovering it when a
// real customer's OTP silently fails to arrive).
async function testSms(req, res) {
  if (!req.user?.role || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can send a test SMS' });
  }
  const { phone, provider, apiKey, apiSecret, senderId, dltEntityId, dltTemplateId, otpMessageTemplate } = req.body;
  if (!phone) return res.status(400).json({ message: 'Enter a phone number to send the test SMS to' });
  if (!provider || !apiKey) return res.status(400).json({ message: 'Choose a provider and enter an API key first' });

  // Send the real OTP template (with a sample code) rather than a generic test string —
  // for DLT routes, a generic string would always fail regardless of whether the actual
  // configured template is correct, making the test useless for catching template mismatches.
  const template = (otpMessageTemplate || '').trim() || 'Your Munchbox OTP is {otp}. Valid for 5 minutes.';
  const testMessage = template.replace(/\{otp\}/g, '123456');

  try {
    await callProvider({ provider, apiKey, apiSecret, senderId, dltEntityId, dltTemplateId }, phone, testMessage);
    res.json({ sent: true, message: `Test SMS sent to ${phone}. Check that phone for the message.` });
  } catch (err) {
    res.status(400).json({ sent: false, message: err.message || 'Could not send the test SMS' });
  }
}

// Creates a real ₹1 test order against Razorpay using whatever keys are passed in —
// NOT necessarily what's already saved, same "test before you commit" pattern as
// testSms, so a typo'd key is caught here instead of at a real customer's checkout.
async function testRazorpay(req, res) {
  if (!req.user?.role || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can test the payment gateway' });
  }
  const { keyId, keySecret } = req.body;
  if (!keyId || !keySecret) {
    return res.status(400).json({ message: 'Enter both the Key ID and Key Secret first' });
  }
  try {
    const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await client.orders.create({ amount: 100, currency: 'INR', receipt: `mb_test_${Date.now()}` });
    res.json({ ok: true, message: `Connected to Razorpay successfully (test order ${order.id} created).` });
  } catch (err) {
    const message = err?.error?.description || err.message || 'Could not connect to Razorpay with these keys';
    res.status(400).json({ ok: false, message });
  }
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

  const targetName = appType === 'partner' ? 'MunchboxPartner.apk' : appType === 'shop' ? 'MunchboxShop.apk' : 'Munchbox.apk';
  const targetPath = path.join(downloadsDir, targetName);
  fs.copyFileSync(req.file.path, targetPath);
  fs.unlinkSync(req.file.path);

  const settings = await Settings.getSingleton();
  const targetApp = appType === 'partner' ? settings.partnerApp : appType === 'shop' ? settings.shopApp : settings.app;
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
    targetApp.mandatory = mandatory === true || mandatory === 'true';
  }

  await settings.save();
  res.json({ settings, apkUrl: targetApp.apkUrl, fileName: targetName });
}

module.exports = { getSettings, getPaymentInfo, updateSettings, publishApk, testSms, testRazorpay };
