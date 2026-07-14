const Settings = require('../models/Settings');

// Calls the configured SMS provider's HTTP API directly (no SDK needed — Node's
// built-in fetch). Throws on any non-success response so the caller can fall back to
// dev mode instead of silently telling the customer an OTP was sent when it wasn't.
async function callProvider(sms, phone, message) {
  const digitsOnly = String(phone).replace(/\D/g, '');
  const withCountryCode = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

  if (sms.provider === 'fast2sms') {
    const url = new URL('https://www.fast2sms.com/dev/bulkV2');
    url.searchParams.set('authorization', sms.apiKey);
    url.searchParams.set('route', 'q'); // Quick SMS — needs a DLT-approved sender for production use in India.
    url.searchParams.set('message', message);
    url.searchParams.set('flash', '0');
    url.searchParams.set('numbers', digitsOnly);
    if (sms.senderId) url.searchParams.set('sender_id', sms.senderId);
    const res = await fetch(url.toString(), { method: 'GET' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.return !== true) {
      throw new Error(body.message?.join?.(', ') || `Fast2SMS error (HTTP ${res.status})`);
    }
    return;
  }

  if (sms.provider === 'msg91') {
    const res = await fetch('https://api.msg91.com/api/v2/sendsms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: sms.apiKey },
      body: JSON.stringify({
        sender: sms.senderId || 'MUNCHB',
        route: '4',
        country: '91',
        sms: [{ message, to: [withCountryCode] }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.type === 'error') {
      throw new Error(body.message || `MSG91 error (HTTP ${res.status})`);
    }
    return;
  }

  if (sms.provider === 'twilio') {
    if (!sms.apiSecret || !sms.senderId) {
      throw new Error('Twilio needs Account SID (API key), Auth Token (API secret) and a From number (Sender ID)');
    }
    const auth = Buffer.from(`${sms.apiKey}:${sms.apiSecret}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sms.apiKey}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: `+${withCountryCode}`, From: sms.senderId, Body: message }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || `Twilio error (HTTP ${res.status})`);
    }
    return;
  }

  throw new Error(`No integration for provider "${sms.provider}" yet — choose MSG91, Fast2SMS or Twilio in Settings.`);
}

// Sends an SMS via the provider configured in admin Settings. Until one is enabled and
// configured, or if the provider call itself fails, this returns { sent: false } so the
// OTP flow falls back to the fixed dev-mode code instead of pretending a text went out.
async function sendSms(phone, message) {
  const settings = await Settings.getSingleton();
  const sms = settings.sms || {};
  if (!sms.enabled || !sms.provider || !sms.apiKey) {
    return { sent: false, reason: 'SMS not configured' };
  }
  try {
    await callProvider(sms, phone, message);
    return { sent: true };
  } catch (err) {
    console.error(`[SMS:${sms.provider}] failed to send to ${phone}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendSms };
