const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Coupon = require('../models/Coupon');
const ReferralTicket = require('../models/ReferralTicket');
const LedgerEntry = require('../models/LedgerEntry');
const { computeDeliveryFee, haversineKm, getEta } = require('../utils/distance');
const { ORDER_STATUSES } = Order;

const MIN_WALLET_BALANCE = 500;
// No sane food delivery goes beyond this; anything further means a bad location.
const MAX_DELIVERY_KM = 60;

const AVAILABLE_STATUSES = ['placed', 'confirmed', 'baking', 'ready'];

// A delivery partner's wallet must stay at or above this to accept new deliveries —
// same pattern as the shop's MIN_WALLET_BALANCE, scaled to a partner's smaller float.
const DELIVERY_MIN_WALLET_BALANCE = 80;
// Flat platform commission per completed delivery, and the minimum a partner is
// charged on any day they deliver at least one order (see chargeDeliveryCommission).
const DELIVERY_COMMISSION_PER_ORDER = 15;
const DELIVERY_DAILY_FLOOR = 30;
// Preset tip amounts a customer can choose for the delivery partner at checkout.
const TIP_OPTIONS = [0, 10, 20, 30, 50];

// Shop's platform commission per order, tiered by order value.
function shopCommission(totalAmount) {
  if (totalAmount < 150) return 15;
  if (totalAmount <= 500) return 25;
  return 50;
}

// Origin point a partner would drive to first: the shop (shop orders) or the pickup (courier).
function pickupPointOf(order) {
  if (order.type === 'courier') return order.pickupLocation;
  return order.shop && order.shop.location;
}

// Nearby unassigned deliveries the partner can claim, sorted by distance to the pickup.
async function listAvailableOrders(req, res) {
  if (req.user.kyc && req.user.kyc.status !== 'verified') {
    return res.status(403).json({ message: 'Your account must be verified before you can pick deliveries.', kyc: req.user.kyc.status });
  }
  const balance = await getLedgerBalance(req.user._id);
  if (balance < DELIVERY_MIN_WALLET_BALANCE) {
    return res.status(403).json({
      message: `Your wallet balance is below ₹${DELIVERY_MIN_WALLET_BALANCE}. Top up to keep accepting deliveries.`,
      lowBalance: true,
    });
  }
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const here = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  const orders = await Order.find({ assignedTo: null, status: { $in: AVAILABLE_STATUSES } })
    .populate('shop', 'name location address')
    .sort({ createdAt: -1 });

  const withDistance = orders.map((o) => {
    const p = pickupPointOf(o);
    const distanceToPickup = here && p ? Math.round(haversineKm(here, p) * 100) / 100 : null;
    return { order: o, distanceToPickup };
  });

  if (here) {
    withDistance.sort((a, b) => {
      if (a.distanceToPickup == null) return 1;
      if (b.distanceToPickup == null) return -1;
      return a.distanceToPickup - b.distanceToPickup;
    });
  }

  res.json({
    available: withDistance.map(({ order, distanceToPickup }) => ({ ...order.toObject(), distanceToPickup })),
  });
}

// Partner claims an unassigned delivery for themselves.
async function claimOrder(req, res) {
  if (req.user.kyc && req.user.kyc.status !== 'verified') {
    return res.status(403).json({ message: 'Your account must be verified before you can pick deliveries.' });
  }
  const balance = await getLedgerBalance(req.user._id);
  if (balance < DELIVERY_MIN_WALLET_BALANCE) {
    return res.status(403).json({
      message: `Your wallet balance is below ₹${DELIVERY_MIN_WALLET_BALANCE}. Top up to keep accepting deliveries.`,
      lowBalance: true,
    });
  }
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.assignedTo) {
    return res.status(409).json({ message: 'This delivery was just taken by someone else.' });
  }
  order.assignedTo = req.user._id;
  await order.save();
  await order.populate('user', 'name email phone');
  await order.populate('shop', 'name location address');
  res.json({ order });
}

const CUSTOMIZATION_LEAD_DAYS = 1;
const COURIER_PER_KM = 15; // flat per-km rate for point-to-point home pickups

