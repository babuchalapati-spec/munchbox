const Shop = require('../models/Shop');
const User = require('../models/User');
const LedgerEntry = require('../models/LedgerEntry');
const { computeDeliveryFee, haversineKm } = require('../utils/distance');
const { isValidLatLng } = require('../utils/geo');

// Customers only see shops within this radius of their location — no point showing
// a cake shop 80km away that can't realistically deliver.
const MAX_BROWSE_RADIUS_KM = 15;

async function listShops(req, res) {
  const filter = {};
  if (req.query.available !== undefined) filter.available = req.query.available === 'true';
  if (req.query.category) filter.category = req.query.category;

  let shops = await Shop.find(filter).sort({ createdAt: -1 });
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const userLocation = isValidLatLng(lat, lng) ? { lat, lng } : null;

  // Customers (non-admin) only see shops that are available and have an active subscription.
  const isAdmin = req.user && req.user.role === 'admin';
  if (!isAdmin) {
    shops = shops.filter((s) => s.available && s.isSubscriptionActive() && !(s.deposit?.required && !s.deposit?.paid));

    // A shop whose advance wallet is too low can't fulfil orders, so customers simply
    // don't see it. The wallet balance itself is never exposed to customers.
    const User = require('../models/User');
    const LedgerEntry = require('../models/LedgerEntry');
    const MIN_WALLET_BALANCE = 500;

    const owners = await User.find({ role: 'shop', shop: { $in: shops.map((s) => s._id) } })
      .select('_id shop')
      .lean();
    if (owners.length) {
      const entries = await LedgerEntry.find({
        owner: { $in: owners.map((o) => o._id) },
        status: 'posted',
      }).lean();

      const balanceByOwner = {};
      entries.forEach((e) => {
        const key = e.owner.toString();
        const delta = e.direction === 'credit' ? Number(e.amount || 0) : -Number(e.amount || 0);
        balanceByOwner[key] = (balanceByOwner[key] || 0) + delta;
      });

      const blockedShopIds = new Set(
        owners
          .filter((o) => (balanceByOwner[o._id.toString()] || 0) < MIN_WALLET_BALANCE)
          .map((o) => o.shop.toString())
      );
      shops = shops.filter((s) => !blockedShopIds.has(s._id.toString()));
    }
  }

  if (userLocation) {
    const withDistance = shops.map((shop) => ({
      shop,
      distanceKm: shop.location && isValidLatLng(shop.location.lat, shop.location.lng)
        ? Math.round(haversineKm(shop.location, userLocation) * 100) / 100
        : Number.POSITIVE_INFINITY,
    }));

    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    // Only customers are radius-limited — admin (managing all shops) still sees everything.
    const inRange = isAdmin ? withDistance : withDistance.filter((w) => w.distanceKm <= MAX_BROWSE_RADIUS_KM);
    shops = inRange.map(({ shop, distanceKm }) => ({ ...shop.toObject(), distanceKm }));
  }

  res.json({ shops });
}

async function getShop(req, res) {
  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ message: 'Shop not found' });
  res.json({ shop });
}

async function createShop(req, res) {
  const { name, category, description, address, perKmRate, available } = req.body;
  let { lat, lng } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  // Map the shop to the RIGHT point: use given coordinates only if they're valid,
  // otherwise geocode the typed address. Bad coordinates cause absurd delivery fees.
  const { isValidLatLng, geocode } = require('../utils/geo');
  if (!isValidLatLng(lat, lng)) {
    const place = address ? await geocode(address) : null;
    if (!place) {
      return res.status(400).json({
        message: 'Could not locate the shop address on the map. Enter a more specific address, or set the location from the map.',
      });
    }
    lat = place.lat;
    lng = place.lng;
  }

  const shop = await Shop.create({
    name,
    category: category || 'cake',
    description,
    address,
    location: { lat: Number(lat), lng: Number(lng) },
    perKmRate: perKmRate !== undefined ? Number(perKmRate) : 12,
    available: available === undefined ? true : available === 'true' || available === true,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
  });
  res.status(201).json({ shop });
}

