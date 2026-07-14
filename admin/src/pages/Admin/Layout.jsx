import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Layout() {
  const { user, logout, subscriptionExpired } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (subscriptionExpired && user?.role === 'shop') {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <h1>Subscription expired</h1>
          <p>
            Your Munchbox shop subscription has ended, so your shop is paused and hidden from customers. Renew to start
            taking orders again.
          </p>
          <a className="pay-link" href="#renew" onClick={(e) => e.preventDefault()}>
            Renew subscription (payment link)
          </a>
          <p className="lock-note">
            Online payment will be enabled once the Razorpay keys are configured. Until then, contact the Munchbox admin
            to renew.
          </p>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">🍰</div>
          <h2>Munchbox {isAdmin ? 'Admin' : 'Shop'}</h2>
        </div>
        <nav>
          <NavLink to="/admin" end>Dashboard</NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
          <NavLink to="/admin/live-map">Live map</NavLink>
          <NavLink to="/admin/catering">Catering</NavLink>
          <NavLink to="/admin/products">Products</NavLink>
          <NavLink to="/admin/ledger">Ledger</NavLink>
          {isAdmin && <NavLink to="/admin/finance">Finance</NavLink>}
          {isAdmin && <NavLink to="/admin/shops">Shops</NavLink>}
          {isAdmin && <NavLink to="/admin/shop-accounts">Shop approvals</NavLink>}
          {isAdmin && <NavLink to="/admin/item-approvals">Item approvals</NavLink>}
          {isAdmin && <NavLink to="/admin/payments">Payments</NavLink>}
          {isAdmin && <NavLink to="/admin/delivery-accounts">Delivery partners</NavLink>}
          {isAdmin && <NavLink to="/admin/settings">Settings</NavLink>}
          {isAdmin && (
            <a href="/test-center" target="_blank" rel="noopener noreferrer">
              🧪 Test Center
            </a>
          )}
        </nav>
        <div className="sidebar-footer">
          <p>{user?.name}</p>
          <p className="role-tag">{isAdmin ? 'Administrator' : 'Shop owner'}</p>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
