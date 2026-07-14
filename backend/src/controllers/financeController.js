const Expense = require('../models/Expense');
const LedgerEntry = require('../models/LedgerEntry');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Settings = require('../models/Settings');

async function listExpenses(req, res) {
  const expenses = await Expense.find().sort({ date: -1 });
  res.json({ expenses });
}

async function createExpense(req, res) {
  const { description, amount, category, date } = req.body;
  if (!description || amount === undefined) {
    return res.status(400).json({ message: 'description and amount are required' });
  }
  const expense = await Expense.create({
    description,
    amount: Number(amount),
    category: category || 'general',
    date: date ? new Date(date) : new Date(),
  });
  res.status(201).json({ expense });
}

async function deleteExpense(req, res) {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) return res.status(404).json({ message: 'Expense not found' });
  res.json({ message: 'Expense deleted' });
}

// A rough "area" from a shop's free-text address — the last comma-separated
// segment, e.g. "12 Park Lane, Jubilee Hills, Hyderabad" -> "Hyderabad". This is
// approximate by design: shops don't have a structured city field yet, so grouping
// is only as consistent as how addresses were typed in.
function areaFromAddress(address) {
  if (!address) return 'Unknown';
  const parts = String(address)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'Unknown';
}

// Revenue here means platform commission actually collected (posted ledger entries
// only) — not order value, which belongs to the shop or customer, not the platform.
async function getOverview(req, res) {
  const [shopCommissionEntries, deliveryCommissionEntries] = await Promise.all([
    LedgerEntry.find({ ownerRole: 'shop', kind: 'commission', status: 'posted' }).lean(),
    LedgerEntry.find({ ownerRole: 'delivery', kind: 'commission', status: 'posted' }).lean(),
  ]);

  const shopOwnerIds = [...new Set(shopCommissionEntries.map((e) => e.owner.toString()))];
  const shopOwners = await User.find({ _id: { $in: shopOwnerIds } })
    .select('shop')
    .lean();
  const shopIdByOwner = {};
  shopOwners.forEach((o) => {
    shopIdByOwner[o._id.toString()] = o.shop;
  });

  const shopIds = [...new Set(Object.values(shopIdByOwner).filter(Boolean).map((id) => id.toString()))];
  const shops = await Shop.find({ _id: { $in: shopIds } })
    .select('address name')
    .lean();
  const shopById = {};
  shops.forEach((s) => {
    shopById[s._id.toString()] = s;
  });

  const areaTotals = {};
  let shopRevenue = 0;
  shopCommissionEntries.forEach((e) => {
    const amount = Number(e.amount || 0);
    shopRevenue += amount;
    const shopId = shopIdByOwner[e.owner.toString()];
    const shop = shopId && shopById[shopId.toString()];
    const area = areaFromAddress(shop?.address);
    if (!areaTotals[area]) areaTotals[area] = { area, shopRevenue: 0, orderCount: 0 };
    areaTotals[area].shopRevenue += amount;
    areaTotals[area].orderCount += 1;
  });

  const deliveryRevenue = deliveryCommissionEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalRevenue = shopRevenue + deliveryRevenue;

  const expenses = await Expense.find().lean();
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const settings = await Settings.getSingleton();
  const taxPercent = settings.finance?.taxPercent || 0;
  const taxAmount = Number(((totalRevenue * taxPercent) / 100).toFixed(2));
  const netProfit = Number((totalRevenue - taxAmount - totalExpenses).toFixed(2));

  res.json({
    revenueByArea: Object.values(areaTotals)
      .map((a) => ({ ...a, shopRevenue: Number(a.shopRevenue.toFixed(2)) }))
      .sort((a, b) => b.shopRevenue - a.shopRevenue),
    shopRevenue: Number(shopRevenue.toFixed(2)),
    deliveryRevenue: Number(deliveryRevenue.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    taxPercent,
    taxAmount,
    netProfit,
  });
}

module.exports = { listExpenses, createExpense, deleteExpense, getOverview };
