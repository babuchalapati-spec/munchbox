import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { shopRegister, requestOtp } from '../api/auth';
import { colors } from '../theme';

const CATEGORIES = [
  { key: 'cake', label: '🎂 Cakes' },
  { key: 'restaurant', label: '🍔 Restaurant' },
  { key: 'catering', label: '🍽️ Catering' },
];

// Shop owner entry: sign in (email + password, plus an authenticator code if the
// admin has turned two-factor on for this shop), or self-register a new shop.
export default function ShopLoginScreen({ navigation }) {
  const { login, verifyShop2fa, loginWithOtp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'twofa' | 'register'
  const [authMethod, setAuthMethod] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', shopName: '', category: 'cake', address: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // OTP login
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState('phone'); // 'phone' | 'code'
  const [devHint, setDevHint] = useState('');

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function doLogin() {
    if (!email || !password) return setError('Enter email and password');
    setError('');
    setBusy(true);
    try {
      const res = await login(email.trim(), password);
      if (res.twoFactorRequired) {
        setTicket(res.ticket);
        setMode('twofa');
      }
      // else: logged in; navigator switches to the shop dashboard automatically.
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendShopOtp() {
    if (!phone) return setError('Enter your phone number');
    setError('');
    setBusy(true);
    try {
      const res = await requestOtp(phone);
      setDevHint(res.devMode && res.devCode ? `Dev code: ${res.devCode}` : '');
      setOtpStep('code');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function verifyShopOtp() {
    if (!otpCode) return setError('Enter the code sent to your phone');
    setError('');
    setBusy(true);
    try {
      const res = await loginWithOtp(phone.trim(), otpCode.trim(), undefined, 'shop');
      if (res.twoFactorRequired) {
        setTicket(res.ticket);
        setMode('twofa');
      } else if (res.needsRegistration) {
        setError('No shop account for this number. Register below, or sign in with email and password.');
      }
      // else: logged in; navigator switches to the shop dashboard automatically.
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  async function doVerify2fa() {
    if (!code) return setError('Enter the 6-digit authenticator code');
    setError('');
    setBusy(true);
    try {
      await verifyShop2fa(ticket, code.trim());
      // navigator switches to the shop dashboard automatically.
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  async function doRegister() {
    if (!form.name || !email || !password || !form.phone || !form.shopName) {
      return setError('Name, email, password, phone and shop name are required');
    }
    setError('');
    setBusy(true);
    try {
      const res = await shopRegister({
        name: form.name,
        email: email.trim(),
        password,
        phone: form.phone,
        shopName: form.shopName,
        category: form.category,
        address: form.address,
      });
      Alert.alert(
        'Registration submitted',
        res.message || 'An admin will review and approve your shop before you can log in.',
        [{ text: 'OK', onPress: () => { setMode('login'); setCode(''); setPassword(''); } }],
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🏪 Shop owner</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {mode === 'login' && (
        <>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, authMethod === 'password' && styles.tabActive]}
              onPress={() => { setAuthMethod('password'); setError(''); }}
            >
              <Text style={[styles.tabText, authMethod === 'password' && styles.tabTextActive]}>Password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, authMethod === 'otp' && styles.tabActive]}
              onPress={() => { setAuthMethod('otp'); setError(''); }}
            >
              <Text style={[styles.tabText, authMethod === 'otp' && styles.tabTextActive]}>OTP</Text>
            </TouchableOpacity>
          </View>

          {authMethod === 'password' ? (
            <>
              <Text style={styles.sub}>
                Sign in with your email and password. If your admin has turned on two-factor for your shop,
                you'll be asked for an authenticator code next.
              </Text>
              <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
              <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
              <TouchableOpacity style={styles.button} onPress={doLogin} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
              </TouchableOpacity>
            </>
          ) : otpStep === 'phone' ? (
            <>
              <Text style={styles.sub}>Sign in with the phone number on your shop account.</Text>
              <TextInput style={styles.input} placeholder="Phone number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              <TouchableOpacity style={styles.button} onPress={sendShopOtp} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sub}>OTP sent to {phone}</Text>
              {devHint ? <Text style={styles.devHint}>{devHint}</Text> : null}
              <TextInput style={[styles.input, styles.code]} placeholder="000000" keyboardType="number-pad" maxLength={6} value={otpCode} onChangeText={setOtpCode} />
              <TouchableOpacity style={styles.button} onPress={verifyShopOtp} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & sign in</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setOtpStep('phone'); setOtpCode(''); setError(''); }}>
                <Text style={styles.link}>← Change number</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => { setMode('register'); setError(''); }}>
            <Text style={styles.link}>New shop? Register here</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'twofa' && (
        <>
          <Text style={styles.sub}>Enter the 6-digit code from Microsoft Authenticator.</Text>
          <TextInput style={[styles.input, styles.code]} placeholder="000000" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
          <TouchableOpacity style={styles.button} onPress={doVerify2fa} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & sign in</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setMode('login'); setCode(''); }}>
            <Text style={styles.link}>← Back</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'register' && (
        <>
          <Text style={styles.sub}>Register your shop and start managing your menu right away.</Text>
          <TextInput style={styles.input} placeholder="Your name" value={form.name} onChangeText={(v) => upd('name', v)} />
          <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.input} placeholder="Phone (required)" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => upd('phone', v)} />
          <TextInput style={styles.input} placeholder="Shop name" value={form.shopName} onChangeText={(v) => upd('shopName', v)} />
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.cat, form.category === c.key && styles.catActive]}
                onPress={() => upd('category', c.key)}
              >
                <Text style={[styles.catText, form.category === c.key && styles.catTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Shop address" value={form.address} onChangeText={(v) => upd('address', v)} />
          <TouchableOpacity style={styles.button} onPress={doRegister} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register shop</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setMode('login'); setError(''); }}>
            <Text style={styles.link}>← Back to sign in</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={() => navigation.navigate('OtpLogin')}>
        <Text style={styles.link}>← Back to customer login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 8 },
  sub: { color: colors.muted, marginBottom: 16, lineHeight: 19 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.card },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  tabText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  devHint: { color: '#a86b00', fontSize: 12, marginBottom: 10 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 10 },
  code: { fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { color: colors.primary, textAlign: 'center', marginTop: 16 },
  error: { color: '#c62828', marginBottom: 10 },
  catRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  cat: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.card },
  catActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  catText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  catTextActive: { color: '#fff' },
});
