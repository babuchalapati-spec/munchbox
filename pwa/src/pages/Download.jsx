import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import client from '../api/client';

export default function Download() {
  const [app, setApp] = useState(null);

  useEffect(() => {
    client.get('/app/downloads')
      .then(({data}) => {
        setApp((data.apps || []).find((item) => item.type === 'customer') || null);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="screen">
      <div className="top-bar">
        <h2>Download Munchbox</h2>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        <div className="card" style={{marginBottom: 12}}>
          <div style={{fontSize: 28}}>🛍️</div>
          <div style={{fontWeight: 700, fontSize: 16, marginTop: 4}}>Customer App</div>
          <div className="muted" style={{marginBottom: 10}}>Order cakes, food and catering.</div>
          {app?.apkUrl ? (
            <a className="btn" href={app.apkUrl} style={{display: 'block', textAlign: 'center', textDecoration: 'none'}}>
              Download{app.latestVersionName ? ` v${app.latestVersionName}` : ''}
            </a>
          ) : (
            <p className="muted">Not published yet.</p>
          )}
        </div>
        <p className="muted" style={{marginTop: 16, fontSize: 12}}>
          Prefer not to install anything? Use the <Link to="/login">customer web app</Link>.
        </p>
      </div>
    </div>
  );
}
