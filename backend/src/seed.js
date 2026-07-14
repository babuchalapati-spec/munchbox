require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const Shop = require('./models/Shop');
const Product = require('./models/Product');

// Two sample shops at real-ish Hyderabad coordinates, each with its own per-km rate.
const sampleShops = [
  {
    name: 'Sweet Crumbs Bakery',
    category: 'cake',
    description: 'Artisanal cakes and pastries in Madhapur.',
    address: 'Madhapur, Hyderabad',
    location: { lat: 17.4483, lng: 78.3915 },
    perKmRate: 12,
    available: true,
  },
  {
    name: 'Cocoa Loco',
    category: 'cake',
    description: 'Chocolate specialists in Gachibowli.',
    address: 'Gachibowli, Hyderabad',
    location: { lat: 17.4401, lng: 78.3489 },
    perKmRate: 15,
    available: true,
  },
  {
    name: 'Spice Junction',
    category: 'restaurant',
    description: 'North & South Indian meals, biryani and parcels.',
    address: 'Kondapur, Hyderabad',
    location: { lat: 17.4615, lng: 78.3672 },
    perKmRate: 10,
    available: true,
  },
  {
    name: 'Royal Feast Caterers',
    category: 'catering',
    description: 'Bulk catering for events, parties and functions.',
    address: 'Jubilee Hills, Hyderabad',
    location: { lat: 17.4239, lng: 78.4108 },
    perKmRate: 18,
    available: true,
  },
];

// Products keyed by shop name.
const productsByShop = {
  'Sweet Crumbs Bakery': [
    {
      name: 'Classic Chocolate Truffle',
      description: 'Rich chocolate sponge layered with chocolate truffle cream.',
      category: 'Chocolate',
      basePrice: 499,
      weightOptions: [
        { label: '0.5 kg', priceDelta: 0 },
        { label: '1 kg', priceDelta: 450 },
        { label: '2 kg', priceDelta: 950 },
      ],
      isCustomizable: true,
    },
    {
      name: 'Fresh Fruit Cake',
      description: 'Vanilla sponge topped with seasonal fresh fruits and cream.',
      category: 'Fruit',
      basePrice: 549,
      weightOptions: [
        { label: '0.5 kg', priceDelta: 0 },
        { label: '1 kg', priceDelta: 500 },
      ],
      isCustomizable: true,
    },
  ],
  'Cocoa Loco': [
    {
      name: 'Red Velvet Delight',
      description: 'Classic red velvet with cream cheese frosting.',
      category: 'Specialty',
      basePrice: 599,
      weightOptions: [
        { label: '0.5 kg', priceDelta: 0 },
        { label: '1 kg', priceDelta: 550 },
      ],
      isCustomizable: true,
    },
    {
      name: 'Black Forest',
      description: 'Chocolate sponge, cherries and whipped cream.',
      category: 'Chocolate',
      basePrice: 479,
      weightOptions: [
        { label: '0.5 kg', priceDelta: 0 },
        { label: '1 kg', priceDelta: 420 },
      ],
      isCustomizable: false,
    },
  ],
  'Spice Junction': [
    {
      name: 'Chicken Biryani',
      description: 'Hyderabadi dum biryani with raita.',
      category: 'Biryani',
      basePrice: 249,
      weightOptions: [
        { label: 'Single', priceDelta: 0 },
        { label: 'Family pack', priceDelta: 350 },
      ],
      isCustomizable: false,
    },
    {
      name: 'Veg Thali',
      description: 'Full meal with rice, roti, dal, curries and sweet.',
      category: 'Meals',
      basePrice: 179,
      weightOptions: [],
      isCustomizable: false,
    },
  ],
  'Royal Feast Caterers': [
    {
      name: 'Wedding Buffet (per plate)',
      description: 'Multi-cuisine buffet, minimum 50 plates.',
      category: 'Catering',
      basePrice: 450,
      weightOptions: [],
      isCustomizable: true,
    },
    {
      name: 'Birthday Party Package',
      description: 'Snacks, mains and dessert for parties.',
      category: 'Catering',
      basePrice: 350,
      weightOptions: [],
      isCustomizable: true,
    },
  ],
};

async function seed() {
  await connectDB();

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@munchbox.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    admin = await User.create({ name: 'Admin', email: adminEmail, password: hashed, role: 'admin' });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  for (const shopData of sampleShops) {
    let shop = await Shop.findOne({ name: shopData.name });
    if (!shop) {
      shop = await Shop.create(shopData);
      console.log(`Created shop: ${shop.name} (₹${shop.perKmRate}/km)`);
    }
    for (const product of productsByShop[shopData.name] || []) {
      const existing = await Product.findOne({ name: product.name, shop: shop._id });
      if (!existing) {
        await Product.create({ ...product, shop: shop._id, available: true });
        console.log(`  Created product: ${product.name}`);
      }
    }
  }

  // A test shop-owner account for the first shop (Sweet Crumbs Bakery).
  const ownerEmail = 'shop@munchbox.com';
  const ownerExisting = await User.findOne({ email: ownerEmail });
  if (!ownerExisting) {
    const firstShop = await Shop.findOne({ name: 'Sweet Crumbs Bakery' });
    const hashed = await bcrypt.hash('shop123', 10);
    await User.create({
      name: 'Sweet Crumbs Owner',
      email: ownerEmail,
      password: hashed,
      phone: '9111122223',
      role: 'shop',
      shop: firstShop?._id,
    });
    console.log(`Created shop-owner: ${ownerEmail} / shop123 (owns ${firstShop?.name})`);
  } else {
    console.log(`Shop-owner already exists: ${ownerEmail}`);
  }

  const deliveryEmail = 'delivery@munchbox.com';
  const deliveryExisting = await User.findOne({ email: deliveryEmail });
  if (!deliveryExisting) {
    const hashed = await bcrypt.hash('delivery123', 10);
    await User.create({
      name: 'Test Delivery Partner',
      email: deliveryEmail,
      password: hashed,
      phone: '9000000000',
      role: 'delivery',
    });
    console.log(`Created delivery user: ${deliveryEmail} / delivery123`);
  } else {
    console.log(`Delivery user already exists: ${deliveryEmail}`);
  }

  console.log('Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed', err);
  process.exit(1);
});
