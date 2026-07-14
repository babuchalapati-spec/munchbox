import { useEffect, useState } from 'react';
import { listShops, createShop, updateShop, deleteShop, updateSubscription } from '../../api/shops';

function subLabel(shop) {
  const ends = shop.subscription?.endsAt ? new Date(shop.subscription.endsAt) : null;
  const active = shop.subscription?.active && ends && ends > new Date();
  if (active) return { text: `Active till ${ends.toLocaleDateString()}`, ok: true };
  return { text: ends ? `Expired ${ends.toLocaleDateString()}` : 'No subscription', ok: false };
}

const CATEGORIES = ['cake', 'restaurant', 'catering'];
const emptyForm = { name: '', category: 'cake', description: '', address: '', lat: '', lng: '', perKmRate: '12', available: true };

export default function Shops() {
  const [shops, setShops] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setShops(await listShops());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  function startEdit(shop) {
    setEditingId(shop._id);
    setForm({
      name: shop.name,
      category: shop.category || 'cake',
      description: shop.description || '',
      address: shop.address || '',
      lat: String(shop.location.lat),
      lng: String(shop.location.lng),
      perKmRate: String(shop.perKmRate),
      available: shop.available,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name,
      category: form.category,
      description: form.description,
      address: form.address,
      lat: Number(form.lat),
      lng: Number(form.lng),
      perKmRate: Number(form.perKmRate),
      available: form.available,
    };
    try {
      if (editingId) await updateShop(editingId, payload);
      else await createShop(payload);
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this shop? Its products will remain but be orphaned.')) return;
    await deleteShop(id);
    await refresh();
  }

  async function extend(id, days) {
    const updated = await updateSubscription(id, { extendDays: days });
    setShops((prev) => prev.map((s) => (s._id === id ? updated : s)));
  }

  async function toggleActive(shop) {
    const updated = await updateSubscription(shop._id, { active: !shop.subscription?.active });
    setShops((prev) => prev.map((s) => (s._id === shop._id ? updated : s)));
  }

  return (
    <div>
      <h1>Shops</h1>

      <form className="card form" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit shop' : 'New shop'}</h2>
        {error && <p className="error">{error}</p>}
        <div className="form-grid">
          <label>
            Name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>
            Category
            <select name="category" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Address
            <input name="address" value={form.address} onChange={handleChange} />
          </label>
          <label>
            Latitude
            <input name="lat" type="number" step="any" value={form.lat} onChange={handleChange} required />
          </label>
          <label>
            Longitude
            <input name="lng" type="number" step="any" value={form.lng} onChange={handleChange} required />
          </label>
          <label>
            Delivery rate (₹ / km)
            <input name="perKmRate" type="number" min="0" step="any" value={form.perKmRate} onChange={handleChange} required />
          </label>
          <label className="checkbox">
            <input name="available" type="checkbox" checked={form.available} onChange={handleChange} />
            Open for orders
          </label>
        </div>
        <label>
          Description
          <textarea name="description" value={form.description} onChange={handleChange} rows={2} />
        </label>
        <div className="form-actions">
          <button type="submit">{editingId ? 'Save changes' : 'Create shop'}</button>
          {editingId && (
            <button type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Subscription</th>
              <th>₹/km</th>
              <th>Open</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{s.category}</td>
                <td>
                  <span style={{ color: subLabel(s).ok ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                    {subLabel(s).text}
                  </span>
                  <div className="row-actions" style={{ marginTop: 4 }}>
                    <button onClick={() => extend(s._id, 30)}>+30 days</button>
                    <button onClick={() => toggleActive(s)}>
                      {s.subscription?.active ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                </td>
                <td>₹{s.perKmRate}</td>
                <td>{s.available ? 'Yes' : 'No'}</td>
                <td className="row-actions">
                  <button onClick={() => startEdit(s)}>Edit</button>
                  <button onClick={() => handleDelete(s._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
