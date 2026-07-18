const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Otp = require('../models/Otp');
const Coupon = require('../models/Coupon');
const ReferralTicket = require('../models/ReferralTicket');
const { sendSms, sendOtpSms } = require('../utils/sms');
const { generateSecret, qrDataUrl, verifyToken } = require('../utils/twoFactor');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
}

// A short-lived token issued after the password step, exchanged for a full token
// only once the second factor (authenticator code) is verified.
function signTwoFactorTicket(user) {
  return jwt.sign({ id: user._id, twoFactorPending: true }, process.env.JWT_SECRET, {
    expiresIn: '10m',
  });
}

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    role: user.role,
    shop: user.shop || null,
    referralCode: user.referralCode || '',
    kyc: user.kyc || undefined,
    twoFactor:
      user.role === 'shop'
        ? { allowed: user.twoFactor?.allowed || false, enabled: user.twoFactor?.enabled || false }
        : undefined,
  };
}

function makeReferralCode(name, phone) {
  const source = `${name || 'MB'}${phone || ''}`.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const prefix = (source || 'MBUSER').slice(0, 6).padEnd(6, 'X');
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}${suffix}`;
}

async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  for (let i = 0; i < 5; i += 1) {
    const referralCode = makeReferralCode(user.name, user.phone);
    const existing = await User.findOne({ referralCode });
    if (!existing) {
      user.referralCode = referralCode;
      await user.save();
      return referralCode;
    }
  }
  user.referralCode = `${user._id.toString().slice(-8).toUpperCase()}`;
  await user.save();
  return user.referralCode;
}

function makeCouponCode(prefix) {
  return `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
}

