const CateringRequest = require('../models/CateringRequest');
const Product = require('../models/Product');
const Shop = require('../models/Shop');

// Customer submits a catering enquiry: items + headcount + event date.
async function createRequest(req, res) {
  const { shop: shopId, items, headcount, eventDate, address, phone, notes } = req.body;

  if (!shopId) return res.status(400).json({ message: 'shop is required' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Select at least one catering item' });
  }
  if (!headcount || Number(headcount) < 1) {
    return res.status(400).json({ message: 'headcount (number of people) is required' });
  }
  if (!eventDate) return res.status(400).json({ message: 'eventDate is required' });
  if (!address || !phone) return res.status(400).json({ message: 'address and phone are required' });

  const shop = await Shop.findById(shopId);
  if (!shop || shop.category !== 'catering') {
    return res.status(400).json({ message: 'Shop is not a catering service' });
  }

  const resolvedItems = [];
  let estimatedTotal = 0;
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) return res.status(400).json({ message: `Product not found: ${item.product}` });
    if (product.shop.toString() !== shopId.toString()) {
      return res.status(400).json({ message: 'All items must belong to the selected caterer' });
    }
    const quantity = Number(item.quantity) || 1;
    resolvedItems.push({ product: product._id, name: product.name, unitPrice: product.basePrice, quantity });
    estimatedTotal += product.basePrice * quantity;
  }

  const request = await CateringRequest.create({
    user: req.user._id,
    shop: shop._id,
    items: resolvedItems,
    headcount: Number(headcount),
    eventDate: new Date(eventDate),
    address,
    phone,
    notes,
    estimatedTotal,
  });

  res.status(201).json({ request });
}

async function listMyRequests(req, res) {
  const requests = await CateringRequest.find({ user: req.user._id })
    .populate('shop', 'name')
    .sort({ createdAt: -1 });
  res.json({ requests });
}

async function listAllRequests(req, res) {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  // Caterer (shop owner) only sees requests for their own shop.
  if (req.user.role === 'shop') {
    if (!req.user.shop) return res.json({ requests: [] });
    filter.shop = req.user.shop;
  }
  const requests = await CateringRequest.find(filter)
    .populate('user', 'name email phone')
    .populate('shop', 'name')
    .sort({ createdAt: -1 });
  res.json({ requests });
}

// Caterer/admin sends a quote, optionally applying a quantity-based discount.
async function quoteRequest(req, res) {
  const { quotedTotal, discount, ownerNote } = req.body;
  const request = await CateringRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Catering request not found' });
  if (req.user.role === 'shop' && (!req.user.shop || request.shop.toString() !== req.user.shop.toString())) {
    return res.status(403).json({ message: 'You can only quote requests for your own shop' });
  }
  if (request.status === 'accepted') {
    return res.status(400).json({ message: 'This request is already accepted' });
  }

  const baseTotal = quotedTotal !== undefined ? Number(quotedTotal) : request.estimatedTotal;
  const disc = discount !== undefined ? Number(discount) : 0;
  if (disc < 0 || disc > baseTotal) {
    return res.status(400).json({ message: 'discount must be between 0 and the total' });
  }

  request.quotedTotal = Math.max(0, baseTotal - disc);
  request.discount = disc;
  if (ownerNote !== undefined) request.ownerNote = ownerNote;
  request.status = 'quoted';
  await request.save();
  await request.populate('user', 'name email phone');
  await request.populate('shop', 'name');
  res.json({ request });
}

async function respondToQuote(req, res) {
  const { accept } = req.body;
  const request = await CateringRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Catering request not found' });
  if (request.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (request.status !== 'quoted') {
    return res.status(400).json({ message: 'This request has not been quoted yet' });
  }

  request.status = accept ? 'accepted' : 'rejected';
  await request.save();
  await request.populate('shop', 'name');
  res.json({ request });
}

module.exports = { createRequest, listMyRequests, listAllRequests, quoteRequest, respondToQuote };
