const mongoose = require('mongoose');

// A payment attempt that never became an order — the customer's money either never
// left their account or Razorpay reports a failure. Kept separate from Order because
// no order exists yet at this point; this is what lets the admin see and follow up on
// "customer tried to pay and it didn't work" instead of it silently disappearing.
const paymentFailureSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    reason: { type: String, default: '' },
    gatewayOrderId: { type: String, default: '' },
    gatewayPaymentId: { type: String, default: '' },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentFailure', paymentFailureSchema);