async function createCoupon(userId, reason, amount, minOrderAmount) {
  for (let i = 0; i < 5; i += 1) {
    try {
      return await Coupon.create({
        user: userId,
        code: makeCouponCode(reason === 'referral_bonus' ? 'BONUS' : 'WELCOME'),
        amount,
        minOrderAmount,
        reason,
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  return null;
}

async function attachReferral(newUser, referralCodeOrPhone) {
  const raw = String(referralCodeOrPhone || '').trim();
  if (!raw) return;

  const referrer = await User.findOne({
    role: 'customer',
    _id: { $ne: newUser._id },
    $or: [{ referralCode: raw.toUpperCase() }, { phone: raw }],
  });
  if (!referrer) return;

  newUser.referredBy = referrer._id;
  await ensureReferralCode(newUser);
  await newUser.save();

  await ReferralTicket.findOneAndUpdate(
    { referrer: referrer._id, referred: newUser._id },
    { referrer: referrer._id, referred: newUser._id, referredPhone: newUser.phone, status: 'pending_order' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await createCoupon(newUser._id, 'welcome_referral', 50, 199);
}

async function register(req, res) {
  const { name, password, phone, address, referralCode } = req.body;
  let { email } = req.body;
  if (!name || !password || (!email && !phone)) {
    return res.status(400).json({ message: 'Name, password and an email or phone are required' });
  }
  // Allow phone-first signup: synthesise an email so the unique constraint holds.
  if (!email && phone) email = `${phone}@phone.munchbox`;

  const orQuery = [{ email: email.toLowerCase() }];
  if (phone) orQuery.push({ phone });
  const existing = await User.findOne({ $or: orQuery });
  if (existing) {
    return res.status(409).json({ message: 'An account with this email or phone already exists' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: email.toLowerCase(), password: hashed, phone, address });
  await ensureReferralCode(user);
  await attachReferral(user, referralCode);

  res.status(201).json({ user: toPublicUser(user), token: signToken(user) });
}

async function login(req, res) {
  const { email, phone, identifier, password } = req.body;
  const id = (identifier || email || phone || '').trim();
  if (!id || !password) {
    return res.status(400).json({ message: 'Email/phone and password are required' });
  }

  // An identifier containing '@' is treated as an email, otherwise as a phone number.
  const query = id.includes('@') ? { email: id.toLowerCase() } : { phone: id };
  const user = await User.findOne(query);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Shop accounts must be admin-approved before they can log in.
  if (user.role === 'shop' && user.status !== 'active') {
    if (user.status === 'rejected') {
      return res.status(403).json({ message: `Shop registration was not approved. ${user.approvalReason || ''}`.trim() });
    }
    return res.status(403).json({ message: 'Your shop is awaiting admin approval. You will be able to log in once approved.' });
  }

  // If two-factor is armed, the password alone is not enough — issue a short-lived
  // ticket and require the authenticator code to complete login.
  if (user.twoFactor?.enabled) {
    return res.json({ twoFactorRequired: true, ticket: signTwoFactorTicket(user), email: user.email });
  }

  await ensureReferralCode(user);
  res.json({ user: toPublicUser(user), token: signToken(user) });
}

// Second step of shop login: exchange the password-step ticket + authenticator code
// for a full session token.
async function verifyTwoFactorLogin(req, res) {
  const { ticket, code } = req.body;
  if (!ticket || !code) {
    return res.status(400).json({ message: 'Authenticator code is required' });
  }
  let payload;
  try {
    payload = jwt.verify(ticket, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Login session expired. Please sign in again.' });
  }
  if (!payload.twoFactorPending) {
    return res.status(400).json({ message: 'Invalid two-factor ticket' });
  }
  const user = await User.findById(payload.id);
  if (!user || !user.twoFactor?.enabled || !user.twoFactor?.secret) {
    return res.status(400).json({ message: 'Two-factor is not set up for this account' });
  }
  if (!verifyToken(code, user.twoFactor.secret)) {
    return res.status(400).json({ message: 'Incorrect authenticator code. Try the current 6-digit code.' });
  }
  await ensureReferralCode(user);
  res.json({ user: toPublicUser(user), token: signToken(user) });
}

// Sends a 6-digit OTP to a phone for passwordless customer login/signup.
// A fixed OTP used for every customer while real SMS isn't configured, so anyone can
// log in/test with one code. Real SMS (once configured) uses a random per-user code.
const FIXED_DEV_OTP = '123456';

async function requestOtp(req, res) {
  const { phone, name, referralCode } = req.body;
  if (!phone) return res.status(400).json({ message: 'phone is required' });

  const randomCode = String(Math.floor(100000 + Math.random() * 900000));
  const result = await sendOtpSms(phone, randomCode);

  // When SMS is live, use the random code; otherwise fall back to the fixed OTP.
  const code = result.sent ? randomCode : FIXED_DEV_OTP;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await Otp.findOneAndUpdate({ phone }, { phone, code, name, referralCode, expiresAt }, { upsert: true, new: true });

  const payload = { message: 'OTP sent' };
  if (!result.sent) {
    payload.devMode = true;
    payload.devCode = code; // always 123456 in dev
    // Real SMS isn't configured (or failed) — the OTP is no longer shown on any
    // screen, so this terminal line is the only way to see it for testing.
    console.log(`[dev OTP] ${phone}: ${code} (real SMS not sent — reason: ${result.reason || 'unknown'})`);
  }
  res.json(payload);
}

// Verifies the OTP and logs in. For customers, an account is created on first login.
// For delivery partners (role: 'delivery'), an existing partner is logged in; a new
// number is told to register (KYC) instead of auto-creating an account.
async function verifyOtp(req, res) {
  const { phone, code, name, role, referralCode } = req.body;
  if (!phone || !code) return res.status(400).json({ message: 'phone and code are required' });

  const otp = await Otp.findOne({ phone });
  if (!otp || otp.code !== String(code).trim() || otp.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }
  await Otp.deleteOne({ _id: otp._id });

  // Accounts are scoped by role: the SAME phone number can have a separate customer
  // account and delivery account (a delivery partner also has KYC documents). We look
  // up per-role so a customer login never returns a delivery account, and vice-versa.
  if (role === 'delivery') {
    const deliveryUser = await User.findOne({ phone, role: 'delivery' });
    if (deliveryUser) {
      await ensureReferralCode(deliveryUser);
      return res.json({ user: toPublicUser(deliveryUser), token: signToken(deliveryUser) });
    }
    // New delivery partner: proceed to registration + KYC (phone already verified).
    return res.json({ needsRegistration: true, phone });
  }

  if (role === 'shop') {
    // Shop-owner accounts must exist and be admin-approved to log in.
    const shopUser = await User.findOne({ phone, role: 'shop' });
    if (shopUser) {
      if (shopUser.status !== 'active') {
        return res.status(403).json({ message: 'Your shop is awaiting admin approval.' });
      }
      if (shopUser.twoFactor?.enabled) {
        return res.json({ twoFactorRequired: true, ticket: signTwoFactorTicket(shopUser), email: shopUser.email });
      }
      return res.json({ user: toPublicUser(shopUser), token: signToken(shopUser) });
    }
    // The admin dashboard's OTP tab serves both shop owners and the admin account, so
    // a number not registered as a shop is also checked against the admin account
    // (set via ADMIN_PHONE in .env) before giving up.
    const adminUser = await User.findOne({ phone, role: 'admin' });
    if (adminUser) {
      return res.json({ user: toPublicUser(adminUser), token: signToken(adminUser) });
    }
    return res.status(404).json({ message: 'No shop account for this number. Please contact the Munchbox admin.' });
  }

  // Customer login (default): find or create the CUSTOMER account for this phone.
  let user = await User.findOne({ phone, role: 'customer' });
  let isNewUser = false;
  if (!user) {
    const displayName = name || otp.name || `User ${phone.slice(-4)}`;
    const email = `${phone}@customer.munchbox`;
    const hashed = await bcrypt.hash(`otp-${Date.now()}-${Math.random()}`, 10);
    user = await User.create({ name: displayName, email, password: hashed, phone, role: 'customer' });
    await ensureReferralCode(user);
    await attachReferral(user, referralCode || otp.referralCode);
    isNewUser = true;
  } else if (name && !user.name) {
    user.name = name;
    await user.save();
  }
  await ensureReferralCode(user);

  res.json({ user: toPublicUser(user), token: signToken(user), isNewUser });
}

// Self-service "forgot password": verifying the same OTP used for phone login proves
// ownership of the number, then lets the user set a new password — no admin needed.
// Only works once SMS is actually configured (see admin Settings); until then this is
// the same dev-mode fallback as OTP login itself.
async function resetPasswordWithOtp(req, res) {
  const { phone, code, newPassword, role } = req.body;
  if (!phone || !code || !newPassword) {
    return res.status(400).json({ message: 'phone, code and newPassword are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const otp = await Otp.findOne({ phone });
  if (!otp || otp.code !== String(code).trim() || otp.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }
  await Otp.deleteOne({ _id: otp._id });

  // Mirrors verifyOtp's lookup: the admin dashboard's OTP tab uses role 'shop' for both
  // shop owners and the admin account (set via ADMIN_PHONE in .env), so a number not
  // registered as a shop is also checked against the admin account before giving up.
  let user;
  if (role === 'delivery') {
    user = await User.findOne({ phone, role: 'delivery' });
  } else if (role === 'shop') {
    user = await User.findOne({ phone, role: 'shop' }) || await User.findOne({ phone, role: 'admin' });
  } else {
    user = await User.findOne({ phone, role: 'customer' });
  }
  if (!user) {
    return res.status(404).json({ message: 'No account found for this number' });
  }
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: 'Password updated. You can now log in with your new password.' });
}

// Lets an already-logged-in user (typically an OTP-only customer) set a real password
// for the first time, so they have a password-login fallback if SMS ever has issues.
async function setPassword(req, res) {
  const { password } = req.body;
  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  req.user.password = await bcrypt.hash(password, 10);
  await req.user.save();
  res.json({ message: 'Password updated' });
}

async function getMe(req, res) {
  await ensureReferralCode(req.user);
  res.json({ user: toPublicUser(req.user) });
}

async function updateMe(req, res) {
  const { name, phone, address } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  if (address !== undefined) req.user.address = address;
  await req.user.save();
  res.json({ user: toPublicUser(req.user) });
}

async function createDeliveryAccount(req, res) {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, phone, role: 'delivery' });

  res.status(201).json({ user: toPublicUser(user) });
}

async function listDeliveryAccounts(req, res) {
  const users = await User.find({ role: 'delivery' })
    .select('name email phone kyc rating createdAt')
    .sort({ createdAt: -1 });
  res.json({ users });
}

async function createShopAccount(req, res) {
  const { name, email, password, phone, shop } = req.body;
  if (!name || !email || !password || !shop) {
    return res.status(400).json({ message: 'Name, email, password and shop are required' });
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, phone, role: 'shop', shop });
  res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, phone: user.phone, shop: user.shop } });
}

// Admin resets a shop owner's password — the only recovery path today, since there's
// no self-service "forgot password" flow for accounts without a phone on file.
async function resetShopPassword(req, res) {
  const { password } = req.body;
  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const user = await User.findOne({ _id: req.params.id, role: 'shop' });
  if (!user) return res.status(404).json({ message: 'Shop account not found' });
  user.password = await bcrypt.hash(password, 10);
  await user.save();
  res.json({ message: 'Password updated' });
}

async function listShopAccounts(req, res) {
  const users = await User.find({ role: 'shop' })
    .select('name email phone shop status approvalReason twoFactor.enabled twoFactor.allowed createdAt')
    .populate('shop', 'name category available deposit')
    .sort({ createdAt: -1 });
  res.json({ users });
}

// A shop owner signs THEMSELVES up from the app. The account is created 'pending'
// and cannot log in until an admin approves it. Two-factor is off by default — an
// admin must grant `twoFactor.allowed` before this shop can arm it (see
// setShopTwoFactorPermission), since some shops want it and others don't.
async function shopRegister(req, res) {
  const { name, email, password, phone, shopName, category, address, lat, lng, gstNumber, fssaiNumber, fssaiCertificateUrl } = req.body;
  if (!name || !email || !password || !shopName || !phone) {
    return res.status(400).json({ message: 'Your name, email, password, phone and shop name are required' });
  }
  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  // Map the shop onto the real map: trust supplied coordinates only if valid, else
  // geocode the typed address. Garbage coordinates cause absurd distances/fees.
  const { isValidLatLng, geocode } = require('../utils/geo');
  let shopLat = lat;
  let shopLng = lng;
  if (!isValidLatLng(shopLat, shopLng)) {
    const place = address ? await geocode(address) : null;
    if (!place) {
      return res.status(400).json({
        message:
          'Could not find your shop address on the map. Please enter a fuller address (area, city) or set the location from the map.',
      });
    }
    shopLat = place.lat;
    shopLng = place.lng;
  }

  // Create the shop in a non-operational state until approved.
  const shop = await Shop.create({
    name: shopName,
    category: ['cake', 'restaurant', 'catering'].includes(category) ? category : 'cake',
    address: address || '',
    location: { lat: Number(shopLat), lng: Number(shopLng) },
    available: false,
    subscription: { active: false, plan: 'pending', endsAt: new Date() },
    gstNumber: gstNumber || '',
    fssaiNumber: fssaiNumber || '',
    fssaiCertificateUrl: fssaiCertificateUrl || '',
  });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: String(email).toLowerCase(),
    password: hashed,
    phone,
    role: 'shop',
    shop: shop._id,
    status: 'pending',
  });

  res.status(201).json({
    message: 'Registration submitted. An admin will review and approve your shop before you can log in.',
    userId: user._id,
  });
}

// Owner starts 2FA setup from their (already logged-in) shop dashboard — only if an
// admin has granted permission for this shop (see setShopTwoFactorPermission).
async function setupTwoFactor(req, res) {
  const user = req.user;
  if (user.role !== 'shop') {
    return res.status(403).json({ message: 'Only shop accounts can set up two-factor' });
  }
  if (!user.twoFactor?.allowed) {
    return res.status(403).json({ message: 'Two-factor is not turned on for your shop. Ask the admin to enable it.' });
  }
  const { secret: pendingSecret, otpauthUrl } = generateSecret(user.email);
  user.twoFactor.pendingSecret = pendingSecret;
  await user.save();
  const qr = await qrDataUrl(otpauthUrl);
  res.json({ qr, secret: pendingSecret });
}

// Owner confirms 2FA by entering the first code from their authenticator app.
async function confirmTwoFactor(req, res) {
  const { code } = req.body;
  const user = req.user;
  if (!user.twoFactor?.allowed) {
    return res.status(403).json({ message: 'Two-factor is not turned on for your shop.' });
  }
  const secret = user.twoFactor?.pendingSecret;
  if (!secret) return res.status(400).json({ message: 'No pending two-factor setup for this account' });
  if (!verifyToken(code, secret)) {
    return res.status(400).json({ message: 'Incorrect code. Open your authenticator app and try the current 6-digit code.' });
  }
  user.twoFactor.secret = secret;
  user.twoFactor.pendingSecret = '';
  user.twoFactor.enabled = true;
  await user.save();
  res.json({ message: 'Two-factor authentication is now active for your shop.' });
}

// Admin grants or revokes a shop's permission to use two-factor login. Revoking also
// disarms any two-factor already set up, so login reverts to password/OTP right away —
// 2FA is opt-in per shop, not a blanket requirement.
async function setShopTwoFactorPermission(req, res) {
  const user = await User.findOne({ _id: req.params.id, role: 'shop' });
  if (!user) return res.status(404).json({ message: 'Shop account not found' });
  user.twoFactor.allowed = Boolean(req.body.allowed);
  if (!user.twoFactor.allowed) {
    user.twoFactor.enabled = false;
    user.twoFactor.secret = '';
    user.twoFactor.pendingSecret = '';
  }
  await user.save();
  res.json({ user: toPublicUser(user) });
}

// Admin approves or rejects a self-registered shop. On approval the admin decides,
// per shop, whether a security deposit is required before it goes live — some shops
// pay one, others the admin waives at their discretion.
async function reviewShopAccount(req, res) {
  const { action, reason, days, requireDeposit, depositAmount } = req.body; // 'approve' | 'reject'
  const user = await User.findOne({ _id: req.params.id, role: 'shop' }).populate('shop');
  if (!user) return res.status(404).json({ message: 'Shop account not found' });

  if (action === 'approve') {
    user.status = 'active';
    user.approvalReason = '';
    if (user.shop) {
      const span = Number(days) > 0 ? Number(days) : 30;
      const needsDeposit = Boolean(requireDeposit) && Number(depositAmount) > 0;
      // The owner can log in either way; only whether the shop goes LIVE differs.
      user.shop.subscription = {
        active: !needsDeposit,
        plan: user.shop.subscription?.plan === 'pending' ? 'trial' : user.shop.subscription?.plan || 'trial',
        endsAt: new Date(Date.now() + span * 24 * 60 * 60 * 1000),
      };
      if (needsDeposit) {
        // Stays hidden from customers until the owner pays via UPI and an admin
        // confirms it (see reviewTopUp), which flips deposit.paid + available.
        user.shop.deposit = { required: true, amount: Number(depositAmount), paid: false };
        user.shop.available = false;
      } else {
        user.shop.deposit = { required: false, amount: 0, paid: false };
        user.shop.available = true;
      }
      await user.shop.save();
    }
  } else if (action === 'reject') {
    user.status = 'rejected';
    user.approvalReason = reason || 'Not approved';
  } else {
    return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
  }
  await user.save();
  res.json({ user: toPublicUser(user), status: user.status });
}

// A delivery partner signs themselves up (phone-first). Account starts KYC 'pending'.
async function deliveryRegister(req, res) {
  const { name, phone, address, vehicleNumber } = req.body;
  let { email, password } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ message: 'Name and phone are required' });
  }
  // Delivery accounts use their own email namespace so the SAME phone can also have a
  // separate customer account without an email/phone collision.
  if (!email) email = `${phone}@delivery.munchbox`;
  // OTP-based partners have no password; fill the required field with a random value.
  if (!password) password = `otp-${Date.now()}-${Math.random()}`;

  // Only block if a DELIVERY account already exists for this phone/email — a customer
  // account on the same number is fine (they're separate records).
  const existing = await User.findOne({ role: 'delivery', $or: [{ email: email.toLowerCase() }, { phone }] });
  if (existing) {
    return res.status(409).json({ message: 'A delivery account with this phone already exists' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: hashed,
    phone,
    address,
    role: 'delivery',
    kyc: { status: 'pending', vehicleNumber: vehicleNumber || '', submittedAt: null },
  });
  await ensureReferralCode(user);

  res.status(201).json({ user: toPublicUser(user), token: signToken(user) });
}

