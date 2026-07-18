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
    if (sms.senderId) {
      // DLT Manual route — required for real transactional/OTP SMS in India once you have
      // a DLT-approved sender ID. entity_id/template_id are optional: if the message text
      // is already added as a content template in Fast2SMS's own DLT Manager, Fast2SMS
      // matches them automatically in the backend from the message text.
      url.searchParams.set('route', 'dlt_manual');
      url.searchParams.set('sender_id', sms.senderId);
      if (sms.dltEntityId) url.searchParams.set('entity_id', sms.dltEntityId);
      if (sms.dltTemplateId) url.searchParams.set('template_id', sms.dltTemplateId);
    } else {
      url.searchParams.set('route', 'q'); // Quick SMS — demo/test route only, no DLT sender required.
    }
    url.searchParams.set('message', message);
    url.searchParams.set('flash', '0');
    url.searchParams.set('numbers', digitsOnly);
    const res = await fetch(url.toString(), { method: 'GET' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.return !== true) {
      const reason = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      console.error('[SMS:fast2sms] raw error response:', JSON.stringify(body));
      throw new Error(reason || `Fast2SMS error (HTTP ${res.status})`);
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

// Sends an OTP using the configured message template so the wording actually sent
// matches what the admin registered in Settings — critical for DLT routes, where the
// operator silently drops any SMS whose text doesn't match the approved template exactly.
async function sendOtpSms(phone, code) {
  const settings = await Settings.getSingleton();
  const sms = settings.sms || {};
  const template = (sms.otpMessageTemplate || '').trim() || 'Your Munchbox OTP is {otp}. Valid for 5 minutes.';
  const message = template.replace(/\{otp\}/g, code);
  if (!sms.enabled || !sms.provider || !sms.apiKey) {
    return { sent: false, reason: 'SMS not configured' };
  }
  try {
    await callProvider(sms, phone, message);
    return { sent: true };
  } catch (err) {
    console.error(`[SMS:${sms.provider}] failed to send OTP to ${phone}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendSms, sendOtpSms, callProvider };
