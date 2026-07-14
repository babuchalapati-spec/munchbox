const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    isCustom: { type: Boolean, default: false },
    name: { type: String, required: true },
    flavor: { type: String },
    weight: { type: String },
    messageOnCake: { type: String },
    referencePhotoUrl: { type: String },
    notes: { type: String },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const ORDER_STATUSES = [
  'placed',
  'confirmed',
  'baking',
  'ready', // shop has prepared the parcel, waiting for pickup
  'heading_to_shop',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 'shop' = ordered from a shop; 'courier' = point-to-point home pickup/delivery.
    type: { type: String, enum: ['shop', 'courier'], default: 'shop' },
    // Shop and items only apply to shop orders.
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: function () { return this.type === 'shop'; } },
    items: { type: [orderItemSchema], default: [] },
    // Courier orders: where the partner collects the package from.
    pickupAddress: { type: String },
    pickupLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    direction: { type: String, enum: ['incoming', 'outgoing'], default: 'outgoing' },
    packageNote: { type: String },
    // deliveryAddress/deliveryLocation are the drop-off for both order types.
    deliveryAddress: { type: String, required: true },
    phone: { type: String, required: true },
    deliveryLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    deliveryDate: { type: Date, required: true },
    deliverySlot: { type: String },
    status: { type: String, enum: ORDER_STATUSES, default: 'placed' },
    itemsTotal: { type: Number, default: 0 },
    distanceKm: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    couponCode: { type: String, default: '' },
    couponDiscount: { type: Number, default: 0 },
    // Optional tip for the delivery partner, chosen by the customer at checkout —
    // credited to whoever actually delivers the order once it's marked delivered.
    tipAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, default: 'COD' },
    payment: {
      method: { type: String, enum: ['COD', 'online'], default: 'COD' },
      status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
      gatewayOrderId: { type: String, default: '' },
      gatewayPaymentId: { type: String, default: '' },
      paidAt: { type: Date, default: null },
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // 6-digit code the shop shows at handoff; the delivery partner enters it to confirm pickup.
    pickupCode: { type: String },
    pickedUpAt: { type: Date, default: null },
    // 6-digit code the CUSTOMER holds; the delivery partner must enter it at drop-off to
    // prove the parcel reached the right person before the order can be marked delivered.
    deliveryCode: { type: String },
    deliveredAt: { type: Date, default: null },
    currentLocation: { type: locationSchema, default: null },
    locationHistory: { type: [locationSchema], default: [] },
    // Customer rates the shop and the delivery partner separately, once, after delivery.
    rating: {
      shopStars: { type: Number, min: 1, max: 5 },
      shopComment: { type: String, default: '' },
      deliveryStars: { type: Number, min: 1, max: 5 },
      deliveryComment: { type: String, default: '' },
      ratedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
