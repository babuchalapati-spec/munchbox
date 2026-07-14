const mongoose = require('mongoose');

const referralTicketSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referred: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredPhone: { type: String, default: '' },
    status: { type: String, enum: ['pending_order', 'completed'], default: 'pending_order', index: true },
    firstOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    rewardCoupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

referralTicketSchema.index({ referrer: 1, referred: 1 }, { unique: true });

module.exports = mongoose.model('ReferralTicket', referralTicketSchema);
