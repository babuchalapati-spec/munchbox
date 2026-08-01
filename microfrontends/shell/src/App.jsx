import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';

// Lazy-loaded across the network from orders-mf's own deployment — this import only
// resolves at runtime, via the remoteEntry.js URL configured in vite.config.js. Adding
// shops-mf/finance-mf/etc. later is one more lazy() + one more <Route>, same pattern.
const OrdersApp = lazy(() => import('orders_mf/OrdersApp'));

function Placeholder({ name }) {
  return (
    <div style={{ padding: '1.5rem', color: '#776b63' }}>
      <h2 style={{ color: '#2c2420' }}>{name}</h2>
      <p>
        Not scaffolded as a running micro-frontend yet — see{' '}
        <code>microfrontends/{name.toLowerCase().replace(/\s/g, '-')}/README.md</code> for
        the plan. <code>orders-mf</code> is the one fully wired example proving the pattern.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <nav style={{ width: 200, padding: '1rem', borderRight: '1px solid #e6e0da' }}>
          <h3 style={{ marginTop: 0 }}>Munchbox</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <NavLink to="/orders">Orders</NavLink>
            <NavLink to="/shops">Shops</NavLink>
            <NavLink to="/delivery">Delivery</NavLink>
            <NavLink to="/finance">Finance</NavLink>
            <NavLink to="/catering">Catering</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </div>
        </nav>
        <main style={{ flex: 1 }}>
          <Suspense fallback={<div style={{ padding: '1.5rem' }}>Loading module…</div>}>
            <Routes>
              <Route path="/orders" element={<OrdersApp />} />
              <Route path="/shops" element={<Placeholder name="Shops" />} />
              <Route path="/delivery" element={<Placeholder name="Delivery" />} />
              <Route path="/finance" element={<Placeholder name="Finance" />} />
              <Route path="/catering" element={<Placeholder name="Catering" />} />
              <Route path="/settings" element={<Placeholder name="Settings" />} />
              <Route path="*" element={<OrdersApp />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
