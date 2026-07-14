import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import CustomerLoginTest from './pages/CustomerLoginTest';
import DeliveryTest from './pages/DeliveryTest';
import ShopTest from './pages/ShopTest';
import TestCenter from './pages/TestCenter';
import Layout from './pages/Admin/Layout';
import Dashboard from './pages/Admin/Dashboard';
import Products from './pages/Admin/Products';
import Orders from './pages/Admin/Orders';
import Shops from './pages/Admin/Shops';
import Catering from './pages/Admin/Catering';
import DeliveryAccounts from './pages/Admin/DeliveryAccounts';
import ShopAccounts from './pages/Admin/ShopAccounts';
import Payments from './pages/Admin/Payments';
import Ledger from './pages/Admin/Ledger';
import Finance from './pages/Admin/Finance';
import ItemApprovals from './pages/Admin/ItemApprovals';
import Settings from './pages/Admin/Settings';
import LiveMap from './pages/Admin/LiveMap';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/customer-test" element={<CustomerLoginTest />} />
          <Route path="/delivery-test" element={<DeliveryTest />} />
          <Route path="/shop-test" element={<ShopTest />} />
          <Route path="/test-center" element={<TestCenter />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="live-map" element={<LiveMap />} />
            <Route path="shops" element={<Shops />} />
            <Route path="catering" element={<Catering />} />
            <Route path="products" element={<Products />} />
            <Route path="delivery-accounts" element={<DeliveryAccounts />} />
            <Route path="shop-accounts" element={<ShopAccounts />} />
            <Route path="item-approvals" element={<ItemApprovals />} />
            <Route path="payments" element={<Payments />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="finance" element={<Finance />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
