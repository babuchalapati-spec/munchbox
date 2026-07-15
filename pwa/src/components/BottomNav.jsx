import {NavLink} from 'react-router-dom';

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({isActive}) => (isActive ? 'active' : '')}>
        <span className="icon">🏠</span>Home
      </NavLink>
      <NavLink to="/orders" className={({isActive}) => (isActive ? 'active' : '')}>
        <span className="icon">🧾</span>Orders
      </NavLink>
      <NavLink to="/account" className={({isActive}) => (isActive ? 'active' : '')}>
        <span className="icon">👤</span>Account
      </NavLink>
    </nav>
  );
}
