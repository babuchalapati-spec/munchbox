import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import QRCode from 'qrcode';
import client from '../api/client';

// icon is each flavor's real Android launcher icon (see build-apks.ps1 / mobile/android
// app/src/<flavor>/res), not a generic emoji — so the icon shown here is the exact one
// to look for on the home screen after installing.
const CARDS = {
  customer: {icon: '/app-icons/customer.png', title: 'Customer App', blurb: 'Order cakes, food and catering.'},
  partner: {icon: '/app-icons/partner.png', title: 'Delivery Partner App', blurb: 'Accept and deliver orders.'},
  shop: {icon: '/app-icons/shop.png', title: 'Shop Owner App', blurb: 'Manage your shop and orders.'},
  admin: {icon: '/app-icons/admin.png', title: 'Admin App', blurb: 'Manage the whole platform.'},
};

export default function Download() {
  const [apps, setApps] = useState([]);
  const [qrCodes, setQrCodes] = useState({});

  useEffect(() => {
    client.get('/app/downloads')
      .then(({data}) => setApps(data.apps || []))
      .catch(() => {});
  }, []);

  // One QR per app, pointing straight at its APK URL — scanning it with a phone
  // camera opens the same link the Download button does, no typing required.
  useEffect(() => {
    apps.forEach((app) => {
      if (!app.apkUrl || qrCodes[app.type]) return;
      QRCode.toDataURL(app.apkUrl, {width: 160, margin: 1})
        .then((dataUrl) => setQrCodes((prev) => ({...prev, [app.type]: dataUrl})))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps]);

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
              <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
                <div style={{flex: 1, minWidth: 0}}>
                  <img src={card.icon} alt="" width={44} height={44} style={{borderRadius: 10}} />
                  <div style={{fontWeight: 700, fontSize: 16, marginTop: 6}}>{card.title}</div>
                  <div className="muted" style={{marginBottom: 10}}>{card.blurb}</div>
                  {app?.apkUrl ? (
                    <a className="btn" href={app.apkUrl} style={{display: 'block', textAlign: 'center', textDecoration: 'none'}}>
                      Download{app.latestVersionName ? ` v${app.latestVersionName}` : ''}
                    </a>
                  ) : (
                    <p className="muted">Not published yet.</p>
                  )}
                </div>
                {app?.apkUrl && qrCodes[type] && (
                  <div style={{textAlign: 'center', flexShrink: 0}}>
                    <img
                      src={qrCodes[type]}
                      alt={`Scan to download ${card.title}`}
                      width={80}
                      height={80}
                      style={{borderRadius: 8, border: '1px solid #eee'}}
                    />
                    <div className="muted" style={{fontSize: 10, marginTop: 4}}>Scan to install</div>
                  </div>
                )}
              </div>
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
