import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestOtp, resetPasswordWithOtp } from '../api/auth';

export default function Login() {
  const { login, loginWithOtp, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('password'); // 'password' | 'otp' | 'forgot'
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
  // Forgot password (OTP-only — resets whichever account, shop or admin, owns this phone)
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState('phone'); // 'phone' | 'reset' | 'done'

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

  async function sendForgotOtp(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await requestOtp(forgotPhone);
      setForgotStep('reset');
      if (res.devMode && res.devCode) console.log(`[dev OTP] ${forgotPhone}: ${res.devCode}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitForgotReset(e) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await resetPasswordWithOtp(forgotPhone, forgotCode, newPassword);
      setForgotStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setSubmitting(false);
    }
  }

  function backToPasswordLogin() {
    setMode('password');
    setForgotStep('phone');
    setForgotPhone('');
    setForgotCode('');
    setNewPassword('');
    setError('');
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

          {!twoFa && mode !== 'forgot' && (
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
                OTP
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
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(''); }}
                style={{ background: 'transparent', color: '#c2185b' }}
              >
                Forgot password?
              </button>
            </form>
          ) : mode === 'forgot' ? (
            forgotStep === 'phone' ? (
              <form onSubmit={sendForgotOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="login-sub">
                  Enter the phone number on your account (the one saved in Settings → My account, for admin;
                  or your shop's phone number). We'll send an OTP to reset your password.
                </p>
                <label>
                  Phone number
                  <input value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)} required autoFocus />
                </label>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send OTP'}
                </button>
                <button type="button" onClick={backToPasswordLogin} style={{ background: 'transparent', color: '#c2185b' }}>
                  ← Back to sign in
                </button>
              </form>
            ) : forgotStep === 'reset' ? (
              <form onSubmit={submitForgotReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="login-sub">OTP sent to {forgotPhone}</p>
                <label>
                  Enter OTP
                  <input value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} required autoFocus />
                </label>
                <label>
                  New password
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                </label>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Resetting...' : 'Reset password'}
                </button>
                <button type="button" onClick={() => setForgotStep('phone')} style={{ background: 'transparent', color: '#c2185b' }}>
                  Change number
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="login-sub">Password updated. You can now sign in with your new password.</p>
                <button type="button" onClick={backToPasswordLogin}>
                  ← Back to sign in
                </button>
              </div>
            )
          ) : otpStep === 'phone' ? (
            <form onSubmit={sendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                Phone number
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
