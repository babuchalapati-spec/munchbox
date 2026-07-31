import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_NAV_SECTIONS } from '../../adminNav';

export default function Layout() {
  const { user, logout, subscriptionExpired } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);

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
      <aside className={`sidebar${menuOpen ? ' menu-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">🍰</div>
          <h2>Munchbox {isAdmin ? 'Admin' : 'Shop'}</h2>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
        <nav onClick={() => setMenuOpen(false)}>
          {ADMIN_NAV_SECTIONS.map((section) => {
            if (section.adminOnly && !isAdmin) return null;
            const items = section.items.filter((item) => !item.adminOnly || isAdmin);
            if (!items.length) return null;
            return (
              <div key={section.label}>
                <div className="sidebar-group-label">{section.label}</div>
                {items.map((item) =>
                  item.external ? (
                    <a key={item.to} href={item.to} target="_blank" rel="noopener noreferrer">
                      <span className="nav-icon">{item.icon}</span>{item.label}
                    </a>
                  ) : (
                    <NavLink key={item.to} to={item.to} end={item.end}>
                      <span className="nav-icon">{item.icon}</span>{item.label}
                    </NavLink>
                  )
                )}
              </div>
            );
          })}
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
