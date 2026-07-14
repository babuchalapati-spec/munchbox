const mongoose = require('mongoose');

const cateringItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const CATERING_STATUSES = ['requested', 'quoted', 'accepted', 'rejected', 'cancelled'];

const cateringRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    items: { type: [cateringItemSchema], required: true },
    headcount: { type: Number, required: true },
    eventDate: { type: Date, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    notes: { type: String },

    // Auto-computed from item unitPrice × quantity — a starting estimate for the caterer.
    estimatedTotal: { type: Number, required: true },

    // Set by the caterer/admin when quoting. quotedTotal is the final price after any discount.
    discount: { type: Number, default: 0 },
    quotedTotal: { type: Number, default: null },
    ownerNote: { type: String },

    status: { type: String, enum: CATERING_STATUSES, default: 'requested' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CateringRequest', cateringRequestSchema);
module.exports.CATERING_STATUSES = CATERING_STATUSES;
