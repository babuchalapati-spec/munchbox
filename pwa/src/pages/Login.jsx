import {useState} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';

export default function Login() {
  const {login, loginWithOtp, requestOtp} = useAuth();
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState('otp');
  const [step, setStep] = useState('phone');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doPasswordLogin(e) {
    e.preventDefault();
    if (!phone || !password) return setError('Enter your phone number and password');
    setError('');
    setBusy(true);
    try {
      await login(phone, password, 'customer');
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
      await requestOtp(phone, name);
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
      await loginWithOtp(phone, code, name);
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
        <div className="hero-logo">🍰</div>
        <h1>Munchbox</h1>
        <p>Cakes, food & catering - delivered warm</p>
      </div>
      <div className="form-card">
        <div className="tab-row">
          <button className={`tab ${authMethod === 'otp' ? 'active' : ''}`} onClick={() => { setAuthMethod('otp'); setError(''); }}>OTP</button>
          <button className={`tab ${authMethod === 'password' ? 'active' : ''}`} onClick={() => { setAuthMethod('password'); setError(''); }}>Password</button>
        </div>
        {error && <p className="error">{error}</p>}

        {authMethod === 'password' ? (
          <form onSubmit={doPasswordLogin}>
            <label className="label">Phone number</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
            <button className="btn" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
            <Link className="link" to="/forgot-password">Forgot password?</Link>
          </form>
        ) : step === 'phone' ? (
          <form onSubmit={sendOtp}>
            <label className="label">Phone number</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            <label className="label">Your name (optional)</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <button className="btn" disabled={busy}>{busy ? 'Sending...' : 'Send OTP'}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p className="muted">OTP sent to {phone}</p>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter OTP" maxLength={6} />
            <button className="btn" disabled={busy}>{busy ? 'Verifying...' : 'Verify & continue'}</button>
            <button type="button" className="link" onClick={() => setStep('phone')}>Change number</button>
          </form>
        )}

        <Link className="link" to="/register">New here? Create an account</Link>
        <Link className="link" to="/download" style={{display: 'block', textAlign: 'center', marginTop: 14}}>Download the app</Link>
      </div>
    </div>
  );
}
