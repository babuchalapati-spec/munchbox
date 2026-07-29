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
  const { sms, app, partnerApp, shopApp, adminApp, payments, razorpay, finance, maps, shopAgreement } = req.body;

  if (shopAgreement) {
    if (!settings.shopAgreement) settings.shopAgreement = {};
    if (shopAgreement.commissionPercent !== undefined) settings.shopAgreement.commissionPercent = Number(shopAgreement.commissionPercent);
    if (shopAgreement.termsText !== undefined) settings.shopAgreement.termsText = shopAgreement.termsText;
    if (shopAgreement.depositAmount !== undefined) settings.shopAgreement.depositAmount = Number(shopAgreement.depositAmount);
  }

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

  // The four published apps carry identical update settings, so they're applied by one
  // loop rather than four copies that drift apart when a field is added.
  for (const [key, incoming] of Object.entries({ app, partnerApp, shopApp, adminApp })) {
    if (!incoming) continue;
    if (!settings[key]) settings[key] = {};
    if (incoming.latestVersionCode !== undefined) settings[key].latestVersionCode = Number(incoming.latestVersionCode);
    if (incoming.latestVersionName !== undefined) settings[key].latestVersionName = incoming.latestVersionName;
    if (incoming.apkUrl !== undefined) settings[key].apkUrl = incoming.apkUrl;
    if (incoming.updateMessage !== undefined) settings[key].updateMessage = incoming.updateMessage;
    if (incoming.mandatory !== undefined) settings[key].mandatory = incoming.mandatory === true || incoming.mandatory === 'true';
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

  // Which of the four apps this upload replaces. Anything unrecognised is treated as
  // the customer app, matching how the version endpoint resolves an unknown type.
  const APK_TARGETS = {
    customer: { file: 'Munchbox.apk', settingsKey: 'app' },
    partner: { file: 'MunchboxPartner.apk', settingsKey: 'partnerApp' },
    shop: { file: 'MunchboxShop.apk', settingsKey: 'shopApp' },
    admin: { file: 'MunchboxAdmin.apk', settingsKey: 'adminApp' },
  };
  const target = APK_TARGETS[appType] || APK_TARGETS.customer;
  const targetName = target.file;
  const targetPath = path.join(downloadsDir, targetName);
  fs.copyFileSync(req.file.path, targetPath);
  fs.unlinkSync(req.file.path);

  const settings = await Settings.getSingleton();
  if (!settings[target.settingsKey]) settings[target.settingsKey] = {};
  const targetApp = settings[target.settingsKey];
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
