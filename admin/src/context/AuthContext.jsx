import { createContext, useContext, useEffect, useState } from 'react';
import { login as loginApi, verifyOtp as verifyOtpApi, verify2fa as verify2faApi, getMe } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('cake_admin_token');
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('cake_admin_token'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setSubscriptionExpired(true);
    window.addEventListener('subscription-expired', onExpired);
    return () => window.removeEventListener('subscription-expired', onExpired);
  }, []);

  async function login(email, password) {
    const data = await loginApi(email, password);
    // Shop accounts with two-factor enabled need a second step (authenticator code).
    if (data.twoFactorRequired) {
      return { twoFactorRequired: true, ticket: data.ticket, email: data.email };
    }
    if (data.user.role !== 'admin' && data.user.role !== 'shop') {
      throw new Error('Only admin or shop accounts can access this dashboard');
    }
    localStorage.setItem('cake_admin_token', data.token);
    setUser(data.user);
    return {};
  }

  // Shop-owner OTP login.
  async function loginWithOtp(phone, code) {
    const data = await verifyOtpApi(phone, code);
    if (data.twoFactorRequired) {
      return { twoFactorRequired: true, ticket: data.ticket, email: data.email };
    }
    if (!data.user || (data.user.role !== 'shop' && data.user.role !== 'admin')) {
      throw new Error('This number is not registered as a shop account');
    }
    localStorage.setItem('cake_admin_token', data.token);
    setUser(data.user);
    return {};
  }

  // Second step of shop login: authenticator code + ticket → session.
  async function verifyTwoFactor(ticket, code) {
    const { user: loggedInUser, token } = await verify2faApi(ticket, code);
    localStorage.setItem('cake_admin_token', token);
    setUser(loggedInUser);
  }

  function logout() {
    localStorage.removeItem('cake_admin_token');
    setUser(null);
    setSubscriptionExpired(false);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithOtp, verifyTwoFactor, logout, subscriptionExpired }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
