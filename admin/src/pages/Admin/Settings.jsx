import { useEffect, useState } from 'react';
import { getSettings, publishApk, updateSettings, testSms as testSmsApi, testRazorpay as testRazorpayApi } from '../../api/settings';
import { updateMe } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [myPhone, setMyPhone] = useState(user?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  async function handleSavePhone(e) {
    e.preventDefault();
    setPhoneError('');
    setPhoneSaved(false);
    setSavingPhone(true);
    try {
      await updateMe({ phone: myPhone.trim() });
      setPhoneSaved(true);
    } catch (err) {
      setPhoneError(err.response?.data?.message || 'Could not save phone number');
    } finally {
      setSavingPhone(false);
    }
  }

  const [sms, setSms] = useState({
    provider: '',
    apiKey: '',
    apiSecret: '',
    senderId: '',
    dltEntityId: '',
    dltTemplateId: '',
    otpMessageTemplate: 'Your Munchbox OTP is {otp}. Valid for 5 minutes.',
    enabled: false,
  });
  const [testPhone, setTestPhone] = useState('');
  const [testingSms, setTestingSms] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState(null);
  const [razorpay, setRazorpay] = useState({ keyId: '', keySecret: '', enabled: false });
  const [testingRazorpay, setTestingRazorpay] = useState(false);
  const [testRazorpayResult, setTestRazorpayResult] = useState(null);
  const [app, setApp] = useState({ latestVersionCode: 1, latestVersionName: '1.0', apkUrl: '', updateMessage: '', mandatory: false });
  const [partnerApp, setPartnerApp] = useState({
    latestVersionCode: 1,
    latestVersionName: '1.0',
    apkUrl: '',
    updateMessage: '',
    mandatory: false,
  });
  const [shopApp, setShopApp] = useState({
    latestVersionCode: 1,
    latestVersionName: '1.0',
    apkUrl: '',
    updateMessage: '',
    mandatory: false,
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [apkFile, setApkFile] = useState(null);
  const [apkType, setApkType] = useState('customer');
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSms((prev) => ({ ...prev, ...(s.sms || {}) }));
        setRazorpay((prev) => ({ ...prev, ...(s.razorpay || {}) }));
        setApp((prev) => ({ ...prev, ...(s.app || {}) }));
        setPartnerApp((prev) => ({ ...prev, ...(s.partnerApp || {}) }));
        setShopApp((prev) => ({ ...prev, ...(s.shopApp || {}) }));
      })
      .catch(() => setError('Could not load settings'))
      .finally(() => setLoading(false));
  }, []);

  function change(field, value) {
    setSms((s) => ({ ...s, [field]: value }));
    setSaved(false);
  }

  function changeRazorpay(field, value) {
    setRazorpay((r) => ({ ...r, [field]: value }));
    setSaved(false);
  }

  function changeApp(field, value) {
    setApp((a) => ({ ...a, [field]: value }));
    setSaved(false);
  }

  function changePartnerApp(field, value) {
    setPartnerApp((a) => ({ ...a, [field]: value }));
    setSaved(false);
  }

  function changeShopApp(field, value) {
    setShopApp((a) => ({ ...a, [field]: value }));
    setSaved(false);
  }

  async function handleTestSms() {
    if (!testPhone.trim()) {
      setTestSmsResult({ ok: false, message: 'Enter a phone number to send the test to' });
      return;
    }
    setTestingSms(true);
    setTestSmsResult(null);
    try {
      const result = await testSmsApi({ phone: testPhone.trim(), ...sms });
      setTestSmsResult({ ok: true, message: result.message });
    } catch (err) {
      setTestSmsResult({ ok: false, message: err.response?.data?.message || 'Could not send the test SMS' });
    } finally {
      setTestingSms(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    try {
      const updated = await updateSettings({ sms, razorpay, app, partnerApp, shopApp });
      setSms(updated.sms);
      setRazorpay((prev) => ({ ...prev, ...(updated.razorpay || {}) }));
      setApp(updated.app);
      setPartnerApp(updated.partnerApp);
      setShopApp(updated.shopApp);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    }
  }

  async function handleTestRazorpay() {
    if (!razorpay.keyId.trim() || !razorpay.keySecret.trim()) {
      setTestRazorpayResult({ ok: false, message: 'Enter both the Key ID and Key Secret first' });
      return;
    }
    setTestingRazorpay(true);
    setTestRazorpayResult(null);
    try {
      const result = await testRazorpayApi({ keyId: razorpay.keyId.trim(), keySecret: razorpay.keySecret.trim() });
      setTestRazorpayResult({ ok: true, message: result.message });
    } catch (err) {
      setTestRazorpayResult({ ok: false, message: err.response?.data?.message || 'Could not connect to Razorpay' });
    } finally {
      setTestingRazorpay(false);
    }
  }

  async function handlePublish(e) {
    e.preventDefault();
    if (!apkFile) {
      setError('Choose an APK file first');
      return;
    }
    setPublishing(true);
    setError('');
    setPublishMessage('');
    try {
      const formData = new FormData();
      formData.append('apk', apkFile);
      formData.append('appType', apkType);
      const target = apkType === 'partner' ? partnerApp : apkType === 'shop' ? shopApp : app;
      formData.append('versionCode', target.latestVersionCode);
      formData.append('versionName', target.latestVersionName);
      formData.append('updateMessage', target.updateMessage);
      formData.append('mandatory', String(target.mandatory));
      const result = await publishApk(formData);
      if (apkType === 'partner') {
        setPartnerApp((prev) => ({ ...prev, apkUrl: result.apkUrl, latestVersionCode: Number(partnerApp.latestVersionCode || 1), latestVersionName: partnerApp.latestVersionName || '1.0' }));
      } else if (apkType === 'shop') {
        setShopApp((prev) => ({ ...prev, apkUrl: result.apkUrl, latestVersionCode: Number(shopApp.latestVersionCode || 1), latestVersionName: shopApp.latestVersionName || '1.0' }));
      } else {
        setApp((prev) => ({ ...prev, apkUrl: result.apkUrl, latestVersionCode: Number(app.latestVersionCode || 1), latestVersionName: app.latestVersionName || '1.0' }));
      }
      setPublishMessage(`Published ${result.fileName} and updated the download URL.`);
      setApkFile(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not publish APK');
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Settings</h1>
      <p className="muted">Only the main admin can view and change these. Used for sending SMS / OTP.</p>

      <form className="card form" onSubmit={handleSavePhone} style={{ maxWidth: 520 }}>
        <h2>My account</h2>
        {phoneError && <p className="error">{phoneError}</p>}
        {phoneSaved && <p style={{ color: '#2e7d32' }}>Saved.</p>}
        <label>
          My phone number
          <input
            value={myPhone}
            onChange={(e) => { setMyPhone(e.target.value); setPhoneSaved(false); }}
            placeholder="e.g. 9876543210"
          />
        </label>
        <p className="muted" style={{ marginTop: -4 }}>
          Set this once to sign in from the "OTP (shop owner / admin)" tab on the login page, instead of only
          email/password.
        </p>
        <div className="form-actions">
          <button type="submit" disabled={savingPhone}>{savingPhone ? 'Saving...' : 'Save phone number'}</button>
        </div>
      </form>

      <form className="card form" onSubmit={handleSave} style={{ maxWidth: 520 }}>
        <h2>SMS API</h2>
        {error && <p className="error">{error}</p>}
        {saved && <p style={{ color: '#2e7d32' }}>Saved.</p>}

        <label className="checkbox">
          <input type="checkbox" checked={sms.enabled} onChange={(e) => change('enabled', e.target.checked)} />
          SMS enabled
        </label>

        <label>
          Provider
          <select value={sms.provider} onChange={(e) => change('provider', e.target.value)}>
            <option value="">Select provider</option>
            <option value="msg91">MSG91</option>
            <option value="fast2sms">Fast2SMS</option>
            <option value="twilio">Twilio</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          API key
          <input value={sms.apiKey} onChange={(e) => change('apiKey', e.target.value)} placeholder="Your SMS API key" />
        </label>

        <label>
          API secret (if any)
          <input value={sms.apiSecret} onChange={(e) => change('apiSecret', e.target.value)} placeholder="Optional" />
        </label>

        <label>
          Sender ID
          <input value={sms.senderId} onChange={(e) => change('senderId', e.target.value)} placeholder="e.g. MUNCHB" />
        </label>

        {sms.provider === 'fast2sms' && (
          <>
            <label>
              DLT Entity ID (optional)
              <input value={sms.dltEntityId} onChange={(e) => change('dltEntityId', e.target.value)} placeholder="From your DLT platform (e.g. Airtel/Jio/Vodafone portal)" />
            </label>
            <label>
              DLT Template ID (optional)
              <input value={sms.dltTemplateId} onChange={(e) => change('dltTemplateId', e.target.value)} placeholder="Approved content template ID" />
            </label>
            <p className="muted" style={{ marginTop: -4 }}>
              Leave these blank if you've already added your message content template in Fast2SMS's own DLT Manager —
              Fast2SMS will match the entity ID and template ID automatically from the message text. Fill them in only
              if you registered the template directly on your DLT platform and haven't synced it to Fast2SMS.
            </p>
          </>
        )}

        <label>
          OTP message template
          <textarea
            rows={2}
            value={sms.otpMessageTemplate}
            onChange={(e) => change('otpMessageTemplate', e.target.value)}
            placeholder="Your Munchbox OTP is {otp}. Valid for 5 minutes."
          />
        </label>
        <p className="muted" style={{ marginTop: -4 }}>
          Use <code>{'{otp}'}</code> where the code should go. For DLT (Fast2SMS/MSG91 in India) this text must match
          your DLT-approved content template <strong>exactly</strong> — same wording, punctuation and spacing — or the
          operator will silently drop the SMS even though Fast2SMS reports success.
        </p>

        <div style={{ background: '#faf7f4', border: '1px solid var(--line)', borderRadius: 8, padding: '0.9rem', marginTop: 4 }}>
          <label style={{ marginBottom: 8 }}>
            Test this key by sending a real SMS
            <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Phone number to send to, e.g. 9876543210" />
          </label>
          <button type="button" className="btn-outline" onClick={handleTestSms} disabled={testingSms}>
            {testingSms ? 'Sending…' : '📨 Send test SMS'}
          </button>
          {testSmsResult && (
            <p style={{ color: testSmsResult.ok ? '#2e7d32' : '#c62828', fontSize: '0.85rem', marginTop: 8, marginBottom: 0 }}>
              {testSmsResult.ok ? '✅ ' : '❌ '}{testSmsResult.message}
            </p>
          )}
          <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
            Tests the key/provider above directly — works even before you hit Save, so you can catch a wrong key
            immediately instead of finding out when a customer's OTP doesn't arrive.
          </p>
        </div>

        <h2 style={{ marginTop: 24 }}>Razorpay (online payments)</h2>
        <p className="muted">
          Get these from the <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer">Razorpay Dashboard</a> →
          Settings → API Keys. Test keys (rzp_test_...) work immediately for trying it out; switch to Live keys once your
          account is KYC-approved.
        </p>

        <label className="checkbox">
          <input type="checkbox" checked={razorpay.enabled} onChange={(e) => changeRazorpay('enabled', e.target.checked)} />
          Online payments enabled
        </label>

        <label>
          Key ID
          <input value={razorpay.keyId} onChange={(e) => changeRazorpay('keyId', e.target.value)} placeholder="rzp_test_xxxxxxxxxxxx" />
        </label>

        <label>
          Key Secret
          <input
            type="password"
            value={razorpay.keySecret}
            onChange={(e) => changeRazorpay('keySecret', e.target.value)}
            placeholder="Your Razorpay key secret"
          />
        </label>

        <div style={{ background: '#faf7f4', border: '1px solid var(--line)', borderRadius: 8, padding: '0.9rem', marginTop: 4 }}>
          <button type="button" className="btn-outline" onClick={handleTestRazorpay} disabled={testingRazorpay}>
            {testingRazorpay ? 'Testing…' : '💳 Test connection'}
          </button>
          {testRazorpayResult && (
            <p style={{ color: testRazorpayResult.ok ? '#2e7d32' : '#c62828', fontSize: '0.85rem', marginTop: 8, marginBottom: 0 }}>
              {testRazorpayResult.ok ? '✅ ' : '❌ '}{testRazorpayResult.message}
            </p>
          )}
          <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
            Creates a real ₹1 test order with the keys above (works even before you hit Save), so a typo'd key is caught
            here instead of at a customer's checkout.
          </p>
        </div>

        <h2 style={{ marginTop: 24 }}>App auto-update</h2>
        <p className="muted">When you release a new APK, upload it to the server's downloads folder and bump these.</p>
        <label>
          Latest version code (a number; increase each release)
          <input type="number" value={app.latestVersionCode} onChange={(e) => changeApp('latestVersionCode', e.target.value)} />
        </label>
        <label>
          Version name
          <input value={app.latestVersionName} onChange={(e) => changeApp('latestVersionName', e.target.value)} placeholder="1.1" />
        </label>
        <label>
          APK download URL
          <input value={app.apkUrl} onChange={(e) => changeApp('apkUrl', e.target.value)} placeholder="http://<server>:5001/downloads/Munchbox.apk" />
        </label>
        <label>
          Update message
          <input value={app.updateMessage} onChange={(e) => changeApp('updateMessage', e.target.value)} />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={app.mandatory} onChange={(e) => changeApp('mandatory', e.target.checked)} />
          Force update (user cannot skip)
        </label>

        <h2 style={{ marginTop: 24 }}>Partner app auto-update</h2>
        <p className="muted">Use these for the delivery partner APK. Partner builds check /api/app/version?type=partner.</p>
        <label>
          Latest version code
          <input
            type="number"
            value={partnerApp.latestVersionCode}
            onChange={(e) => changePartnerApp('latestVersionCode', e.target.value)}
          />
        </label>
        <label>
          Version name
          <input
            value={partnerApp.latestVersionName}
            onChange={(e) => changePartnerApp('latestVersionName', e.target.value)}
            placeholder="1.1"
          />
        </label>
        <label>
          Partner APK download URL
          <input
            value={partnerApp.apkUrl}
            onChange={(e) => changePartnerApp('apkUrl', e.target.value)}
            placeholder="http://<server>:5001/downloads/MunchboxPartner.apk"
          />
        </label>
        <label>
          Update message
          <input value={partnerApp.updateMessage} onChange={(e) => changePartnerApp('updateMessage', e.target.value)} />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={partnerApp.mandatory}
            onChange={(e) => changePartnerApp('mandatory', e.target.checked)}
          />
          Force partner update
        </label>

        <h2 style={{ marginTop: 24 }}>Shop app auto-update</h2>
        <p className="muted">
          Same app as Customer/Partner, published under its own branded download link for shop owners.
          Shop builds check /api/app/version?type=shop.
        </p>
        <label>
          Latest version code
          <input
            type="number"
            value={shopApp.latestVersionCode}
            onChange={(e) => changeShopApp('latestVersionCode', e.target.value)}
          />
        </label>
        <label>
          Version name
          <input
            value={shopApp.latestVersionName}
            onChange={(e) => changeShopApp('latestVersionName', e.target.value)}
            placeholder="1.1"
          />
        </label>
        <label>
          Shop APK download URL
          <input
            value={shopApp.apkUrl}
            onChange={(e) => changeShopApp('apkUrl', e.target.value)}
            placeholder="http://<server>:5001/downloads/MunchboxShop.apk"
          />
        </label>
        <label>
          Update message
          <input value={shopApp.updateMessage} onChange={(e) => changeShopApp('updateMessage', e.target.value)} />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={shopApp.mandatory}
            onChange={(e) => changeShopApp('mandatory', e.target.checked)}
          />
          Force shop update
        </label>

        <div className="form-actions">
          <button type="submit">Save settings</button>
        </div>
      </form>

      <form className="card form" onSubmit={handlePublish} style={{ maxWidth: 520, marginTop: 24 }}>
        <h2>Publish APK locally</h2>
        <p className="muted">Upload a local APK from this machine and the backend will publish it under the downloads folder for automatic app updates.</p>
        {error && <p className="error">{error}</p>}
        {publishMessage && <p style={{ color: '#2e7d32' }}>{publishMessage}</p>}

        <label>
          App target
          <select value={apkType} onChange={(e) => setApkType(e.target.value)}>
            <option value="customer">Customer app</option>
            <option value="shop">Shop app</option>
            <option value="partner">Partner app</option>
          </select>
        </label>

        <label>
          APK file
          <input type="file" accept=".apk,application/vnd.android.package-archive" onChange={(e) => setApkFile(e.target.files?.[0] || null)} />
        </label>

        <div className="form-actions">
          <button type="submit" disabled={publishing}>{publishing ? 'Publishing...' : 'Publish APK'}</button>
        </div>
      </form>
    </div>
  );
}
