const PDFDocument = require('pdfkit');
const LedgerEntry = require('../models/LedgerEntry');
const User = require('../models/User');
const Shop = require('../models/Shop');
const { createRazorpayOrder, fetchRazorpayOrder, verifyRazorpaySignature, getCredentials } = require('../utils/razorpay');

// Once a shop/delivery top-up is confirmed paid, clear the shop's activation deposit
// if this payment brought the balance up to the required amount. Same rule the admin's
// manual UPI-topup confirmation uses (see reviewTopUp) — kept in sync here.
async function clearShopDepositIfPaid(ownerId, ownerRole, balanceAfter) {
  if (ownerRole !== 'shop') return;
  const owner = await User.findById(ownerId);
  const shop = owner?.shop ? await Shop.findById(owner.shop) : null;
  if (shop?.deposit?.required && !shop.deposit.paid && balanceAfter >= shop.deposit.amount) {
    shop.deposit.paid = true;
    shop.available = true;
    shop.subscription.active = true;
    await shop.save();
  }
}

function normalizeAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildDailySummary(entries) {
  const byDay = new Map();

  entries.forEach((entry) => {
    const date = new Date(entry.createdAt);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, { date: dayKey, credits: 0, debits: 0, entries: 0 });
    }
    const bucket = byDay.get(dayKey);
    if (entry.direction === 'credit') bucket.credits += Number(entry.amount || 0);
    else bucket.debits += Number(entry.amount || 0);
    bucket.entries += 1;
  });

  return Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date));
}

async function getLedger(req, res) {
  const { role, id } = req.query;
  let ownerId = req.query.ownerId || req.query.userId;
  const isAdmin = req.user?.role === 'admin';

  if (!isAdmin && req.user?.role !== 'shop' && req.user?.role !== 'delivery') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  if (!ownerId && req.user?.role === 'shop') {
    ownerId = req.user._id.toString();
  }
  if (!ownerId && req.user?.role === 'delivery') {
    ownerId = req.user._id.toString();
  }

  if (ownerId && !isAdmin) {
    const target = await User.findById(ownerId);
    if (!target || target._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
  }

  const filter = {};
  if (ownerId) filter.owner = ownerId;
  if (role) filter.ownerRole = role;

  // When admin browses without picking one owner, entries span multiple shops/partners —
  // attach each owner's name so the list (and any totals) can be told apart per-owner.
  let query = LedgerEntry.find(filter).sort({ createdAt: -1 });
  if (isAdmin && !ownerId) {
    query = query.populate('owner', 'name email phone');
  }
  const entries = await query.lean();

  // Only settled (posted) entries count toward the usable balance — a UPI top-up stays
  // 'pending' until the admin confirms the money actually arrived.
  const balance = entries.reduce((total, entry) => {
    if (entry.status !== 'posted') return total;
    if (entry.direction === 'credit') return total + Number(entry.amount || 0);
    return total - Number(entry.amount || 0);
  }, 0);
  const pendingTopUps = entries.filter((e) => e.status === 'pending');

  res.json({
    entries,
    balance: Number(balance.toFixed(2)),
    pendingTopUps,
    dailySummary: buildDailySummary(entries),
  });
}

// A shop/delivery partner tells us they paid by UPI. Creates a PENDING credit that the
// admin must confirm before it counts toward their balance.
async function requestTopUp(req, res) {
  const { amount, reference } = req.body;
  if (!['shop', 'delivery'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only shop or delivery accounts can add balance' });
  }
  const amountValue = normalizeAmount(amount);
  if (amountValue <= 0) {
    return res.status(400).json({ message: 'Enter a valid amount' });
  }

  const entry = await LedgerEntry.create({
    owner: req.user._id,
    ownerRole: req.user.role,
    kind: 'deposit',
    direction: 'credit',
    amount: amountValue,
    balanceAfter: 0,
    description: `UPI top-up ₹${amountValue}${reference ? ` · ref ${reference}` : ''}`,
    status: 'pending', // admin must confirm the money arrived
    metadata: { reference: reference || '' },
  });

  res.status(201).json({
    entry,
    message: 'Payment submitted. Your balance will be credited once the admin confirms it.',
  });
}

// Admin confirms (or rejects) a pending UPI top-up.
async function reviewTopUp(req, res) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can confirm top-ups' });
  }
  const { action } = req.body; // 'confirm' | 'reject'
  const entry = await LedgerEntry.findById(req.params.id);
  if (!entry) return res.status(404).json({ message: 'Top-up not found' });
  if (entry.status !== 'pending') {
    return res.status(400).json({ message: 'This top-up has already been reviewed' });
  }

  if (action === 'confirm') {
    const last = await LedgerEntry.findOne({ owner: entry.owner, status: 'posted' }).sort({ createdAt: -1 });
    entry.status = 'posted';
    entry.balanceAfter = Number(((last?.balanceAfter || 0) + entry.amount).toFixed(2));
    await entry.save();

    // If this shop is waiting on its activation deposit, this payment may clear it —
    // the shop goes live the moment the required amount has been confirmed.
    await clearShopDepositIfPaid(entry.owner, entry.ownerRole, entry.balanceAfter);

    return res.json({ entry, message: 'Top-up confirmed and balance credited.' });
  }
  if (action === 'reject') {
    await entry.deleteOne();
    return res.json({ message: 'Top-up rejected.' });
  }
  return res.status(400).json({ message: "action must be 'confirm' or 'reject'" });
}

