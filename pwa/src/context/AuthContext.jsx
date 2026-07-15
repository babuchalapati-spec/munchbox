import React, {createContext, useContext, useEffect, useState} from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('mb_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const {data} = await client.get('/auth/me');
        setUser(data.user);
      } catch (err) {
        localStorage.removeItem('mb_token');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(identifier, password) {
    const {data} = await client.post('/auth/login', {identifier, password});
    if (data.twoFactorRequired) return {twoFactorRequired: true, ticket: data.ticket};
    localStorage.setItem('mb_token', data.token);
    setUser(data.user);
    return {user: data.user};
  }

  async function register(payload) {
    const {data} = await client.post('/auth/register', payload);
    localStorage.setItem('mb_token', data.token);
    setUser(data.user);
    return {user: data.user};
  }

  async function requestOtp(phone, name, referralCode) {
    const {data} = await client.post('/auth/request-otp', {phone, name, referralCode});
    return data;
  }

  async function loginWithOtp(phone, code, name, role, referralCode) {
    const {data} = await client.post('/auth/verify-otp', {phone, code, name, role, referralCode});
    if (data.twoFactorRequired) return {twoFactorRequired: true, ticket: data.ticket};
    if (data.token) {
      localStorage.setItem('mb_token', data.token);
      setUser(data.user);
      return {user: data.user, isNewUser: data.isNewUser};
    }
    return {needsRegistration: Boolean(data.needsRegistration)};
  }

  function refreshUser(updated) {
    setUser(updated);
  }

  function logout() {
    localStorage.removeItem('mb_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{user, loading, login, register, requestOtp, loginWithOtp, refreshUser, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
