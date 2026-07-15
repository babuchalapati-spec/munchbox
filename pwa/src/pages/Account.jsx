import {useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import BottomNav from '../components/BottomNav';

export default function Account() {
  const {user, logout} = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="screen">
      <div className="top-bar"><h2>Account</h2></div>
      <div className="page-pad" style={{flex: 1}}>
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{width: 60, height: 60, borderRadius: 30, background: '#c2185b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, margin: '0 auto 10px'}}>
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{fontWeight: 700}}>{user?.name}</div>
          <div className="muted">{user?.phone}</div>
        </div>
        <div className="card">
          <p style={{fontWeight: 700}}>Refer and earn</p>
          <p className="muted">Share this code with a friend. They get a welcome coupon, and you get a bonus after their first order.</p>
          <p style={{fontSize: 18, fontWeight: 800, color: '#c2185b'}}>{user?.referralCode}</p>
        </div>
        <button className="btn btn-outline" onClick={handleLogout}>Log out</button>
        <p className="muted" style={{textAlign: 'center', marginTop: 16}}>Munchbox web app</p>
      </div>
      <BottomNav />
    </div>
  );
}