// All pending top-ups awaiting admin confirmation.
async function listPendingTopUps(req, res) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can view pending top-ups' });
  }
  const entries = await LedgerEntry.find({ status: 'pending' })
    .populate('owner', 'name email phone role')
    .sort({ createdAt: -1 });
  res.json({ entries });
}

async function createLedgerEntry(req, res) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can create ledger entries' });
  }

  const { ownerId, ownerRole, kind, direction, amount, description, status, referenceType, referenceId, metadata } = req.body;
  if (!ownerId || !ownerRole || !description) {
    return res.status(400).json({ message: 'ownerId, ownerRole and description are required' });
  }
  if (!['shop', 'delivery'].includes(ownerRole)) {
    return res.status(400).json({ message: 'ownerRole must be shop or delivery' });
  }

  const owner = await User.findById(ownerId);
  if (!owner || !['shop', 'delivery'].includes(owner.role)) {
    return res.status(400).json({ message: 'Invalid owner account' });
  }

  const amountValue = normalizeAmount(amount);
  const last = await LedgerEntry.findOne({ owner: ownerId }).sort({ createdAt: -1 });
  const balanceAfter = (last?.balanceAfter || 0) + (direction === 'credit' ? amountValue : -amountValue);

  const entry = await LedgerEntry.create({
    owner: ownerId,
    ownerRole,
    kind: kind || 'deposit',
    direction,
    amount: amountValue,
    balanceAfter: Number(balanceAfter.toFixed(2)),
    description,
    status: status || 'posted',
    referenceType,
    referenceId,
    metadata: metadata || {},
  });

  res.status(201).json({ entry });
}

