import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listOrders } from '../../api/orders';
import { listShops } from '../../api/shops';
import { listCateringRequests } from '../../api/catering';
import { listDeliveryAccounts } from '../../api/delivery';
import { ADMIN_NAV_SECTIONS } from '../../adminNav';

const CATEGORY_INFO = [
  { key: 'cake', label: 'Cakes', icon: '🎂', color: '#c2185b' },
  { key: 'restaurant', label: 'Restaurants', icon: '🍔', color: '#e65100' },
  { key: 'catering', label: 'Catering', icon: '🍽️', color: '#6a1b9a' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const [orders, shops, catering] = await Promise.all([
        listOrders().catch(() => []),
        listShops().catch(() => []),
        listCateringRequests().catch(() => []),
      ]);
      let deliveryCount = 0;
      if (isAdmin) {
        const del = await listDeliveryAccounts().catch(() => []);
        deliveryCount = del.length;
      }
      const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
      const byCategory = {};
      shops.forEach((s) => {
        byCategory[s.category] = (byCategory[s.category] || 0) + 1;
      });
      setStats({
        orders: orders.length,
        activeOrders: active,
        shops: shops.length,
        catering: catering.length,
        pendingCatering: catering.filter((c) => c.status === 'requested').length,
        deliveryCount,
        byCategory,
      });
    })();
  }, [isAdmin]);

  return (
    <div>
      <div className="dash-hero">
        <div>
          <h1>Welcome to Munchbox {isAdmin ? 'Admin' : 'Shop'}</h1>
          <p>
            {isAdmin
              ? 'Manage cakes, restaurants and catering across every shop — orders, deliveries, subscriptions and more, all in one place.'
              : 'Manage your shop — orders, menu and catering requests.'}
          </p>
        </div>
        <div className="dash-hero-icon">🍱</div>
      </div>

      <div className="dash-categories">
        {CATEGORY_INFO.map((c) => (
          <div key={c.key} className="dash-cat" style={{ borderTopColor: c.color }}>
            <span className="dash-cat-icon">{c.icon}</span>
            <div>
              <strong>{c.label}</strong>
              <div className="muted">{stats?.byCategory?.[c.key] || 0} shop(s)</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-stats">
        <button className="stat-tile" onClick={() => navigate('/admin/orders')}>
          <span className="stat-num">{stats ? stats.activeOrders : '—'}</span>
          <span className="stat-label">Active orders</span>
        </button>
        <button className="stat-tile" onClick={() => navigate('/admin/orders')}>
          <span className="stat-num">{stats ? stats.orders : '—'}</span>
          <span className="stat-label">Total orders</span>
        </button>
        <button className="stat-tile" onClick={() => navigate('/admin/catering')}>
          <span className="stat-num">{stats ? stats.pendingCatering : '—'}</span>
          <span className="stat-label">Catering to quote</span>
        </button>
        {isAdmin && (
          <button className="stat-tile" onClick={() => navigate('/admin/shops')}>
            <span className="stat-num">{stats ? stats.shops : '—'}</span>
            <span className="stat-label">Shops</span>
          </button>
        )}
        {isAdmin && (
          <button className="stat-tile" onClick={() => navigate('/admin/delivery-accounts')}>
            <span className="stat-num">{stats ? stats.deliveryCount : '—'}</span>
            <span className="stat-label">Delivery partners</span>
          </button>
        )}
      </div>

      {/* Mirrors the sidebar nav as tappable tiles — the sidebar collapses behind a menu
          button on mobile, so this is how a phone reaches every page without it. */}
      <h2 className="dash-section-title">Manage</h2>
      <div className="dash-nav-grid">
        {ADMIN_NAV_SECTIONS.map((section) => {
          if (section.adminOnly && !isAdmin) return null;
          const visibleItems = section.items.filter((item) => item.to !== '/admin' && (!item.adminOnly || isAdmin));
          if (!visibleItems.length) return null;
          return visibleItems.map((item) =>
            item.external ? (
              <a key={item.to} href={item.to} target="_blank" rel="noopener noreferrer" className="nav-tile">
                <span className="nav-tile-icon">{item.icon}</span>
                <span className="nav-tile-label">{item.label}</span>
              </a>
            ) : (
              <button key={item.to} className="nav-tile" onClick={() => navigate(item.to)}>
                <span className="nav-tile-icon">{item.icon}</span>
                <span className="nav-tile-label">{item.label}</span>
              </button>
            )
          );
        })}
      </div>
    </div>
  );
}
