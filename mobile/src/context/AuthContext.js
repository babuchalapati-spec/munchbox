import React, {createContext, useContext, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  login as loginApi,
  register as registerApi,
  deliveryRegister as deliveryRegisterApi,
  verifyOtp as verifyOtpApi,
  verify2fa as verify2faApi,
  getMe,
} from '../api/auth';
import {checkForUpdate} from '../updateCheck';
import {useAppType} from '../appType';

const AuthContext = createContext(null);

export function AuthProvider({children}) {
  // Which APK this is — the update check has to ask for this app's build, not the one
  // implied by the account's role (an admin signing in must not be offered the
  // customer APK).
  const appType = useAppType();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('cake_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await getMe();
        setUser(me);
        checkForUpdate(appType);
      } catch (err) {
        await AsyncStorage.removeItem('cake_token');
      } finally {
        setLoading(false);
      }
    })();
  }, [appType]);

  // expectedRole keeps the customer/shop login screens strictly separate: the backend's
  // password-login endpoint doesn't care which app screen you're on, so without this a
  // shop account entered on the customer screen (or vice versa) would silently succeed
  // instead of a clear rejection.
  async function login(email, password, expectedRole) {
    const data = await loginApi(email, password);
    // Shop accounts with two-factor enabled need a second step.
    if (data.twoFactorRequired) {
      return {twoFactorRequired: true, ticket: data.ticket, email: data.email};
    }
    if (expectedRole && data.user.role !== expectedRole) {
      const err = new Error(`This isn't a ${expectedRole} account.`);
      err.response = {data: {message: `This isn't a ${expectedRole} account.`}};
      throw err;
    }
    await AsyncStorage.setItem('cake_token', data.token);
    setUser(data.user);
    checkForUpdate(appType);
    return {user: data.user};
  }

  // Second step of shop login: authenticator code + ticket → session.
  async function verifyShop2fa(ticket, code) {
    const {user: loggedInUser, token} = await verify2faApi(ticket, code);
    await AsyncStorage.setItem('cake_token', token);
    setUser(loggedInUser);
    return {user: loggedInUser};
  }

  async function register(payload) {
    const {user: newUser, token} = await registerApi(payload);
    await AsyncStorage.setItem('cake_token', token);
    setUser(newUser);
    checkForUpdate(appType);
  }

  async function registerDelivery(payload) {
    const {user: newUser, token} = await deliveryRegisterApi(payload);
    await AsyncStorage.setItem('cake_token', token);
    setUser(newUser);
    checkForUpdate(appType);
    return newUser;
  }

  // Returns { user } on login, { needsRegistration: true } for a new delivery partner,
  // or { twoFactorRequired, ticket, email } for a shop account with 2FA armed.
  async function loginWithOtp(phone, code, name, role, referralCode) {
    const data = await verifyOtpApi(phone, code, name, role, referralCode);
    if (data.twoFactorRequired) {
      return {twoFactorRequired: true, ticket: data.ticket, email: data.email};
    }
    if (data.token) {
      await AsyncStorage.setItem('cake_token', data.token);
      setUser(data.user);
      checkForUpdate(appType);
      return {user: data.user};
    }
    return {needsRegistration: Boolean(data.needsRegistration)};
  }

  // Refresh the current user (e.g. after submitting KYC).
  function refreshUser(updated) {
    setUser(updated);
  }

  async function logout() {
    await AsyncStorage.removeItem('cake_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        verifyShop2fa,
        register,
        registerDelivery,
        loginWithOtp,
        refreshUser,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
