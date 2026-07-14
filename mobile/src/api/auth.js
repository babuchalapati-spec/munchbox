import client from './client';

export async function login(identifier, password) {
  const {data} = await client.post('/auth/login', {identifier, password});
  return data;
}

export async function register(payload) {
  const {data} = await client.post('/auth/register', payload);
  return data;
}

export async function deliveryRegister(payload) {
  const {data} = await client.post('/auth/delivery-register', payload);
  return data;
}

export async function submitKyc(payload) {
  const {data} = await client.put('/auth/kyc', payload);
  return data.user;
}

export async function requestOtp(phone, name, referralCode) {
  const {data} = await client.post('/auth/request-otp', {
    phone,
    name,
    referralCode,
  });
  return data; // { message, devMode?, devCode? }
}

export async function verifyOtp(phone, code, name, role, referralCode) {
  const {data} = await client.post('/auth/verify-otp', {
    phone,
    code,
    name,
    role,
    referralCode,
  });
  return data; // { user, token } OR { needsRegistration, phone }
}

// Shop owner self-registration → returns { message, userId }.
export async function shopRegister(payload) {
  const {data} = await client.post('/auth/shop-register', payload);
  return data;
}

// Step 2 of shop login: exchange ticket + authenticator code for a token.
export async function verify2fa(ticket, code) {
  const {data} = await client.post('/auth/verify-2fa', {ticket, code});
  return data; // { user, token }
}

export async function getMe() {
  const {data} = await client.get('/auth/me');
  return data.user;
}
