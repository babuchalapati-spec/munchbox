// Single source of truth for admin navigation — the sidebar (Layout.jsx) renders these
// as links, and the Dashboard renders the same list as tiles so every page is reachable
// on mobile too, where the sidebar collapses behind a menu button.
export const ADMIN_NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', end: true, icon: '🏠', label: 'Dashboard' },
      { to: '/admin/orders', icon: '🧾', label: 'Orders' },
      { to: '/admin/live-map', icon: '🗺️', label: 'Live map' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/catering', icon: '🍽️', label: 'Catering' },
      { to: '/admin/products', icon: '🎂', label: 'Products' },
      { to: '/admin/ledger', icon: '📒', label: 'Ledger' },
      { to: '/admin/payments', icon: '💳', label: 'Payments', adminOnly: true },
    ],
  },
  {
    label: 'Business',
    adminOnly: true,
    items: [
      { to: '/admin/finance', icon: '📊', label: 'Finance' },
      { to: '/admin/shops', icon: '🏪', label: 'Shops' },
      { to: '/admin/shop-accounts', icon: '✅', label: 'Shop approvals' },
      { to: '/admin/item-approvals', icon: '📦', label: 'Item approvals' },
      { to: '/admin/delivery-accounts', icon: '🛵', label: 'Delivery partners' },
    ],
  },
  {
    label: 'System',
    adminOnly: true,
    items: [
      { to: '/admin/settings', icon: '⚙️', label: 'Settings' },
      { to: '/test-center', icon: '🧪', label: 'Test Center', external: true },
    ],
  },
];