// Point-to-point courier order: pickup from A, drop at B. No shop or items.
async function placeCourierOrder(req, res) {
  const { pickupAddress, pickupLocation, deliveryAddress, deliveryLocation, direction, packageNote, phone, deliveryDate } =
    req.body;

  if (!pickupAddress || !pickupLocation || typeof pickupLocation.lat !== 'number' || typeof pickupLocation.lng !== 'number') {
    return res.status(400).json({ message: 'pickupAddress and pickupLocation {lat,lng} are required' });
  }
  if (!deliveryAddress || !deliveryLocation || typeof deliveryLocation.lat !== 'number' || typeof deliveryLocation.lng !== 'number') {
    return res.status(400).json({ message: 'deliveryAddress and deliveryLocation {lat,lng} are required' });
  }
  if (!phone) return res.status(400).json({ message: 'phone is required' });

  const { distanceKm, deliveryFee } = await computeDeliveryFee(pickupLocation, deliveryLocation, COURIER_PER_KM);
  const pickupCode = String(Math.floor(100000 + Math.random() * 900000));
  const deliveryCode = String(Math.floor(100000 + Math.random() * 900000));

  const order = await Order.create({
    user: req.user._id,
    type: 'courier',
    direction: direction === 'incoming' ? 'incoming' : 'outgoing',
    packageNote,
    pickupAddress,
    pickupLocation,
    deliveryAddress,
    deliveryLocation,
    phone,
    deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
    itemsTotal: 0,
    distanceKm,
    deliveryFee,
    totalAmount: deliveryFee,
    pickupCode,
    deliveryCode,
  });

  res.status(201).json({ order });
}

// Quote a courier fee without placing the order.
async function courierQuote(req, res) {
  const { pickupLocation, deliveryLocation } = req.body;
  if (!pickupLocation || !deliveryLocation || typeof pickupLocation.lat !== 'number' || typeof deliveryLocation.lat !== 'number') {
    return res.status(400).json({ message: 'pickupLocation and deliveryLocation are required' });
  }
  const { distanceKm, deliveryFee } = await computeDeliveryFee(pickupLocation, deliveryLocation, COURIER_PER_KM);
  res.json({ distanceKm, deliveryFee, perKmRate: COURIER_PER_KM });
}

async function listMyCoupons(req, res) {
  const coupons = await Coupon.find({
    user: req.user._id,
    status: 'active',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).sort({ createdAt: -1 });
  res.json({ coupons });
}

async function resolveCoupon(userId, couponCode, orderAmount) {
  const code = String(couponCode || '').trim().toUpperCase();
  if (!code) return { coupon: null, discount: 0 };

  const coupon = await Coupon.findOne({ user: userId, code });
  if (!coupon) {
    const err = new Error('Coupon not found for this account');
    err.statusCode = 400;
    throw err;
  }
  if (coupon.status !== 'active') {
    const err = new Error('Coupon is not active');
    err.statusCode = 400;
    throw err;
  }
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    coupon.status = 'expired';
    await coupon.save();
    const err = new Error('Coupon has expired');
    err.statusCode = 400;
    throw err;
  }
  if (orderAmount < coupon.minOrderAmount) {
    const err = new Error(`Coupon requires an order of at least ₹${coupon.minOrderAmount}`);
    err.statusCode = 400;
    throw err;
  }
  return { coupon, discount: Math.min(coupon.amount, orderAmount) };
}