// Delivery partner submits/updates their KYC document URLs (uploaded via /api/uploads).
async function submitKyc(req, res) {
  if (req.user.role !== 'delivery') {
    return res.status(403).json({ message: 'Only delivery partners submit KYC' });
  }
  const { photoUrl, aadhaarUrl, licenseUrl, rcUrl, vehicleNumber } = req.body;
  const kyc = req.user.kyc || {};
  if (photoUrl !== undefined) kyc.photoUrl = photoUrl;
  if (aadhaarUrl !== undefined) kyc.aadhaarUrl = aadhaarUrl;
  if (licenseUrl !== undefined) kyc.licenseUrl = licenseUrl;
  if (rcUrl !== undefined) kyc.rcUrl = rcUrl;
  if (vehicleNumber !== undefined) kyc.vehicleNumber = vehicleNumber;
  kyc.status = 'pending';
  kyc.submittedAt = new Date();
  req.user.kyc = kyc;
  await req.user.save();
  res.json({ user: toPublicUser(req.user) });
}

// Admin verifies or rejects a delivery partner's KYC.
async function reviewKyc(req, res) {
  const { action, reason } = req.body; // 'verify' | 'reject'
  const user = await User.findOne({ _id: req.params.id, role: 'delivery' });
  if (!user) return res.status(404).json({ message: 'Delivery partner not found' });

  if (action === 'verify') {
    user.kyc.status = 'verified';
    user.kyc.rejectionReason = '';
  } else if (action === 'reject') {
    user.kyc.status = 'rejected';
    user.kyc.rejectionReason = reason || 'Documents not acceptable';
  } else {
    return res.status(400).json({ message: "action must be 'verify' or 'reject'" });
  }
  await user.save();
  res.json({ user: toPublicUser(user) });
}

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  createDeliveryAccount,
  listDeliveryAccounts,
  createShopAccount,
  listShopAccounts,
  resetShopPassword,
  shopRegister,
  setupTwoFactor,
  confirmTwoFactor,
  setShopTwoFactorPermission,
  reviewShopAccount,
  verifyTwoFactorLogin,
  deliveryRegister,
  submitKyc,
  reviewKyc,
  requestOtp,
  verifyOtp,
  resetPasswordWithOtp,
  setPassword,
};
