const mongoose = require('mongoose');

const weightOptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    priceDelta: { type: Number, default: 0 },
  },
  { _id: false }
);

// Shop-defined toppings / add-ons (e.g. extra cheese +₹30) shown to customers.
const addOnSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, required: true },
    basePrice: { type: Number, required: true },
    weightOptions: { type: [weightOptionSchema], default: [] },
    addOns: { type: [addOnSchema], default: [] },
    imageUrl: { type: String, default: '' },
    isCustomizable: { type: Boolean, default: false },
    // Veg/non-veg tag — shown as a badge and used to filter restaurant/catering menus.
    // Cakes/bakery items generally leave this at the default (veg).
    isVeg: { type: Boolean, default: true },
    // New items stay hidden until an admin approves them.
    approved: { type: Boolean, default: false },
    // The shop's own in-stock switch — the only thing that decides if customers can order it.
    available: { type: Boolean, default: true },
    // A product is hidden from customers until the admin approves it.
    blocked: { type: Boolean, default: true },
    blockedReason: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
