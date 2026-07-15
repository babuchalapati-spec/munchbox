import {useEffect, useState} from 'react';
import {useParams, useNavigate, Link} from 'react-router-dom';
import client, {imageUri} from '../api/client';

export default function ShopDetail() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([client.get(`/shops/${id}`), client.get('/products', {params: {shop: id}})])
      .then(([shopRes, productsRes]) => {
        setShop(shopRes.data.shop);
        setProducts(productsRes.data.products);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="screen page-pad">Loading…</div>;
  if (!shop) return <div className="screen page-pad">Shop not found.</div>;

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{shop.name}</h2>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        {!shop.available && <p className="error">This shop isn't accepting orders right now.</p>}
        {products.length === 0 ? (
          <p className="muted">Nothing available at this shop yet.</p>
        ) : (
          products.map((p) => (
            <Link to={`/product/${p._id}`} key={p._id} className="card" style={{display: 'flex', gap: 12, alignItems: 'center', opacity: p.available ? 1 : 0.6}}>
              <div style={{width: 56, height: 56, borderRadius: 10, background: '#f6f3f0', flexShrink: 0, overflow: 'hidden'}}>
                {p.imageUrl && <img src={imageUri(p.imageUrl)} alt="" onError={(e) => { e.target.style.display = 'none'; }} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
              </div>
              <div style={{flex: 1}}>
                <div style={{fontWeight: 700}}>{p.name}</div>
                <div className="muted">₹{p.basePrice}</div>
                {!p.available && <div style={{color: '#c62828', fontSize: 12}}>Out of stock</div>}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
