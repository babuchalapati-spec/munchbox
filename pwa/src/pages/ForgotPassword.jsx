import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import client from '../api/client';

export default function ForgotPassword() {
  const {requestOtp} = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendOtp(e) {
    e.preventDefault();
    if (!phone || phone.length < 10) return setError('Enter a valid phone number');
    setError('');
    setBusy(true);
    try {
      await requestOtp(phone);
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function reset(e) {
    e.preventDefault();
    if (!code) return setError('Enter the OTP');
    if (!newPassword || newPassword.length < 6) return setError('New password must be at least 6 characters');
    setError('');
    setBusy(true);
    try {
      await client.post('/auth/reset-password', {phone, code, newPassword, role: 'customer'});
      alert('Password updated. You can now log in with your new password.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="page-pad">
        <h1>Reset your password</h1>
        {error && <p className="error">{error}</p>}
        {step === 'phone' ? (
          <form onSubmit={sendOtp}>
            <label className="label">Phone number on your account</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
          </form>
        ) : (
          <form onSubmit={reset}>
            <p className="muted">OTP sent to {phone}</p>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter OTP" maxLength={6} />
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" />
            <button className="btn" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</button>
          </form>
        )}
        <button className="link" onClick={() => navigate('/login')}>← Back to login</button>
      </div>
    </div>
  );
}
