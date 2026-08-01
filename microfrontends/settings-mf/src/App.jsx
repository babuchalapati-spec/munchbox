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
    <div className="mf-page">
      <div className="mf-header">
        <div>
          <div className="mf-title">Settings</div>
          <div className="mf-subtitle">settings-mf · {GATEWAY_URL}</div>
        </div>
      </div>

      {error && (
        <p className="error">
          Could not reach the gateway ({error}). Expected until admin-config-service is actually
          migrated (ARCHITECTURE.md §6), unless this is a real error.
        </p>
      )}

      {!error && settings === null && <div className="skeleton-row" style={{ maxWidth: 400 }} />}

      {settings && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="stat-row" style={{ marginBottom: 0 }}>
            <div className="stat-tile">
              <div className="stat-num" style={{ fontSize: '1.1rem' }}>{settings.app?.latestVersionName || '—'}</div>
              <div className="stat-label">Customer app</div>
            </div>
            <div className="stat-tile">
              <div className="stat-num" style={{ fontSize: '1.1rem' }}>{settings.partnerApp?.latestVersionName || '—'}</div>
              <div className="stat-label">Partner app</div>
            </div>
            <div className="stat-tile">
              <div className="stat-num" style={{ fontSize: '1.1rem' }}>{settings.finance?.taxPercent ?? '—'}%</div>
              <div className="stat-label">Tax rate</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
