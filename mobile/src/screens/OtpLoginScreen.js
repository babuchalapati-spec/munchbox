import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useAuth} from '../context/AuthContext';
import {requestOtp} from '../api/auth';
import {colors} from '../theme';

export default function OtpLoginScreen({navigation}) {
  const {loginWithOtp} = useAuth();
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [code, setCode] = useState('');
  const [devHint, setDevHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    if (!phone || phone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await requestOtp(phone, name, referralCode);
      setStep('otp');
      // In dev mode (SMS not configured) the code comes back so you can test.
      setDevHint(res.devMode && res.devCode ? `Dev code: ${res.devCode}` : '');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!code || code.length < 4) {
      setError('Enter the OTP');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await loginWithOtp(phone, code, name, undefined, referralCode);
      // On success the navigator switches to the app automatically.
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Munchbox</Text>
      <Text style={styles.subtitle}>Order cakes, food & catering</Text>

      <View style={styles.roleBadge}>
        <Text style={styles.roleBadgeText}>👤 Customer login</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 'phone' ? (
        <>
          <Text style={styles.fieldLabel}>Enter your phone number to continue</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="Your name (optional)"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Referral code (optional)"
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.button}
            onPress={sendOtp}
            disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.info}>We sent an OTP to {phone}</Text>
          {devHint ? <Text style={styles.dev}>{devHint}</Text> : null}
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="Enter OTP"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={verify}
            disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify & continue</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('phone')}>
            <Text style={styles.link}>Change number</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.divider}>
        <Text style={styles.dividerText}>Not a customer?</Text>
      </View>
      <TouchableOpacity style={styles.roleBtn} onPress={() => navigation.navigate('DeliveryRegister')}>
        <Text style={styles.roleBtnText}>🛵  I'm a delivery partner</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.roleBtn} onPress={() => navigation.navigate('ShopLogin')}>
        <Text style={styles.roleBtnText}>🏪  I'm a shop owner</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 24,
  },
  roleBadge: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 18,
  },
  roleBadgeText: {color: '#fff', fontWeight: '700', fontSize: 13},
  fieldLabel: {color: colors.muted, fontSize: 13, marginBottom: 8},
  divider: {borderTopWidth: 1, borderTopColor: colors.border, marginTop: 24, marginBottom: 12, alignItems: 'center'},
  dividerText: {color: colors.muted, fontSize: 12, backgroundColor: colors.bg, paddingHorizontal: 10, marginTop: -8},
  roleBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  roleBtnText: {color: colors.text, fontWeight: '600'},
  info: {color: colors.text, marginBottom: 8},
  dev: {color: colors.warning, fontSize: 12, marginBottom: 8},
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  codeInput: {fontSize: 20, letterSpacing: 6, textAlign: 'center'},
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {color: '#fff', fontWeight: '600'},
  link: {color: colors.primary, textAlign: 'center', marginTop: 16},
  error: {color: '#c62828', textAlign: 'center', marginBottom: 12},
});
