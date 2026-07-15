import {useState} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import client from '../api/client';
import {useAuth} from '../context/AuthContext';

const DOCS = [
  {key: 'photoUrl', label: 'Your photo'},
  {key: 'aadhaarUrl', label: 'Aadhaar card'},
  {key: 'licenseUrl', label: 'Driving license'},
  {key: 'rcUrl', label: 'Bike RC book'},
];

export default function DeliveryRegister() {
  const {loginWithOtp, requestOtp} = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'profile' | 'docs'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [docs, setDocs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      const result = await loginWithOtp(phone, code, undefined, 'delivery');
      if (result.user) {
        navigate('/');
        return;
      }
      setStep('profile'); // new partner
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setBusy(false);
    }
  }

  async function uploadDoc(key, file) {
    if (!file) return;
    setDocs((d) => ({...d, [key]: {name: file.name, uploading: true}}));
    try {
      const form = new FormData();
      form.append('image', file);
      const {data} = await client.post('/uploads', form, {headers: {'Content-Type': 'multipart/form-data'}, timeout: 120000});
      setDocs((d) => ({...d, [key]: {name: file.name, uploading: false, url: data.url}}));
    } catch (err) {
      setDocs((d) => ({...d, [key]: undefined}));
      setError(`Could not upload ${key === 'photoUrl' ? 'photo' : 'document'}. Check the file and try again.`);
    }
  }

  // Creates the account FIRST so we hold an auth token before touching /uploads
  // (which requires login) — uploading documents before the account existed was
  // why Aadhaar/PAN/license uploads silently failed for new partners.
  async function createAccount(e) {
    e.preventDefault();
    if (!name) return setError('Enter your name');
    setError('');
    setBusy(true);
    try {
      const {data} = await client.post('/auth/delivery-register', {name, phone, vehicleNumber});
      localStorage.setItem('mb_token', data.token);
      setStep('docs');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitDocs(e) {
    e.preventDefault();
    const missing = DOCS.filter((d) => !docs[d.key]?.url);
    if (missing.length) return setError(`Please add: ${missing.map((m) => m.label).join(', ')}`);
    setError('');
    setBusy(true);
    try {
      await client.put('/auth/kyc', {
        photoUrl: docs.photoUrl.url,
        aadhaarUrl: docs.aadhaarUrl.url,
        licenseUrl: docs.licenseUrl.url,
        rcUrl: docs.rcUrl.url,
        vehicleNumber,
      });
      window.location.href = '/'; // full reload so AuthContext picks up the new session
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit documents');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-logo">🛵</div>
        <h1>Delivery partner</h1>
        <p>Log in or register with your phone number</p>
      </div>
      <div className="form-card">
        {error && <p className="error">{error}</p>}

        {step === 'phone' && (
          <form onSubmit={sendOtp}>
            <label className="label">Phone number</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verify}>
            <p className="muted">OTP sent to {phone}</p>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
            <button className="btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</button>
            <button type="button" className="link" onClick={() => setStep('phone')}>Change number</button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={createAccount}>
            <p className="muted">New partner — let's set up your account first, then add your documents.</p>
            <label className="label">Full name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="label">Bike number</label>
            <input className="input" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. TS09AB1234" />
            <button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Continue'}</button>
          </form>
        )}

        {step === 'docs' && (
          <form onSubmit={submitDocs}>
            <p className="muted">Almost done — upload your documents. Admin will verify.</p>
            {DOCS.map((d) => (
              <div key={d.key} style={{marginBottom: 12}}>
                <label className="label">{d.label}{docs[d.key]?.url ? ' — ✓ Added' : docs[d.key]?.uploading ? ' — Uploading…' : ''}</label>
                <input type="file" accept="image/*,.pdf" onChange={(e) => uploadDoc(d.key, e.target.files[0])} />
              </div>
            ))}
            <button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit documents'}</button>
          </form>
        )}

        <Link className="link" to="/login">← Back to customer login</Link>
      </div>
    </div>
  );
}
