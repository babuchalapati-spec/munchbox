const mongoose = require('mongoose');

// A single application-settings document (only the main admin can edit it).
const settingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'app', unique: true },
    sms: {
      provider: { type: String, default: '' }, // e.g. 'twilio', 'msg91', 'fast2sms'
      apiKey: { type: String, default: '' },
      apiSecret: { type: String, default: '' },
      senderId: { type: String, default: '' },
      enabled: { type: Boolean, default: false },
    },
    // Where shops/partners send their deposit money (UPI) until a payment gateway is wired.
    payments: {
      upiId: { type: String, default: '' }, // e.g. munchbox@okhdfcbank
      payeeName: { type: String, default: 'Munchbox' },
      phone: { type: String, default: '' }, // admin contact for payment queries
      note: { type: String, default: 'Pay by UPI, then submit the reference number. Admin will credit your balance.' },
    },
    // Latest published app build — the app checks this on launch to offer updates.
    app: {
      latestVersionCode: { type: Number, default: 1 },
      latestVersionName: { type: String, default: '1.0' },
      apkUrl: { type: String, default: '' },
      updateMessage: { type: String, default: 'A new version of Munchbox is available.' },
      mandatory: { type: Boolean, default: false },
    },
    partnerApp: {
      latestVersionCode: { type: Number, default: 1 },
      latestVersionName: { type: String, default: '1.0' },
      apkUrl: { type: String, default: '' },
      updateMessage: { type: String, default: 'A new version of Munchbox Partner is available.' },
      mandatory: { type: Boolean, default: false },
    },
    // Tax rate applied to platform commission revenue in the P&L overview.
    finance: {
      taxPercent: { type: Number, default: 0 },
    },
    // Used only by the admin web dashboard's live map (shops, delivery partners,
    // customers) — the mobile apps use OpenStreetMap and need no key.
    maps: {
      googleMapsApiKey: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// Always return the one settings doc, creating it on first access.
settingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ singleton: 'app' });
  if (!doc) doc = await this.create({ singleton: 'app' });
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
