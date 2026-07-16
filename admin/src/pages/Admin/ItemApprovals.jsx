import { useEffect, useState } from 'react';
import { listPendingProducts, reviewProduct } from '../../api/products';
import { API_ORIGIN } from '../../api/client';

// Item images may be a local upload (/uploads/x.jpg) or an online link (https://...).
function imageSrc(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}

export default function ItemApprovals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      setItems(await listPendingProducts());
    } catch (err) {
      setError('Could not load pending items');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function decide(id, action) {
    let reason;
    if (action === 'reject') {
      reason = window.prompt('Reason for rejecting this item (shown to the shop):', 'Not suitable');
      if (reason === null) return;
    }
    setBusyId(id);
    setError('');
    try {
      await reviewProduct(id, action, reason);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Loading pending items...</p>;

  return (
    <div>
      <h1>Item approvals</h1>
      <p style={{ color: '#776b63' }}>
        Items shops add stay hidden from customers until you approve them here.
      </p>
      {error && <p style={{ color: '#c62828' }}>{error}</p>}

      {items.length === 0 ? (
        <p style={{ color: '#2e7d32', fontWeight: 600 }}>✅ Nothing waiting — all items are reviewed.</p>
      ) : (
        <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e6e0da' }}>
              <th>Photo</th>
              <th>Item</th>
              <th>Shop</th>
              <th>Category</th>
              <th>Price</th>
              <th>Add-ons</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p._id} style={{ borderBottom: '1px solid #e6e0da' }}>
                <td>
                  {imageSrc(p.imageUrl) ? (
                    <img
                      src={imageSrc(p.imageUrl)}
                      alt={p.name}
                      style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : (
                    <span style={{ color: '#776b63' }}>—</span>
                  )}
                </td>
                <td><strong>{p.name}</strong></td>
                <td>{p.shop?.name || '—'}</td>
                <td>{p.category}</td>
                <td>₹{p.basePrice}</td>
                <td style={{ color: '#776b63', fontSize: '0.85rem' }}>
                  {p.addOns?.length ? p.addOns.map((a) => `${a.name}${a.price ? ` +₹${a.price}` : ''}`).join(', ') : '—'}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => decide(p._id, 'approve')}
                    disabled={busyId === p._id}
                    style={{ background: '#2e7d32', color: '#fff', marginRight: 6 }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(p._id, 'reject')}
                    disabled={busyId === p._id}
                    style={{ background: '#c62828', color: '#fff' }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
