const Settings = require('../models/Settings');

// Sends an SMS via the configured provider. Until a provider + keys are set in
// admin Settings, this is a no-op and returns { sent: false } so the OTP flow can
// fall back to dev mode. Real provider calls slot in here later.
async function sendSms(phone, message) {
  const settings = await Settings.getSingleton();
  const sms = settings.sms || {};
  if (!sms.enabled || !sms.provider || !sms.apiKey) {
    return { sent: false, reason: 'SMS not configured' };
  }
  // TODO: integrate the chosen provider (MSG91 / Fast2SMS / Twilio) using sms.apiKey.
  // For now, log so it is visible during development.
  console.log(`[SMS:${sms.provider}] to ${phone}: ${message}`);
  return { sent: true };
}

module.exports = { sendSms };
