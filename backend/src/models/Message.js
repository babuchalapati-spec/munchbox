const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    // 'customer' = customer <-> delivery thread; 'pickup' = shop <-> delivery thread (admin monitors both).
    channel: { type: String, enum: ['customer', 'pickup'], default: 'customer' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['customer', 'admin', 'delivery', 'shop'], required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

messageSchema.index({ order: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
