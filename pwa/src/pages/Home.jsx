import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import client, {imageUri} from '../api/client';
import {useAuth} from '../context/AuthContext';
import {useCart} from '../context/CartContext';
import {categoryThemes} from '../theme';
import BottomNav from '../components/BottomNav';

export default function Home() {
  const {user} = useAuth();
  const {items} = useCart();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const firstName = (user?.name || '').trim().split(' ')[0];

  useEffect(() => {
    // Only shops within ~15km show up (server-enforced) once we have a location fix; if
    // permission is denied or geolocation is unavailable, fall back to the unfiltered list
    // rather than blocking the page on it.
    function loadShops(location) {
      client
        .get('/shops', {params: location ? {lat: location.lat, lng: location.lng} : {}})
        .then(({data}) => setShops(data.shops))
        .catch(() => setShops([]))
        .finally(() => setLoading(false));
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadShops({lat: pos.coords.latitude, lng: pos.coords.longitude}),
        () => loadShops(null),
        {timeout: 8000}
      );
    } else {
      loadShops(null);
    }
  }, []);

  const filtered = category ? shops.filter((s) => s.category === category) : shops;

  return (
    <div className="screen">
      <div className="hero" style={{borderRadius: '0 0 24px 24px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{textAlign: 'left'}}>
            <div style={{fontWeight: 800, fontSize: 18}}>🍰 Munchbox</div>
            {firstName && <div style={{fontSize: 13, marginTop: 2}}>Hi, {firstName} 👋</div>}
          </div>
          <Link to="/cart" style={{position: 'relative', background: 'rgba(255,255,255,0.22)', borderRadius: 20, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            🛒
            {items.length > 0 && (
              <span style={{position: 'absolute', top: -4, right: -4, background: '#fff', color: '#c2185b', borderRadius: 10, fontSize: 11, fontWeight: 800, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                {items.length}
              </span>
            )}
          </Link>
        </div>
        <p style={{textAlign: 'left', fontSize: 20, fontWeight: 800, marginTop: 16}}>Cakes, food and catering delivered to your door.</p>
      </div>

      <div className="page-pad" style={{flex: 1}}>
        <div className="tab-row">
          <button className={`tab ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>All</button>
          {Object.entries(categoryThemes).map(([key, t]) => (
            <button key={key} className={`tab ${category === key ? 'active' : ''}`} onClick={() => setCategory(key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">Loading shops…</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No shops here yet.</p>
        ) : (
          filtered.map((shop) => (
            <Link to={`/shops/${shop._id}`} key={shop._id} className="card" style={{display: 'flex', gap: 12, alignItems: 'center'}}>
              <div style={{width: 56, height: 56, borderRadius: 10, background: categoryThemes[shop.category]?.soft || '#fce4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, overflow: 'hidden'}}>
                {shop.imageUrl ? <img src={imageUri(shop.imageUrl)} alt="" onError={(e) => { e.target.style.display = 'none'; }} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : (categoryThemes[shop.category]?.icon || '🏪')}
              </div>
              <div style={{flex: 1}}>
                <div style={{fontWeight: 700}}>{shop.name}</div>
                <div className="muted">{categoryThemes[shop.category]?.label || shop.category}</div>
                {!shop.available && <div style={{color: '#c62828', fontSize: 12, marginTop: 2}}>Currently closed</div>}
              </div>
            </Link>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}
