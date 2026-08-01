import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';

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
