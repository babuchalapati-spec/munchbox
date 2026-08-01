import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Login from './Login.jsx';

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
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <nav style={{ width: 200, padding: '1rem', borderRight: '1px solid #e6e0da', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginTop: 0 }}>Munchbox</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <NavLink to="/orders">Orders</NavLink>
            <NavLink to="/shops">Shops</NavLink>
            <NavLink to="/delivery">Delivery</NavLink>
            <NavLink to="/finance">Finance</NavLink>
            <NavLink to="/catering">Catering</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </div>
          <button onClick={logout} style={{ padding: 8, background: 'none', border: '1px solid #e6e0da', borderRadius: 8, cursor: 'pointer' }}>
            Log out
          </button>
        </nav>
        <main style={{ flex: 1 }}>
          <Suspense fallback={<div style={{ padding: '1.5rem' }}>Loading module…</div>}>
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
