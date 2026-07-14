require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const shopRoutes = require('./routes/shopRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cateringRoutes = require('./routes/cateringRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const appRoutes = require('./routes/appRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const geoRoutes = require('./routes/geoRoutes');
const financeRoutes = require('./routes/financeRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// Serves published APKs for in-app auto-update.
app.use('/downloads', express.static(path.join(__dirname, '..', 'downloads')));

// Diagnostic: record every failing request (4xx/5xx) to a file so we can see exactly
// what the phone app sent and why it was rejected.
const fs = require('fs');
const DIAG_LOG = path.join(__dirname, '..', 'diag.log');
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    // Log every request (skip noisy static/version polling) so we can see whether the
    // phone is reaching the server at all, and what it sends.
    if (req.originalUrl.startsWith('/downloads') || req.originalUrl.startsWith('/api/app/version')) return;
    const line = [
      new Date().toISOString(),
      `ip=${(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').replace('::ffff:', '')}`,
      `${req.method} ${req.originalUrl}`,
      `-> ${res.statusCode}`,
      `auth=${req.headers.authorization ? 'yes' : 'NO'}`,
      `body=${JSON.stringify(req.body || {}).slice(0, 250)}`,
    ].join(' | ');
    fs.appendFile(DIAG_LOG, line + '\n', () => {});
  });
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/catering', cateringRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/app', appRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/payments', paymentRoutes);

app.use(notFound);
app.use(errorHandler);

async function ensureAdminUser() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@munchbox.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    admin = await User.create({ name: 'Admin', email: adminEmail, password: hashed, role: 'admin' });
    console.log(`Created admin user: ${adminEmail}`);
    return;
  }

  let changed = false;
  if (admin.email !== adminEmail) {
    admin.email = adminEmail;
    changed = true;
  }
  if (admin.role !== 'admin') {
    admin.role = 'admin';
    changed = true;
  }
  const passwordMatches = await bcrypt.compare(adminPassword, admin.password);
  if (!passwordMatches) {
    admin.password = await bcrypt.hash(adminPassword, 10);
    changed = true;
  }
  if (changed) {
    await admin.save();
  }

  console.log(`Admin user ready: ${adminEmail}`);
}

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    await ensureAdminUser();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

module.exports = app;