async function updateShop(req, res) {
  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ message: 'Shop not found' });

  const { name, category, description, address, lat, lng, perKmRate, available, gstNumber, fssaiNumber, fssaiCertificateUrl } = req.body;
  if (name !== undefined) shop.name = name;
  if (category !== undefined) shop.category = category;
  if (description !== undefined) shop.description = description;
  if (address !== undefined) shop.address = address;
  if (lat !== undefined) shop.location.lat = Number(lat);
  if (lng !== undefined) shop.location.lng = Number(lng);
  if (perKmRate !== undefined) shop.perKmRate = Number(perKmRate);
  if (available !== undefined) shop.available = available === 'true' || available === true;
  if (gstNumber !== undefined) shop.gstNumber = gstNumber;
  if (fssaiNumber !== undefined) shop.fssaiNumber = fssaiNumber;
  if (fssaiCertificateUrl !== undefined) shop.fssaiCertificateUrl = fssaiCertificateUrl;
  if (req.file) shop.imageUrl = `/uploads/${req.file.filename}`;

  await shop.save();
  res.json({ shop });
}

async function deleteShop(req, res) {
  const shop = await Shop.findByIdAndDelete(req.params.id);
  if (!shop) return res.status(404).json({ message: 'Shop not found' });
  res.json({ message: 'Shop deleted' });
}

// Quote the delivery fee from this shop to a given lat/lng, so the customer
// sees the charge before placing the order. Falls back to geocoding a typed
// address when lat/lng aren't available — e.g. a browser blocking GPS access
// because the site isn't served over HTTPS (a plain-HTTP local address can
// never get a location fix, no matter how many times the user allows it).
async function deliveryQuote(req, res) {
  let { lat, lng, address } = req.body;
  const { isValidLatLng, geocode } = require('../utils/geo');
  if (!isValidLatLng(lat, lng)) {
    if (!address) {
      return res.status(400).json({ message: 'lat/lng or an address is required' });
    }
    const place = await geocode(address);
    if (!place) {
      return res.status(400).json({ message: 'Could not find that address. Please try a fuller address (area, city).' });
    }
    lat = place.lat;
    lng = place.lng;
  }
  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ message: 'Shop not found' });

  const { distanceKm, deliveryFee } = await computeDeliveryFee(shop.location, { lat, lng }, shop.perKmRate);
  res.json({ distanceKm, deliveryFee, perKmRate: shop.perKmRate, lat, lng });
}

// Admin sets/extends a shop's subscription.
async function updateSubscription(req, res) {
  const { active, plan, endsAt, extendDays, amount, paymentDescription } = req.body;
  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ message: 'Shop not found' });

  if (active !== undefined) shop.subscription.active = active === true || active === 'true';
  if (plan !== undefined) shop.subscription.plan = plan;
  if (endsAt !== undefined) shop.subscription.endsAt = new Date(endsAt);
  if (extendDays !== undefined) {
    const base = shop.subscription.endsAt && shop.subscription.endsAt > new Date() ? shop.subscription.endsAt : new Date();
    shop.subscription.endsAt = new Date(base.getTime() + Number(extendDays) * 24 * 60 * 60 * 1000);
    shop.subscription.active = true;
  }

  await shop.save();

  const paymentAmount = Number(amount);
  if (Number.isFinite(paymentAmount) && paymentAmount > 0) {
    const owner = await User.findOne({ role: 'shop', shop: shop._id });
    if (owner) {
      const lastEntry = await LedgerEntry.findOne({ owner: owner._id }).sort({ createdAt: -1 });
      const balanceAfter = (lastEntry?.balanceAfter || 0) + paymentAmount;
      await LedgerEntry.create({
        owner: owner._id,
        ownerRole: 'shop',
        kind: 'deposit',
        direction: 'credit',
        amount: paymentAmount,
        balanceAfter: Number(balanceAfter.toFixed(2)),
        description: paymentDescription || 'Shop subscription payment',
        status: 'posted',
        referenceType: 'shop.subscription',
        referenceId: shop._id,
      });
    }
  }

  res.json({ shop });
}

module.exports = { listShops, getShop, createShop, updateShop, deleteShop, deliveryQuote, updateSubscription };
