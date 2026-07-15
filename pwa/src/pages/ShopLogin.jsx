import {useState} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';

export default function ShopLogin() {
  const {login} = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await login(email, password);
      if (result.twoFactorRequired) {
        setError('This shop has two-factor turned on — use the mobile app to sign in.');
        return;
      }
      if (result.user?.role !== 'shop') {
        setError('This account is not a shop owner');
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-logo">🏪</div>
        <h1>Shop owner</h1>
        <p>Manage your menu, orders & earnings</p>
      </div>
      <div className="form-card">
        {error && <p className="error">{error}</p>}
        <form onSubmit={submit}>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <Link className="link" to="/shop-register">New shop? Register here</Link>
        <Link className="link" to="/login">← Back to customer login</Link>
      </div>
    </div>
  );
}
