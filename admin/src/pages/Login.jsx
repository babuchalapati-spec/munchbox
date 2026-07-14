import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestOtp } from '../api/auth';

export default function Login() {
  const { login, loginWithOtp, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // OTP
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpStep, setOtpStep] = useState('phone');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Two-factor (authenticator code) — second step after password or OTP, if enabled.
  const [twoFa, setTwoFa] = useState(null); // { ticket, email }
  const [twoFaCode, setTwoFaCode] = useState('');

  async function handlePassword(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await login(email, password);
      if (res.twoFactorRequired) {
        setTwoFa({ ticket: res.ticket, email: res.email });
      } else {
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyTwoFa(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await verifyTwoFactor(twoFa.ticket, twoFaCode.trim());
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid code');
    } finally {
      setSubmitting(false);
    }
  }

  async function sendOtp(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await requestOtp(phone);
      setOtpStep('code');
      // Dev-mode OTP (only present when real SMS isn't configured yet) goes to the
      // browser console only — never shown on the page itself.
      if (res.devMode && res.devCode) console.log(`[dev OTP] ${phone}: ${res.devCode}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtpSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await loginWithOtp(phone, code);
      if (res.twoFactorRequired) {
        setTwoFa({ ticket: res.ticket, email: res.email });
      } else {
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-split">
      <div className="login-hero">
        <div className="login-hero-mark">🍱</div>
        <h1>Munchbox</h1>
        <p>Cakes · Restaurants · Catering — delivered.</p>
        <ul className="login-hero-list">
          <li>🎂 Manage every shop and menu</li>
          <li>🛵 Track orders and live deliveries</li>
          <li>🍽️ Quote and confirm catering</li>
          <li>🔒 Subscriptions and access control</li>
        </ul>
      </div>
      <div className="login-form-side">
        <div className="login-form">
          <h2>Sign in</h2>
          <p className="login-sub">Admin & shop owner portal</p>

          {!twoFa && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => { setMode('password'); setError(''); }}
                style={{ flex: 1, opacity: mode === 'password' ? 1 : 0.6 }}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setMode('otp'); setError(''); }}
                style={{ flex: 1, opacity: mode === 'otp' ? 1 : 0.6 }}
              >
                OTP (shop owner)
              </button>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          {twoFa ? (
            <form onSubmit={handleVerifyTwoFa} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="login-sub">
                Two-factor is enabled for {twoFa.email}. Enter the 6-digit code from your authenticator app.
              </p>
              <label>
                Authenticator code
                <input
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  maxLength={6}
                  autoFocus
                  required
                />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify & sign in'}
              </button>
              <button
                type="button"
                onClick={() => { setTwoFa(null); setTwoFaCode(''); setError(''); }}
                style={{ background: 'transparent', color: '#c2185b' }}
              >
                ← Back
              </button>
            </form>
          ) : mode === 'password' ? (
            <form onSubmit={handlePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          ) : otpStep === 'phone' ? (
            <form onSubmit={sendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                Shop phone number
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="login-sub">OTP sent to {phone}</p>
              <label>
                Enter OTP
                <input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify & sign in'}
              </button>
              <button type="button" onClick={() => setOtpStep('phone')} style={{ background: 'transparent', color: '#c2185b' }}>
                Change number
              </button>
            </form>
          )}

          <p style={{ marginTop: 20 }}>
            <Link to="/customer-test">Testing the customer app? Try customer login →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
