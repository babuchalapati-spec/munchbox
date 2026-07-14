const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
}

// Same as protect, but also accepts the token as a ?token= query param — for links
// opened directly by a phone's PDF viewer/browser, which can't attach a custom
// Authorization header. Only used on routes meant to be opened this way.
async function protectViaHeaderOrQuery(req, res, next) {
  const header = req.headers.authorization;
  const headerToken = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
  const token = headerToken || req.query.token;
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
}

// Sets req.user if a valid token is present, but does not require one.
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user) req.user = user;
  } catch (err) {
    // ignore invalid token for optional auth
  }
  next();
}

function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
}

function deliveryOnly(req, res, next) {
  if (req.user && req.user.role === 'delivery') {
    return next();
  }
  return res.status(403).json({ message: 'Delivery account required' });
}

// Admin OR shop-owner. Shop owners get scoped to their own shop in the controller.
function adminOrShop(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'shop')) {
    return next();
  }
  return res.status(403).json({ message: 'Admin or shop account required' });
}

// Locks a shop owner out of managing their shop when their subscription has lapsed.
// Admins and other roles pass through untouched.
async function requireShopSubscription(req, res, next) {
  if (!req.user || req.user.role !== 'shop') return next();
  const Shop = require('../models/Shop');
  const shop = req.user.shop ? await Shop.findById(req.user.shop) : null;
  // No shop linked is a different problem from an expired subscription — say so plainly.
  if (!shop) {
    return res.status(403).json({
      noShop: true,
      message: 'No shop is linked to your account. Ask the Munchbox admin to link your shop.',
    });
  }
  if (!shop.isSubscriptionActive()) {
    return res.status(403).json({
      subscriptionExpired: true,
      message: 'Your Munchbox subscription has expired. Please renew to continue managing your shop.',
    });
  }
  next();
}

module.exports = {
  protect,
  protectViaHeaderOrQuery,
  optionalAuth,
  adminOnly,
  deliveryOnly,
  adminOrShop,
  requireShopSubscription,
};
