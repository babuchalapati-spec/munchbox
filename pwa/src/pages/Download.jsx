import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import client from '../api/client';

const APPS = [
  {type: 'customer', icon: '🛍️', title: 'Customer App', desc: 'Order cakes, food and catering.'},
  {type: 'shop', icon: '🏪', title: 'Shop App', desc: 'For shop owners — manage orders, items and deliveries.'},
  {type: 'partner', icon: '🛵', title: 'Delivery Partner App', desc: 'For delivery partners — accept and deliver orders.'},
];

export default function Download() {
  const [versions, setVersions] = useState({});

  useEffect(() => {
    APPS.forEach(({type}) => {
      client.get('/app/version', {params: {type}})
        .then(({data}) => setVersions((v) => ({...v, [type]: data.app})))
        .catch(() => {});
    });
  }, []);

  return (
    <div className="screen">
      <div className="top-bar">
        <h2>Download Munchbox</h2>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        <p className="muted" style={{marginBottom: 16}}>Choose the app for your role. All three connect to the same Munchbox account system.</p>
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
