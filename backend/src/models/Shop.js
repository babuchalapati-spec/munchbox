const mongoose = require('mongoose');

const SHOP_CATEGORIES = ['cake', 'restaurant', 'catering'];

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, enum: SHOP_CATEGORIES, default: 'cake' },
    description: { type: String, default: '' },
    address: { type: String, default: '' },
    // Shop pickup location, used as the origin for distance-based delivery pricing.
    // Invalid coordinates produce absurd distances/fees, so the range is enforced here.
    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },
    // Flat per-kilometre delivery rate (in rupees) from this shop to the customer.
    perKmRate: { type: Number, required: true, default: 12 },
    imageUrl: { type: String, default: '' },
    available: { type: Boolean, default: true },
    // Indian food-business compliance — optional at registration (some categories,
    // like courier-only shops, may not need FSSAI), verified by the admin later.
    gstNumber: { type: String, default: '' },
    fssaiNumber: { type: String, default: '' },
    fssaiCertificateUrl: { type: String, default: '' },
    labourLicenseNumber: { type: String, default: '' },
    labourCertificateUrl: { type: String, default: '' },
    // Up to 3 storefront photos shown on the shop's listing/detail page.
    images: { type: [String], default: [] },
    // Running average from customer order ratings (see Order.rating.shopStars).
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },

    // Subscription: a shop can operate only while its subscription is active and unexpired.
    subscription: {
      active: { type: Boolean, default: true },
      plan: { type: String, default: 'trial' },
      endsAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    },

    // One-time activation deposit, set per shop at admin's discretion when approving
    // the shop account. While required-and-unpaid, the shop stays hidden from
    // customers even if `available` gets toggled true elsewhere.
    deposit: {
      required: { type: Boolean, default: false },
      amount: { type: Number, default: 0 },
      paid: { type: Boolean, default: false },
    },

    // Sent automatically when the admin approves the shop (see reviewShopAccount). A
    // signed agreement waives the activation deposit above; an unsigned one means the
    // deposit stays the only way in. `commissionPercent`/`termsText` are a snapshot of
    // Settings.shopAgreement at send time, so a later template edit doesn't rewrite
    // terms someone already agreed to.
    agreement: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      commissionPercent: { type: Number, default: 0 },
      termsText: { type: String, default: '' },
      signed: { type: Boolean, default: false },
      signedAt: { type: Date },
      signedName: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// A shop is operational only while subscription.active AND endsAt is in the future.
shopSchema.methods.isSubscriptionActive = function () {
  return Boolean(this.subscription?.active && this.subscription?.endsAt && this.subscription.endsAt > new Date());
};

module.exports = mongoose.model('Shop', shopSchema);
module.exports.SHOP_CATEGORIES = SHOP_CATEGORIES;