async function rewardReferralIfFirstOrder(userId, orderId) {
  const ticket = await ReferralTicket.findOne({ referred: userId, status: 'pending_order' });
  if (!ticket) return;

  const previousOrders = await Order.countDocuments({ user: userId, _id: { $ne: orderId }, type: 'shop' });
  if (previousOrders > 0) return;

  let rewardCoupon = null;
  for (let i = 0; i < 5; i += 1) {
    try {
      rewardCoupon = await Coupon.create({
        user: ticket.referrer,
        code: `BONUS${Math.floor(100000 + Math.random() * 900000)}`,
        amount: 100,
        minOrderAmount: 299,
        reason: 'referral_bonus',
      });
      break;
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  ticket.status = 'completed';
  ticket.firstOrder = orderId;
  ticket.rewardCoupon = rewardCoupon?._id || null;
  ticket.completedAt = new Date();
  await ticket.save();
}

function isCustomizedItem(item) {
  return Boolean(item.isCustom || item.flavor || item.messageOnCake || item.referencePhotoUrl);
}

// Number of whole calendar days (UTC) from today until the given date.
// Positive means the date is in the future.
function calendarDaysFromToday(date) {
  const startOfDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((startOfDay(date) - startOfDay(new Date())) / (24 * 60 * 60 * 1000));
}

async function getLedgerBalance(ownerId) {
  const entries = await LedgerEntry.find({ owner: ownerId }).sort({ createdAt: -1 }).lean();
  return entries.reduce((total, entry) => {
    if (entry.direction === 'credit') return total + Number(entry.amount || 0);
    return total - Number(entry.amount || 0);
  }, 0);
}

// The running-balance snapshot to store on a new ledger entry, computed from that
// owner's last posted entry — keeps the ledger's balanceAfter column trustworthy
// per owner instead of a placeholder.
async function nextBalanceAfter(ownerId, amount, direction) {
  const last = await LedgerEntry.findOne({ owner: ownerId, status: 'posted' }).sort({ createdAt: -1 });
  const delta = direction === 'credit' ? amount : -amount;
  return Number(((last?.balanceAfter || 0) + delta).toFixed(2));
}

async function placeOrder(req, res) {
  const { shop: shopId, items, deliveryAddress, phone, deliveryLocation, deliveryDate, deliverySlot, paymentMethod, couponCode, tip } =
    req.body;

  const tipAmount = tip === undefined ? 0 : Number(tip);
  if (!TIP_OPTIONS.includes(tipAmount)) {
    return res.status(400).json({ message: `tip must be one of: ${TIP_OPTIONS.join(', ')}` });
  }

  if (!shopId) {
    return res.status(400).json({ message: 'shop is required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must include at least one item' });
  }
  if (!deliveryAddress || !phone) {
    return res.status(400).json({ message: 'deliveryAddress and phone are required' });
  }
  if (
    !deliveryLocation ||
    typeof deliveryLocation.lat !== 'number' ||
    typeof deliveryLocation.lng !== 'number'
  ) {
    return res.status(400).json({ message: 'deliveryLocation {lat, lng} is required for delivery pricing' });
  }
  if (!deliveryDate) {
    return res.status(400).json({ message: 'deliveryDate is required' });
  }
  const parsedDeliveryDate = new Date(deliveryDate);
  if (Number.isNaN(parsedDeliveryDate.getTime())) {
    return res.status(400).json({ message: 'deliveryDate is invalid' });
  }

  const shop = await Shop.findById(shopId);
  if (!shop) {
    return res.status(400).json({ message: 'Shop not found' });
  }
  if (!shop.isSubscriptionActive()) {
    return res.status(400).json({ message: 'This shop is not currently accepting orders.' });
  }

  const shopOwner = await User.findOne({ role: 'shop', shop: shop._id });
  if (shopOwner) {
    const balance = await getLedgerBalance(shopOwner._id);
    if (balance < MIN_WALLET_BALANCE) {
      // The shop's wallet is an internal matter — never expose it to the customer.
      // They just see that the shop isn't taking orders right now.
      return res.status(409).json({
        message: 'This shop is not accepting orders right now. Please try another shop.',
        shopUnavailable: true,
      });
    }
  }

  const needsLeadTime = items.some(isCustomizedItem);
  const minLeadDays = needsLeadTime ? CUSTOMIZATION_LEAD_DAYS : 0;
  if (calendarDaysFromToday(parsedDeliveryDate) < minLeadDays) {
    return res.status(400).json({
      message: needsLeadTime
        ? `Customized cakes need at least ${CUSTOMIZATION_LEAD_DAYS} day(s) advance notice. Please choose a later delivery date.`
        : 'deliveryDate cannot be in the past',
    });
  }

  const resolvedItems = [];
  let itemsTotal = 0;

  for (const item of items) {
    if (item.isCustom) {
      const price = Number(item.price) || 0;
      const quantity = item.quantity || 1;
      resolvedItems.push({
        isCustom: true,
        name: item.name || 'Custom cake',
        flavor: item.flavor,
        weight: item.weight,
        messageOnCake: item.messageOnCake,
        referencePhotoUrl: item.referencePhotoUrl,
        notes: item.notes,
        quantity,
        price,
      });
      itemsTotal += price * quantity;
      continue;
    }

    const product = await Product.findById(item.product);
    if (!product) {
      return res.status(400).json({ message: `Product not found: ${item.product}` });
    }
    if (product.shop.toString() !== shopId.toString()) {
      return res.status(400).json({ message: 'All items in an order must be from the same shop' });
    }

    const weightDelta = item.weight
      ? (product.weightOptions.find((w) => w.label === item.weight) || {}).priceDelta || 0
      : 0;
    const price = product.basePrice + weightDelta;
    const quantity = item.quantity || 1;

    resolvedItems.push({
      product: product._id,
      isCustom: false,
      name: product.name,
      flavor: item.flavor,
      weight: item.weight,
      messageOnCake: item.messageOnCake,
      notes: item.notes,
      quantity,
      price,
    });
    itemsTotal += price * quantity;
  }

  // Guard against a shop (or customer) with a wrong location producing an absurd
  // distance and a runaway delivery fee — that once charged ₹109,313 for a biryani.
  const { isValidLatLng } = require('../utils/geo');
  if (!isValidLatLng(shop.location?.lat, shop.location?.lng)) {
    return res.status(409).json({
      message: 'This shop has not set its location yet, so we cannot calculate delivery. Please try another shop.',
      shopUnavailable: true,
    });
  }
  if (!isValidLatLng(deliveryLocation?.lat, deliveryLocation?.lng)) {
    return res.status(400).json({ message: 'Please set a valid delivery location on the map.' });
  }

  const { distanceKm, deliveryFee } = await computeDeliveryFee(shop.location, deliveryLocation, shop.perKmRate);
  if (distanceKm > MAX_DELIVERY_KM) {
    return res.status(409).json({
      message: `This shop is too far from your address (${Math.round(distanceKm)} km) to deliver.`,
      tooFar: true,
    });
  }

  const preDiscountTotal = itemsTotal + deliveryFee;
  let coupon = null;
  let couponDiscount = 0;
  try {
    const resolvedCoupon = await resolveCoupon(req.user._id, couponCode, preDiscountTotal);
    coupon = resolvedCoupon.coupon;
    couponDiscount = resolvedCoupon.discount;
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message });
  }
  const orderValue = preDiscountTotal - couponDiscount;
  const totalAmount = orderValue + tipAmount;
  const pickupCode = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit shop→partner handoff code
  const deliveryCode = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit partner→customer drop-off code

  if (shopOwner) {
    const shopCommissionAmount = shopCommission(orderValue);
    await LedgerEntry.create({
      owner: shopOwner._id,
      ownerRole: 'shop',
      kind: 'commission',
      direction: 'debit',
      amount: shopCommissionAmount,
      balanceAfter: await nextBalanceAfter(shopOwner._id, shopCommissionAmount, 'debit'),
      description: `Platform commission — order ₹${orderValue} at ${shop.name}`,
      status: 'posted',
      referenceType: 'order',
      referenceId: null,
      metadata: { orderId: null },
    });
  }

  const order = await Order.create({
    user: req.user._id,
    shop: shop._id,
    items: resolvedItems,
    deliveryAddress,
    phone,
    deliveryLocation,
    deliveryDate: parsedDeliveryDate,
    deliverySlot,
    paymentMethod,
    itemsTotal,
    distanceKm,
    deliveryFee,
    coupon: coupon?._id || null,
    couponCode: coupon?.code || '',
    couponDiscount,
    tipAmount,
    totalAmount,
    pickupCode,
    deliveryCode,
  });

  if (coupon) {
    coupon.status = 'used';
    coupon.usedAt = new Date();
    coupon.usedOrder = order._id;
    await coupon.save();
  }
  await rewardReferralIfFirstOrder(req.user._id, order._id);

  res.status(201).json({ order });
}

