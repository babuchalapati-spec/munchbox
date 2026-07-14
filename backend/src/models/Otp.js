const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    code: { type: String, required: true },
    name: { type: String },
    referralCode: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-remove expired OTPs.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);
