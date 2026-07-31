const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    role: { type: String, enum: ['customer', 'admin', 'delivery', 'shop'], default: 'customer' },
    referralCode: { type: String, uppercase: true, trim: true, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // For shop-owner accounts (role 'shop'): the shop they manage.
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
    // Account approval gate. Self-registered shops start 'pending' and cannot log in
    // until an admin approves them. Other roles default to 'active'.
    status: { type: String, enum: ['active', 'pending', 'rejected'], default: 'active' },
    approvalReason: { type: String, default: '' },
    // Two-factor auth (TOTP — works with Microsoft Authenticator / Google Authenticator).
    // Opt-in per shop: an admin must grant `allowed` before an owner can arm it.
    twoFactor: {
      allowed: { type: Boolean, default: false },
      enabled: { type: Boolean, default: false },
      secret: { type: String, default: '' }, // active secret once confirmed
      pendingSecret: { type: String, default: '' }, // secret awaiting first-code confirmation
    },
    // Running average from customer order ratings (delivery partners only).
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    // Delivery partner's preferred work area (home base + radius) — a fallback for
    // "nearby deliveries" when live GPS isn't available, and lets a partner keep seeing
    // orders around where they usually work even before they've moved from home.
    workArea: {
      lat: { type: Number },
      lng: { type: Number },
      radiusKm: { type: Number, default: 5 },
      updatedAt: { type: Date },
    },
    // KYC for delivery partners: document photos + verification status.
    kyc: {
      status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
      photoUrl: { type: String, default: '' }, // photo of the person
      aadhaarUrl: { type: String, default: '' }, // address / ID proof
      licenseUrl: { type: String, default: '' }, // driving license
      rcUrl: { type: String, default: '' }, // bike RC book
      vehicleNumber: { type: String, default: '' },
      vehicleType: { type: String, enum: ['motorcycle', 'ev', 'bicycle', 'other'], default: 'motorcycle' },
      rejectionReason: { type: String, default: '' },
      submittedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
