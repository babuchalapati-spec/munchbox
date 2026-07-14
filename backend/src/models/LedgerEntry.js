const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerRole: { type: String, enum: ['shop', 'delivery'], required: true },
    kind: {
      type: String,
      enum: ['deposit', 'advance', 'settlement', 'payout', 'adjustment', 'refund', 'commission', 'tip'],
      default: 'deposit',
    },
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true, default: 0 },
    balanceAfter: { type: Number, required: true, default: 0 },
    description: { type: String, required: true, default: '' },
    status: { type: String, enum: ['pending', 'posted'], default: 'posted' },
    referenceType: { type: String, default: null },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