async function listMyOrders(req, res) {
  const orders = await Order.find({ user: req.user._id })
    .populate('shop', 'name location')
    .populate('assignedTo', 'name phone')
    .sort({ createdAt: -1 });
  res.json({ orders });
}

async function listAllOrders(req, res) {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  // Shop owners only see orders for their own shop.
  if (req.user.role === 'shop') {
    if (!req.user.shop) return res.json({ orders: [] });
    filter.shop = req.user.shop;
  }

  const orders = await Order.find(filter)
    .populate('user', 'name email phone')
    .populate('assignedTo', 'name phone')
    .populate('shop', 'name location')
    .sort({ createdAt: -1 });
  res.json({ orders });
}

async function listAssignedOrders(req, res) {
  const orders = await Order.find({ assignedTo: req.user._id })
    .populate('user', 'name email phone')
    .populate('shop', 'name location address')
    .sort({ createdAt: -1 });
  res.json({ orders });
}

// Works whether a ref is a raw ObjectId or a populated document.
function idOf(ref) {
  if (!ref) return null;
  return (ref._id ? ref._id : ref).toString();
}

function canManage(order, user) {
  if (user.role === 'admin') return true;
  if (user.role === 'delivery') {
    return idOf(order.assignedTo) === user._id.toString();
  }
  if (user.role === 'shop') {
    return user.shop && idOf(order.shop) === user.shop.toString();
  }
  return false;
}

