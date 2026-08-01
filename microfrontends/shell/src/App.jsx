import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Login from './Login.jsx';

const NAV = [
  { to: '/orders', icon: '🧾', label: 'Orders' },
  { to: '/shops', icon: '🏪', label: 'Shops' },
  { to: '/delivery', icon: '🛵', label: 'Delivery' },
  { to: '/finance', icon: '📒', label: 'Finance' },
  { to: '/catering', icon: '🍽️', label: 'Catering' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];

// Each lazy-loaded across the network from that module's own deployment — these imports
// only resolve at runtime, via the remoteEntry.js URLs configured in vite.config.js.
// Every one of the six admin domains is now an independently buildable, independently
// deployable module; shipping a change to finance-mf never requires rebuilding this
// shell or any other module.
const OrdersApp = lazy(() => import('orders_mf/OrdersApp'));
const ShopsApp = lazy(() => import('shops_mf/ShopsApp'));
const DeliveryApp = lazy(() => import('delivery_mf/DeliveryApp'));
const FinanceApp = lazy(() => import('finance_mf/FinanceApp'));
const CateringApp = lazy(() => import('catering_mf/CateringApp'));
const SettingsApp = lazy(() => import('settings_mf/SettingsApp'));

const TOKEN_KEY = 'munchbox_admin_token';

export default function App() {
  // Every module reads this same localStorage key directly (see e.g.
  // shops-mf/src/App.jsx) rather than the shell passing the token down as a prop —
  // that's deliberate: a module works identically whether the shell loaded it or it's
  // running standalone in its own `npm run dev`, which is the whole point of the
  // pattern (ARCHITECTURE.md §7).
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  if (!token) {
    return <Login onLoggedIn={setToken} />;
  }

  return (
    <BrowserRouter>
      <div className="admin-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">🍰</div>
            <h2>Munchbox</h2>
          </div>
          <nav>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button onClick={logout}>Log out</button>
          </div>
        </aside>
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Suspense fallback={<div className="skeleton-row" style={{ maxWidth: 400 }} />}>
            <Routes>
              <Route path="/orders" element={<OrdersApp />} />
              <Route path="/shops" element={<ShopsApp />} />
              <Route path="/delivery" element={<DeliveryApp />} />
              <Route path="/finance" element={<FinanceApp />} />
              <Route path="/catering" element={<CateringApp />} />
              <Route path="/settings" element={<SettingsApp />} />
              <Route path="*" element={<OrdersApp />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