// Shop/delivery: start an online top-up via Razorpay — an alternative to the manual
// UPI flow above that doesn't need the admin to confirm anything (Razorpay itself
// confirms the money moved, so the balance is credited immediately on verify).
async function createWalletTopUpOrder(req, res) {
  if (!['shop', 'delivery'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only shop or delivery accounts can add balance' });
  }
  const amountValue = normalizeAmount(req.body.amount);
  if (amountValue <= 0) {
    return res.status(400).json({ message: 'Enter a valid amount' });
  }
  try {
    const gatewayOrder = await createRazorpayOrder(amountValue, `mbtopup_${req.user._id}_${Date.now()}`);
    const { keyId } = await getCredentials();
    res.json({
      razorpayOrderId: gatewayOrder.id,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency,
      keyId,
    });
  } catch (err) {
    res.status(err.statusCode || 502).json({ message: err.message || 'Could not start payment' });
  }
}

// Verifies the Razorpay payment signature, then posts the credit straight away (status
// 'posted', not 'pending') since Razorpay has already confirmed the money moved.
async function verifyWalletTopUp(req, res) {
  if (!['shop', 'delivery'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only shop or delivery accounts can add balance' });
  }
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: 'Payment verification details are required' });
  }
  if (!(await verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature))) {
    return res.status(400).json({ message: 'Payment verification failed. If money was deducted, it will be refunded automatically.' });
  }

  // Same retry-safety as order payments: if this exact payment was already credited
  // (e.g. a network retry after the app already got the success callback), don't double-credit.
  const existing = await LedgerEntry.findOne({ 'metadata.razorpayPaymentId': razorpayPaymentId });
  if (existing) {
    return res.json({ entry: existing, message: 'Balance already credited for this payment.' });
  }

  // Trust the amount Razorpay recorded for this order, not anything the client sends.
  let gatewayOrder;
  try {
    gatewayOrder = await fetchRazorpayOrder(razorpayOrderId);
  } catch (err) {
    return res.status(502).json({ message: 'Could not confirm payment with the gateway. Please try again.' });
  }
  const amountValue = Number((gatewayOrder.amount / 100).toFixed(2));

  const last = await LedgerEntry.findOne({ owner: req.user._id, status: 'posted' }).sort({ createdAt: -1 });
  const balanceAfter = Number(((last?.balanceAfter || 0) + amountValue).toFixed(2));

  const entry = await LedgerEntry.create({
    owner: req.user._id,
    ownerRole: req.user.role,
    kind: 'deposit',
    direction: 'credit',
    amount: amountValue,
    balanceAfter,
    description: `Razorpay top-up ₹${amountValue}`,
    status: 'posted',
    metadata: { razorpayOrderId, razorpayPaymentId },
  });

  await clearShopDepositIfPaid(req.user._id, req.user.role, balanceAfter);

  res.status(201).json({ entry, message: `₹${amountValue} added to your balance.` });
}

// Downloadable PDF statement — same access rules as getLedger (self for shop/delivery,
// any owner for admin via ?ownerId=). Opened directly in the phone/browser's PDF
// viewer, which already has print/share built in — no app-side PDF library needed.
async function exportLedgerPdf(req, res) {
  let ownerId = req.query.ownerId || req.query.userId;
  const isAdmin = req.user?.role === 'admin';

  if (!isAdmin && req.user?.role !== 'shop' && req.user?.role !== 'delivery') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (!ownerId) ownerId = req.user._id.toString();
  if (ownerId !== req.user._id.toString() && !isAdmin) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const owner = await User.findById(ownerId).select('name email role shop').populate('shop', 'name');
  if (!owner) return res.status(404).json({ message: 'Account not found' });

  const entries = await LedgerEntry.find({ owner: ownerId }).sort({ createdAt: 1 }).lean();
  const totals = entries.reduce(
    (acc, e) => {
      if (e.status !== 'posted') return acc;
      if (e.direction === 'credit') acc.credits += Number(e.amount || 0);
      else acc.debits += Number(e.amount || 0);
      return acc;
    },
    { credits: 0, debits: 0 }
  );
  const balance = totals.credits - totals.debits;

  const safeName = String(owner.name || 'account').replace(/[^a-z0-9]+/gi, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="munchbox-statement-${safeName}.pdf"`);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text('Munchbox — Account Statement', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).font('Helvetica');
  doc.text(`Name: ${owner.name}`);
  doc.text(`Role: ${owner.role}${owner.shop?.name ? ` (${owner.shop.name})` : ''}`);
  doc.text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Total credits: +${totals.credits.toFixed(2)}`);
  doc.text(`Total debits: -${totals.debits.toFixed(2)}`);
  doc.font('Helvetica-Bold').text(`Balance: ${balance.toFixed(2)}`);
  doc.font('Helvetica');
  doc.moveDown();

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Date            Kind          Credit      Debit       Description');
  doc.font('Courier').fontSize(9);
  entries.forEach((e) => {
    const date = new Date(e.createdAt).toLocaleDateString().padEnd(12);
    const kind = String(e.kind).padEnd(14);
    const credit = (e.direction === 'credit' ? e.amount.toFixed(2) : '').padEnd(12);
    const debit = (e.direction === 'debit' ? e.amount.toFixed(2) : '').padEnd(12);
    doc.text(`${date}${kind}${credit}${debit}${e.description}`);
  });

  doc.end();
}

module.exports = {
  getLedger,
  exportLedgerPdf,
  createLedgerEntry,
  requestTopUp,
  reviewTopUp,
  listPendingTopUps,
  createWalletTopUpOrder,
  verifyWalletTopUp,
};