async function getOrder(req, res) {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('assignedTo', 'name phone')
    .populate('shop', 'name location address');
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const isOwner = order.user._id.toString() === req.user._id.toString();
  if (!isOwner && !canManage(order, req.user)) {
    return res.status(403).json({ message: 'Not authorized to view this order' });
  }

  // The pickup code is shown by whoever hands the parcel over: the shop for shop
  // orders, or the customer (sender) for courier/food-pickup orders. Admin sees it too.
  const canSeePickupCode =
    req.user.role === 'admin' ||
    req.user.role === 'shop' ||
    (order.type === 'courier' && isOwner);
  // The delivery code is held by the CUSTOMER (recipient) and shown to the partner only
  // at drop-off, so the partner never sees it in advance — they must ask the customer.
  const canSeeDeliveryCode = req.user.role === 'admin' || isOwner;
  const json = order.toObject();
  if (!canSeePickupCode) delete json.pickupCode;
  if (!canSeeDeliveryCode) delete json.deliveryCode;

  res.json({ order: json });
}

// Delivery partner confirms pickup by entering the code the shop shows at handoff.
async function confirmPickup(req, res) {
  const { code } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  if (req.user.role !== 'delivery' || !order.assignedTo || order.assignedTo.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only the assigned delivery partner can confirm pickup' });
  }
  if (!code || String(code).trim() !== order.pickupCode) {
    return res.status(400).json({ message: 'Incorrect pickup code. Please check with the shop.' });
  }

  order.status = 'out_for_delivery';
  order.pickedUpAt = new Date();
  await order.save();
  await order.populate('user', 'name email phone');
  await order.populate('assignedTo', 'name phone');
  await order.populate('shop', 'name location address');
  res.json({ order });
}

