import {useState} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';

export default function ShopLogin() {
  const {login, loginWithOtp, requestOtp} = useAuth();
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState('otp');
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doPasswordLogin(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await login(email, password, 'shop');
      if (result.twoFactorRequired) {
        setError('This shop has two-factor turned on — use the mobile app to sign in.');
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp(e) {
    e.preventDefault();
    if (!phone || phone.length < 10) return setError('Enter a valid phone number');
    setError('');
    setBusy(true);
    try {
      await requestOtp(phone);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    if (!code || code.length < 4) return setError('Enter the OTP');
    setError('');
    setBusy(true);
    try {
      const result = await loginWithOtp(phone, code, undefined, 'shop');
      if (result.twoFactorRequired) {
        setError('This shop has two-factor turned on — use the mobile app to sign in.');
        return;
      }
      if (result.needsRegistration) {
        setError('No shop account for this number. Register below, or sign in with email and password.');
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
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
        <div className="tab-row">
          <button className={`tab ${authMethod === 'otp' ? 'active' : ''}`} onClick={() => { setAuthMethod('otp'); setError(''); }}>OTP</button>
          <button className={`tab ${authMethod === 'password' ? 'active' : ''}`} onClick={() => { setAuthMethod('password'); setError(''); }}>Password</button>
        </div>
        {error && <p className="error">{error}</p>}

        {authMethod === 'password' ? (
          <form onSubmit={doPasswordLogin}>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        ) : step === 'phone' ? (
          <form onSubmit={sendOtp}>
            <label className="label">Phone number</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number on your shop account" />
            <button className="btn" disabled={busy}>{busy ? 'Sending...' : 'Send OTP'}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p className="muted">OTP sent to {phone}</p>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter OTP" maxLength={6} />
            <button className="btn" disabled={busy}>{busy ? 'Verifying...' : 'Verify & sign in'}</button>
            <button type="button" className="link" onClick={() => setStep('phone')}>Change number</button>
          </form>
        )}

        <Link className="link" to="/shop-register">New shop? Register here</Link>
        <Link className="link" to="/download">⬇️ Download the app</Link>
      </div>
    </div>
  );
}
