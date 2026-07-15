import {useState} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';

export default function DeliveryLogin() {
  const {login, loginWithOtp, requestOtp} = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpStep, setOtpStep] = useState('phone');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doPasswordLogin(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await login(email, password);
      if (result.user?.role !== 'delivery') {
        setError('This account is not a delivery partner');
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
    setError('');
    setBusy(true);
    try {
      await requestOtp(phone);
      setOtpStep('code');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await loginWithOtp(phone, code, undefined, 'delivery');
      if (result.needsRegistration) {
        navigate('/delivery-register');
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-logo">🛵</div>
        <h1>Delivery partner</h1>
        <p>Claim and deliver orders</p>
      </div>
      <div className="form-card">
        <div className="tab-row">
          <button className={`tab ${mode === 'password' ? 'active' : ''}`} onClick={() => { setMode('password'); setError(''); }}>Password</button>
          <button className={`tab ${mode === 'otp' ? 'active' : ''}`} onClick={() => { setMode('otp'); setError(''); }}>OTP</button>
        </div>
        {error && <p className="error">{error}</p>}

        {mode === 'password' ? (
          <form onSubmit={doPasswordLogin}>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        ) : otpStep === 'phone' ? (
          <form onSubmit={sendOtp}>
            <label className="label">Phone number</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <p className="muted">OTP sent to {phone}</p>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
            <button className="btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify & sign in'}</button>
          </form>
        )}
        <Link className="link" to="/delivery-register">New delivery partner? Register here</Link>
        <Link className="link" to="/login">← Back to customer login</Link>
      </div>
    </div>
  );
}
