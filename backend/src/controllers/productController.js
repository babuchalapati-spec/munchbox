const Product = require('../models/Product');

async function listProducts(req, res) {
  const { category, available, shop, blocked } = req.query;
  const filter = {};
  if (category) filter.category = category;

  const requestedShop = shop || (req.user?.role === 'shop' && req.user.shop ? String(req.user.shop) : '');
  if (requestedShop) filter.shop = requestedShop;
  if (available !== undefined) filter.available = available === 'true';

  const isAdmin = req.user?.role === 'admin';
  const isOwnerOfShop =
    req.user?.role === 'shop' && req.user.shop && requestedShop && req.user.shop.toString() === String(requestedShop);

  // Admins see everything; a shop owner sees every item in their own shop, blocked ones
  // included, so they know why something is hidden. Customers see every non-blocked item,
  // including out-of-stock ones (shown disabled) so they know the shop carries it.
  if (!isAdmin && !isOwnerOfShop) {
    filter.blocked = { $ne: true };
  }
  // Admin can ask for just the items they have blocked.
  if (isAdmin && blocked === 'true') {
    filter.blocked = true;
  }

  const products = await Product.find(filter).populate('shop', 'name category').sort({ createdAt: -1 });
  res.json({ products });
}

// Admin blocks (hides) or unblocks a shop's item. Items are NOT approved by the admin —
// they go live when the shop adds them; this is only the after-the-fact safety valve.
async function blockProduct(req, res) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can block items' });
  }
  const { action, reason } = req.body; // 'block' | 'unblock'
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  if (action === 'block') {
    product.blocked = true;
    product.blockedReason = reason || 'Blocked by admin';
  } else if (action === 'unblock') {
    product.blocked = false;
    product.blockedReason = '';
  } else {
    return res.status(400).json({ message: "action must be 'block' or 'unblock'" });
  }
  await product.save();
  res.json({ product });
}

async function getProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json({ product });
}

// Accepts weightOptions/addOns as either JSON strings (multipart) or arrays (JSON body).
function parseList(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return [];
  }
}

async function createProduct(req, res) {
  // A shop's menu belongs to the shop. Only the shop owner adds items — the admin never
  // adds an item on a shop's behalf, so the shop alone says what it sells and at what price.
  if (req.user.role !== 'shop') {
    return res.status(403).json({
      message: 'Items are added by the shop itself. Ask the shop owner to add it from their shop login.',
    });
  }
  const { name, description, category, basePrice, weightOptions, addOns, isCustomizable, available, imageUrl } = req.body;
  const shop = req.user.shop;
  if (!shop || !name || !category || basePrice === undefined) {
    return res.status(400).json({ message: 'name, category and basePrice are required' });
  }

  const product = await Product.create({
    shop,
    name,
    description,
    category,
    basePrice,
    weightOptions: parseList(weightOptions),
    addOns: parseList(addOns),
    isCustomizable: isCustomizable === 'true' || isCustomizable === true,
    available: available === undefined ? true : available === 'true' || available === true,
    approved: true,
    blocked: false,
    // Image can come from an uploaded file (multipart) or a pre-uploaded URL (JSON body).
    imageUrl: req.file ? `/uploads/${req.file.filename}` : imageUrl || '',
  });

  res.status(201).json({ product });
}

function ownsProduct(product, user) {
  if (user.role === 'admin') return true;
  return user.role === 'shop' && user.shop && product.shop.toString() === user.shop.toString();
}

async function updateProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  if (!ownsProduct(product, req.user)) {
    return res.status(403).json({ message: 'You can only edit your own shop products' });
  }

  const { shop, name, description, category, basePrice, weightOptions, addOns, isCustomizable, available, imageUrl } = req.body;
  // Only admins may move a product to another shop.
  if (shop !== undefined && req.user.role === 'admin') product.shop = shop;
  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (category !== undefined) product.category = category;
  if (basePrice !== undefined) product.basePrice = basePrice;
  if (weightOptions !== undefined) product.weightOptions = parseList(weightOptions);
  if (addOns !== undefined) product.addOns = parseList(addOns);
  if (isCustomizable !== undefined) product.isCustomizable = isCustomizable === 'true' || isCustomizable === true;
  if (available !== undefined) product.available = available === 'true' || available === true;
  if (req.file) product.imageUrl = `/uploads/${req.file.filename}`;
  else if (imageUrl !== undefined) product.imageUrl = imageUrl;

  await product.save();
  res.json({ product });
}

async function deleteProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  if (!ownsProduct(product, req.user)) {
    return res.status(403).json({ message: 'You can only delete your own shop products' });
  }
  await product.deleteOne();
  res.json({ message: 'Product deleted' });
}

async function listPendingProducts(req, res) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can review pending items' });
  }

  const products = await Product.find({ approved: false, blocked: true })
    .populate('shop', 'name category')
    .sort({ createdAt: -1 });

  res.json({ products });
}

async function reviewProduct(req, res) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can review items' });
  }

  const { action, reason } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  if (action === 'approve') {
    product.approved = true;
    product.blocked = false;
    product.blockedReason = '';
  } else {
    product.approved = false;
    product.blocked = true;
    product.blockedReason = reason || 'Rejected by admin';
  }

  await product.save();
  res.json({ product });
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  blockProduct,
  listPendingProducts,
  reviewProduct,
};
