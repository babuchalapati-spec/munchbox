import {useState} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';

export default function Register() {
  const {register} = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({name: '', address: '', phone: '', password: ''});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({...f, [field]: value}));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.password) return setError('Name, phone number and password are required');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-logo">🍰</div>
        <h1>Create account</h1>
        <p>Join Munchbox in a minute</p>
      </div>
      <div className="form-card">
        {error && <p className="error">{error}</p>}
        <form onSubmit={submit}>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Your full name" />
          <label className="label">Phone number</label>
          <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Phone number" />
          <label className="label">Address</label>
          <textarea className="input" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Flat, street, city, pincode (optional)" rows={3} />
          <label className="label">Password</label>
          <input className="input" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Create a password" />
          <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
        <Link className="link" to="/login">Already have an account? Sign in</Link>
      </div>
    </div>
  );
}
