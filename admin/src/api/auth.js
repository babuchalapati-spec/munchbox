import client from './client';

export async function login(email, password) {
  const { data } = await client.post('/auth/login', { email, password });
  return data;
}

export async function requestOtp(phone) {
  const { data } = await client.post('/auth/request-otp', { phone });
  return data; // { message, devMode?, devCode? }
}

export async function verifyOtp(phone, code) {
  const { data } = await client.post('/auth/verify-otp', { phone, code, role: 'admin' });
  return data; // { user, token } OR { twoFactorRequired, ticket, email }
}

// Step 2 of shop login: exchange ticket + authenticator code for a token.
export async function verify2fa(ticket, code) {
  const { data } = await client.post('/auth/verify-2fa', { ticket, code });
  return data; // { user, token }
}

export async function getMe() {
  const { data } = await client.get('/auth/me');
  return data.user;
}

export async function updateMe(payload) {
  const { data } = await client.put('/auth/me', payload);
  return data.user;
}

// Forgot-password: verifying the phone-login OTP proves ownership, then sets a new
// password. role 'admin' matches verifyOtp's lookup — the admin's own phone number only.
export async function resetPasswordWithOtp(phone, code, newPassword) {
  const { data } = await client.post('/auth/reset-password', { phone, code, newPassword, role: 'admin' });
  return data;
}
