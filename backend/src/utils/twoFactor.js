const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const ISSUER = 'Munchbox Shop';

// Returns { secret (base32), otpauthUrl } — the otpauth URL is what an authenticator
// app (Microsoft Authenticator / Google Authenticator) scans to add the account.
function generateSecret(accountName) {
  const secret = speakeasy.generateSecret({
    name: `${ISSUER} (${accountName})`,
    issuer: ISSUER,
  });
  return { secret: secret.base32, otpauthUrl: secret.otpauth_url };
}

async function qrDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

// Verify a 6-digit token against the base32 secret, allowing 1 step of clock drift.
function verifyToken(token, secret) {
  if (!token || !secret) return false;
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: String(token).trim(),
    window: 1,
  });
}

module.exports = { generateSecret, qrDataUrl, verifyToken, ISSUER };
