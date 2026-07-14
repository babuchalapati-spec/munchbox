import { useEffect, useState } from 'react';
import { getSettings, publishApk, updateSettings } from '../../api/settings';

export default function Settings() {
  const [sms, setSms] = useState({ provider: '', apiKey: '', apiSecret: '', senderId: '', enabled: false });
  const [app, setApp] = useState({ latestVersionCode: 1, latestVersionName: '1.0', apkUrl: '', updateMessage: '', mandatory: false });
  const [partnerApp, setPartnerApp] = useState({
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
        setApp((prev) => ({ ...prev, ...(s.app || {}) }));
        setPartnerApp((prev) => ({ ...prev, ...(s.partnerApp || {}) }));
      })
      .catch(() => setError('Could not load settings'))
      .finally(() => setLoading(false));
  }, []);

  function change(field, value) {
    setSms((s) => ({ ...s, [field]: value }));
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

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    try {
      const updated = await updateSettings({ sms, app, partnerApp });
      setSms(updated.sms);
      setApp(updated.app);
      setPartnerApp(updated.partnerApp);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
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
      formData.append('versionCode', apkType === 'partner' ? partnerApp.latestVersionCode : app.latestVersionCode);
      formData.append('versionName', apkType === 'partner' ? partnerApp.latestVersionName : app.latestVersionName);
      formData.append('updateMessage', apkType === 'partner' ? partnerApp.updateMessage : app.updateMessage);
      formData.append('mandatory', apkType === 'partner' ? String(partnerApp.mandatory) : String(app.mandatory));
      const result = await publishApk(formData);
      if (apkType === 'partner') {
        setPartnerApp((prev) => ({ ...prev, apkUrl: result.apkUrl, latestVersionCode: Number(partnerApp.latestVersionCode || 1), latestVersionName: partnerApp.latestVersionName || '1.0' }));
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
