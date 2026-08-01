import { useEffect, useState } from 'react';

// Exposed to the shell as "settings_mf/SettingsApp" (see vite.config.js). Talks to
// admin-config-service via the gateway. Lowest-traffic, admin-only module — safe place
// to try a shell/build-tool upgrade first.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

export default function SettingsApp() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('munchbox_admin_token');
    fetch(`${GATEWAY_URL}/api/config`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        return res.json();
      })
      .then((data) => setSettings(data.settings || data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <h2 style={{ margin: '0 0 0.5rem' }}>Settings</h2>
      <p style={{ color: '#776b63', fontSize: '0.85rem', marginTop: 0 }}>settings-mf — talking to {GATEWAY_URL}</p>
      {error && (
        <p style={{ color: '#c62828' }}>
          Could not reach the gateway ({error}). Expected until admin-config-service is
          actually migrated (ARCHITECTURE.md §6).
        </p>
      )}
      {!error && settings === null && <p>Loading…</p>}
      {settings && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.4rem 1rem' }}>
          <dt style={{ color: '#776b63' }}>Customer app version</dt>
          <dd style={{ margin: 0 }}>{settings.app?.latestVersionName || '—'}</dd>
          <dt style={{ color: '#776b63' }}>Partner app version</dt>
          <dd style={{ margin: 0 }}>{settings.partnerApp?.latestVersionName || '—'}</dd>
          <dt style={{ color: '#776b63' }}>Tax rate</dt>
          <dd style={{ margin: 0 }}>{settings.finance?.taxPercent ?? '—'}%</dd>
        </dl>
      )}
    </div>
  );
}
