import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import {AuthProvider, useAuth} from './context/AuthContext';
import {CartProvider} from './context/CartContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ShopLogin from './pages/ShopLogin';
import DeliveryLogin from './pages/DeliveryLogin';
import Home from './pages/Home';
import ShopDashboard from './pages/ShopDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';
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

// Landing route ("/") shows a different app entirely depending on who's logged in —
// same idea as the mobile app's RootNavigator switching stacks by role.
function RoleHome() {
  const {user} = useAuth();
  if (user.role === 'shop') return <ShopDashboard />;
  if (user.role === 'delivery') return <DeliveryDashboard />;
  return <Home />;
}

function CustomerOnly({children}) {
  const {user} = useAuth();
  if (user.role !== 'customer') return <Navigate to="/" replace />;
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
      <Route path="/shop-login" element={<ShopLogin />} />
      <Route path="/delivery-login" element={<DeliveryLogin />} />
      <Route path="/" element={<Protected><RoleHome /></Protected>} />
      <Route path="/shops/:id" element={<Protected><CustomerOnly><ShopDetail /></CustomerOnly></Protected>} />
      <Route path="/product/:id" element={<Protected><CustomerOnly><ProductDetail /></CustomerOnly></Protected>} />
      <Route path="/cart" element={<Protected><CustomerOnly><Cart /></CustomerOnly></Protected>} />
      <Route path="/checkout" element={<Protected><CustomerOnly><Checkout /></CustomerOnly></Protected>} />
      <Route path="/orders" element={<Protected><CustomerOnly><Orders /></CustomerOnly></Protected>} />
      <Route path="/orders/:id" element={<Protected><OrderTracking /></Protected>} />
      <Route path="/account" element={<Protected><CustomerOnly><Account /></CustomerOnly></Protected>} />
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
