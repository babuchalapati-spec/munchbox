import {useState} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import client from '../api/client';

const CATEGORIES = [
  {key: 'cake', label: '🎂 Cakes'},
  {key: 'restaurant', label: '🍔 Restaurant'},
  {key: 'catering', label: '🍽️ Catering'},
];

export default function ShopRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({name: '', email: '', password: '', phone: '', shopName: '', category: 'cake', address: ''});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({...f, [field]: value}));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.phone || !form.shopName) {
      return setError('Name, email, password, phone and shop name are required');
    }
    setError('');
    setBusy(true);
    try {
      const {data} = await client.post('/auth/shop-register', form);
      setMessage(data.message || 'Registration submitted. An admin will review and approve your shop before you can log in.');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  if (message) {
    return (
      <div className="screen">
        <div className="page-pad">
          <div className="card">
            <p style={{fontWeight: 700}}>Registration submitted ✅</p>
            <p className="muted">{message}</p>
          </div>
          <button className="btn" onClick={() => navigate('/shop-login')}>Back to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-logo">🏪</div>
        <h1>Register your shop</h1>
        <p>Start managing your menu right away</p>
      </div>
      <div className="form-card">
        {error && <p className="error">{error}</p>}
        <form onSubmit={submit}>
          <label className="label">Your name</label>
          <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} />
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          <label className="label">Password</label>
          <input className="input" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} />
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          <label className="label">Shop name</label>
          <input className="input" value={form.shopName} onChange={(e) => update('shopName', e.target.value)} />
          <label className="label">Category</label>
          <div className="tab-row">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.key} className={`tab ${form.category === c.key ? 'active' : ''}`} onClick={() => update('category', c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          <label className="label">Shop address</label>
          <textarea className="input" value={form.address} onChange={(e) => update('address', e.target.value)} rows={2} />
          <button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Register shop'}</button>
        </form>
        <Link className="link" to="/shop-login">← Back to sign in</Link>
      </div>
    </div>
  );
}
