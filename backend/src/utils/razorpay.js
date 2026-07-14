const Razorpay = require('razorpay');
const crypto = require('crypto');

function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function getClient() {
  if (!isConfigured()) {
    const err = new Error('Online payment is not set up yet. Please pay Cash on Delivery.');
    err.statusCode = 503;
    throw err;
  }
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

// Amount in rupees in, Razorpay order (amount in paise) out.
async function createRazorpayOrder(amountRupees, receipt) {
  const client = getClient();
  return client.orders.create({
    amount: Math.round(amountRupees * 100),
    currency: 'INR',
    receipt,
  });
}

async function fetchRazorpayOrder(orderId) {
  const client = getClient();
  return client.orders.fetch(orderId);
}

// Confirms the payment actually belongs to the order Razorpay says it does, per
// Razorpay's documented checkout signature scheme (HMAC-SHA256 of "orderId|paymentId").
function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!isConfigured() || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

module.exports = { isConfigured, createRazorpayOrder, fetchRazorpayOrder, verifyRazorpaySignature };
