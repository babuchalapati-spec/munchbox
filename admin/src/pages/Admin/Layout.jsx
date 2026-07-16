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
          <div className="sidebar-group-label">Overview</div>
          <NavLink to="/admin" end><span className="nav-icon">🏠</span>Dashboard</NavLink>
          <NavLink to="/admin/orders"><span className="nav-icon">🧾</span>Orders</NavLink>
          <NavLink to="/admin/live-map"><span className="nav-icon">🗺️</span>Live map</NavLink>

          <div className="sidebar-group-label">Operations</div>
          <NavLink to="/admin/catering"><span className="nav-icon">🍽️</span>Catering</NavLink>
          <NavLink to="/admin/products"><span className="nav-icon">🎂</span>Products</NavLink>
          <NavLink to="/admin/ledger"><span className="nav-icon">📒</span>Ledger</NavLink>
          {isAdmin && <NavLink to="/admin/payments"><span className="nav-icon">💳</span>Payments</NavLink>}

          {isAdmin && (
            <>
              <div className="sidebar-group-label">Business</div>
              <NavLink to="/admin/finance"><span className="nav-icon">📊</span>Finance</NavLink>
              <NavLink to="/admin/shops"><span className="nav-icon">🏪</span>Shops</NavLink>
              <NavLink to="/admin/shop-accounts"><span className="nav-icon">✅</span>Shop approvals</NavLink>
              <NavLink to="/admin/item-approvals"><span className="nav-icon">📦</span>Item approvals</NavLink>
              <NavLink to="/admin/delivery-accounts"><span className="nav-icon">🛵</span>Delivery partners</NavLink>
            </>
          )}

          {isAdmin && (
            <>
              <div className="sidebar-group-label">System</div>
              <NavLink to="/admin/settings"><span className="nav-icon">⚙️</span>Settings</NavLink>
              <a href="/test-center" target="_blank" rel="noopener noreferrer">
                <span className="nav-icon">🧪</span>Test Center
              </a>
            </>
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
