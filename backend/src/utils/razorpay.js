const Razorpay = require('razorpay');
const crypto = require('crypto');
const Settings = require('../models/Settings');

// Admin-entered keys (Settings > Payments) win when present and enabled; otherwise
// fall back to RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars so existing deployments
// keep working without an admin having to re-enter anything.
async function getCredentials() {
  const settings = await Settings.getSingleton();
  const configured = settings.razorpay;
  if (configured?.enabled && configured.keyId && configured.keySecret) {
    return { keyId: configured.keyId, keySecret: configured.keySecret };
  }
  return { keyId: process.env.RAZORPAY_KEY_ID || '', keySecret: process.env.RAZORPAY_KEY_SECRET || '' };
}

async function isConfigured() {
  const { keyId, keySecret } = await getCredentials();
  return Boolean(keyId && keySecret);
}

async function getClient() {
  const { keyId, keySecret } = await getCredentials();
  if (!keyId || !keySecret) {
    const err = new Error('Online payment is not set up yet. Please pay Cash on Delivery.');
    err.statusCode = 503;
    throw err;
  }
  return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
}

// Amount in rupees in, Razorpay order (amount in paise) out.
async function createRazorpayOrder(amountRupees, receipt) {
  const { client } = await getClient();
  return client.orders.create({
    amount: Math.round(amountRupees * 100),
    currency: 'INR',
    receipt,
  });
}

async function fetchRazorpayOrder(orderId) {
  const { client } = await getClient();
  return client.orders.fetch(orderId);
}

// Confirms the payment actually belongs to the order Razorpay says it does, per
// Razorpay's documented checkout signature scheme (HMAC-SHA256 of "orderId|paymentId").
async function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const { keySecret } = await getCredentials();
  if (!keySecret) return false;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

module.exports = { isConfigured, getCredentials, createRazorpayOrder, fetchRazorpayOrder, verifyRazorpaySignature };
