import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import client from '../api/client';

const CARDS = {
  customer: {icon: '🛍️', title: 'Customer App', blurb: 'Order cakes, food and catering.'},
  partner: {icon: '🛵', title: 'Delivery Partner App', blurb: 'Accept and deliver orders.'},
  shop: {icon: '🏪', title: 'Shop Owner App', blurb: 'Manage your shop and orders.'},
  admin: {icon: '🛠️', title: 'Admin App', blurb: 'Manage the whole platform.'},
};

export default function Download() {
  const [apps, setApps] = useState([]);

  useEffect(() => {
    client.get('/app/downloads')
      .then(({data}) => setApps(data.apps || []))
      .catch(() => {});
  }, []);

  return (
    <div className="screen">
      <div className="top-bar">
        <h2>Download Munchbox</h2>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        {Object.keys(CARDS).map((type) => {
          const card = CARDS[type];
          const app = apps.find((item) => item.type === type);
          return (
            <div className="card" style={{marginBottom: 12}} key={type}>
              <div style={{fontSize: 28}}>{card.icon}</div>
              <div style={{fontWeight: 700, fontSize: 16, marginTop: 4}}>{card.title}</div>
              <div className="muted" style={{marginBottom: 10}}>{card.blurb}</div>
              {app?.apkUrl ? (
                <a className="btn" href={app.apkUrl} style={{display: 'block', textAlign: 'center', textDecoration: 'none'}}>
                  Download{app.latestVersionName ? ` v${app.latestVersionName}` : ''}
                </a>
              ) : (
                <p className="muted">Not published yet.</p>
              )}
            </div>
          );
        })}
        <p className="muted" style={{marginTop: 16, fontSize: 12}}>
          Prefer not to install anything? Use the <Link to="/login">customer web app</Link>.
        </p>
      </div>
    </div>
  );
}
