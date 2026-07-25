import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import client from '../api/client';

// Four separate installs, one per role — each is its own APK with its own app icon, so
// a phone can hold more than one of them at a time.
const APPS = [
  {type: 'customer', icon: '🛍️', title: 'Customer App', desc: 'Order cakes, food and catering.'},
  {type: 'shop', icon: '🏪', title: 'Shop App', desc: 'For shop owners — manage orders, items and deliveries.'},
  {type: 'partner', icon: '🛵', title: 'Delivery Partner App', desc: 'For delivery partners — accept and deliver orders.'},
  {type: 'admin', icon: '🛠️', title: 'Admin App', desc: 'For the Munchbox team — the full admin dashboard.'},
];

export default function Download() {
  const [versions, setVersions] = useState({});

  // One call for all four apps instead of four version calls — the same list the
  // backend builds from its own APK filenames, so this page can't fall out of step.
  useEffect(() => {
    client.get('/app/downloads')
      .then(({data}) => {
        const byType = {};
        (data.apps || []).forEach((app) => {
          byType[app.type] = app;
        });
        setVersions(byType);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="screen">
      <div className="top-bar">
        <h2>Download Munchbox</h2>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        <p className="muted" style={{marginBottom: 16}}>Choose the app for your role. All four connect to the same Munchbox account system, and each installs separately.</p>
        {APPS.map(({type, icon, title, desc}) => {
          const app = versions[type];
          return (
            <div key={type} className="card" style={{marginBottom: 12}}>
              <div style={{fontSize: 28}}>{icon}</div>
              <div style={{fontWeight: 700, fontSize: 16, marginTop: 4}}>{title}</div>
              <div className="muted" style={{marginBottom: 10}}>{desc}</div>
              {app?.apkUrl ? (
                <a className="btn" href={app.apkUrl} style={{display: 'block', textAlign: 'center', textDecoration: 'none'}}>
                  ⬇️ Download{app.latestVersionName ? ` v${app.latestVersionName}` : ''}
                </a>
              ) : (
                <p className="muted">Not published yet.</p>
              )}
            </div>
          );
        })}
        <p className="muted" style={{marginTop: 16, fontSize: 12}}>
          Prefer not to install anything? Use the web app instead — <Link to="/login">Customer</Link> ·{' '}
          <Link to="/shop-login">Shop</Link> · <Link to="/delivery-login">Delivery</Link>
        </p>
      </div>
    </div>
  );
}