// Delivery partner confirms drop-off by entering the code the CUSTOMER shows at the door.
// This is compulsory: an order can only become 'delivered' through this verified handoff,
// guaranteeing the parcel reached the right person.
function startOfDayUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Charges the delivery partner's wallet for a completed delivery, applying a daily
// floor: a partner who delivers at least once in a day is charged at least
// DELIVERY_DAILY_FLOOR for that day, but never charged twice for the same floor —
// each delivery only debits the marginal amount still owed for today.
async function chargeDeliveryCommission(partnerId) {
  const todayStart = startOfDayUTC(new Date());
  const deliveredToday = await Order.countDocuments({
    assignedTo: partnerId,
    status: 'delivered',
    deliveredAt: { $gte: todayStart },
  });
  const owedTotal = Math.max(deliveredToday * DELIVERY_COMMISSION_PER_ORDER, DELIVERY_DAILY_FLOOR);

  const [{ total: chargedToday } = { total: 0 }] = await LedgerEntry.aggregate([
    { $match: { owner: partnerId, ownerRole: 'delivery', kind: 'commission', status: 'posted', createdAt: { $gte: todayStart } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const increment = owedTotal - (chargedToday || 0);
  if (increment <= 0) return;

  await LedgerEntry.create({
    owner: partnerId,
    ownerRole: 'delivery',
    kind: 'commission',
    direction: 'debit',
    amount: increment,
    balanceAfter: await nextBalanceAfter(partnerId, increment, 'debit'),
    description:
      deliveredToday <= 1
        ? `Daily minimum commission (₹${DELIVERY_DAILY_FLOOR})`
        : `Delivery commission (delivery ${deliveredToday} today)`,
    status: 'posted',
  });
}

async function confirmDelivery(req, res) {
  const { code } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  if (req.user.role !== 'delivery' || !order.assignedTo || order.assignedTo.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only the assigned delivery partner can confirm delivery' });
  }
  if (order.status !== 'out_for_delivery') {
    return res.status(400).json({ message: 'Order must be out for delivery before it can be handed over' });
  }
  if (!code || String(code).trim() !== order.deliveryCode) {
    return res.status(400).json({ message: 'Incorrect delivery code. Ask the customer for the code shown in their app.' });
  }

  order.status = 'delivered';
  order.deliveredAt = new Date();
  await order.save();
  await chargeDeliveryCommission(req.user._id);
  if (order.tipAmount > 0) {
    await LedgerEntry.create({
      owner: req.user._id,
      ownerRole: 'delivery',
      kind: 'tip',
      direction: 'credit',
      amount: order.tipAmount,
      balanceAfter: await nextBalanceAfter(req.user._id, order.tipAmount, 'credit'),
      description: `Customer tip for order`,
      status: 'posted',
      referenceType: 'order',
      referenceId: order._id,
    });
  }
  await order.populate('user', 'name email phone');
  await order.populate('assignedTo', 'name phone');
  await order.populate('shop', 'name location address');
  res.json({ order });
}

// Live ETA for whoever is watching: to the SHOP while the partner is still heading
// there, or to the CUSTOMER once the parcel is out for delivery.
async function getOrderEta(req, res) {
  const order = await Order.findById(req.params.id).populate('shop', 'location');
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const isOwner = order.user.toString() === req.user._id.toString();
  if (!isOwner && !canManage(order, req.user)) {
    return res.status(403).json({ message: 'Not authorized to view this order' });
  }
  if (!order.currentLocation) {
    return res.json({ eta: null });
  }

  let destination = null;
  if (order.status === 'heading_to_shop') {
    destination = order.type === 'courier' ? order.pickupLocation : order.shop?.location;
  } else if (order.status === 'out_for_delivery') {
    destination = order.deliveryLocation;
  }
  if (!destination || destination.lat == null) {
    return res.json({ eta: null });
  }

  const eta = await getEta(order.currentLocation, destination);
  res.json({ eta });
}

// Customer rates the shop and (if assigned) the delivery partner separately, once,
// after delivery. Feeds each shop's and partner's running average rating.
async function rateOrder(req, res) {
  const { shopStars, shopComment, deliveryStars, deliveryComment } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to rate this order' });
  }
  if (order.status !== 'delivered') {
    return res.status(400).json({ message: 'You can rate an order only after it has been delivered' });
  }
  if (order.rating?.ratedAt) {
    return res.status(400).json({ message: 'This order has already been rated' });
  }

  const shopStarsNum = Number(shopStars);
  if (!Number.isInteger(shopStarsNum) || shopStarsNum < 1 || shopStarsNum > 5) {
    return res.status(400).json({ message: 'shopStars must be an integer 1-5' });
  }
  const deliveryStarsNum = Number(deliveryStars);
  const rateDelivery = Boolean(order.assignedTo);
  if (rateDelivery && (!Number.isInteger(deliveryStarsNum) || deliveryStarsNum < 1 || deliveryStarsNum > 5)) {
    return res.status(400).json({ message: 'deliveryStars must be an integer 1-5' });
  }

  order.rating = {
    shopStars: shopStarsNum,
    shopComment: shopComment || '',
    deliveryStars: rateDelivery ? deliveryStarsNum : undefined,
    deliveryComment: rateDelivery ? deliveryComment || '' : '',
    ratedAt: new Date(),
  };
  await order.save();

  if (order.shop) {
    const shop = await Shop.findById(order.shop);
    if (shop) {
      const newCount = shop.rating.count + 1;
      shop.rating.avg = Number(((shop.rating.avg * shop.rating.count + shopStarsNum) / newCount).toFixed(2));
      shop.rating.count = newCount;
      await shop.save();
    }
  }
  if (rateDelivery) {
    const partner = await User.findById(order.assignedTo);
    if (partner) {
      const prevCount = partner.rating?.count || 0;
      const prevAvg = partner.rating?.avg || 0;
      const newCount = prevCount + 1;
      partner.rating = { avg: Number(((prevAvg * prevCount + deliveryStarsNum) / newCount).toFixed(2)), count: newCount };
      await partner.save();
    }
  }

  res.json({ order, message: 'Thanks for rating your order!' });
}

async function assignDelivery(req, res) {
  const { deliveryUserId } = req.body;
  const deliveryUser = await User.findOne({ _id: deliveryUserId, role: 'delivery' });
  if (!deliveryUser) {
    return res.status(400).json({ message: 'deliveryUserId must reference a user with role "delivery"' });
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  // Admins can assign any order; a shop owner can assign only their own shop's orders.
  if (!canManage(order, req.user)) {
    return res.status(403).json({ message: 'Not authorized to assign this order' });
  }

  order.assignedTo = deliveryUser._id;
  await order.save();
  await order.populate('user', 'name email phone');
  await order.populate('assignedTo', 'name phone');
  res.json({ order });
}

// Delivery partners a shop (or admin) can assign an order to: verified, KYC-approved.
async function listDeliveryPartners(req, res) {
  const partners = await User.find({ role: 'delivery' })
    .select('name phone kyc.status rating')
    .sort({ name: 1 });
  res.json({ partners });
}

async function updateOrderStatus(req, res) {
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  if (!canManage(order, req.user)) {
    return res.status(403).json({ message: 'Not authorized to update this order' });
  }
  // 'delivered' can only be reached through the code-verified drop-off (confirmDelivery),
  // so nobody can mark an order delivered without proving it reached the right customer.
  if (status === 'delivered') {
    return res.status(400).json({ message: 'Use the delivery-code confirmation to mark an order delivered' });
  }

  order.status = status;
  await order.save();
  await order.populate('user', 'name email phone');
  await order.populate('assignedTo', 'name phone');
  res.json({ order });
}

async function updateOrderLocation(req, res) {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ message: 'lat and lng must be numbers' });
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  if (!canManage(order, req.user)) {
    return res.status(403).json({ message: 'Not authorized to update this order' });
  }

  const point = { lat, lng, updatedAt: new Date() };
  order.currentLocation = point;
  order.locationHistory.push(point);
  await order.save();
  await order.populate('user', 'name email phone');
  await order.populate('assignedTo', 'name phone');
  res.json({ order });
}

async function cancelOrder(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to cancel this order' });
  }
  if (order.status !== 'placed') {
    return res.status(400).json({ message: 'Only orders in "placed" status can be cancelled' });
  }

  order.status = 'cancelled';
  await order.save();
  res.json({ order });
}

module.exports = {
  placeOrder,
  placeCourierOrder,
  courierQuote,
  listMyCoupons,
  listMyOrders,
  listAllOrders,
  listAssignedOrders,
  getOrder,
  assignDelivery,
  listDeliveryPartners,
  listAvailableOrders,
  claimOrder,
  updateOrderStatus,
  updateOrderLocation,
  confirmPickup,
  confirmDelivery,
  getOrderEta,
  rateOrder,
  cancelOrder,
};
