import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import {AuthProvider, useAuth} from './context/AuthContext';
import {CartProvider} from './context/CartContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import ShopDetail from './pages/ShopDetail';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderTracking from './pages/OrderTracking';
import Account from './pages/Account';

function Protected({children}) {
  const {user, loading} = useAuth();
  if (loading) return <div className="screen page-pad">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Routed() {
  const {loading} = useAuth();
  if (loading) return <div className="screen page-pad">Loading…</div>;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/" element={<Protected><Home /></Protected>} />
      <Route path="/shops/:id" element={<Protected><ShopDetail /></Protected>} />
      <Route path="/product/:id" element={<Protected><ProductDetail /></Protected>} />
      <Route path="/cart" element={<Protected><Cart /></Protected>} />
      <Route path="/checkout" element={<Protected><Checkout /></Protected>} />
      <Route path="/orders" element={<Protected><Orders /></Protected>} />
      <Route path="/orders/:id" element={<Protected><OrderTracking /></Protected>} />
      <Route path="/account" element={<Protected><Account /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routed />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
