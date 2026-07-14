const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true, unique: true },
    // 'amount' knocks a fixed rupee amount off the order; 'free_delivery' waives the
    // delivery fee for that order instead (whatever it works out to for that order).
    type: { type: String, enum: ['amount', 'free_delivery'], default: 'amount' },
    amount: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    reason: { type: String, enum: ['welcome_referral', 'referral_bonus', 'loyalty_free_delivery', 'manual'], default: 'manual' },
    status: { type: String, enum: ['active', 'used', 'expired'], default: 'active', index: true },
    usedAt: { type: Date, default: null },
    usedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
