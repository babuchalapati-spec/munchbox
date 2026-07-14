import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../context/AuthContext';
import {requestOtp} from '../api/auth';
import {colors, brandGradient} from '../theme';

export default function OtpLoginScreen({navigation}) {
  const {loginWithOtp, login} = useAuth();
  const [authMethod, setAuthMethod] = useState('otp'); // 'otp' | 'password'
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doPasswordLogin() {
    if (!phone || !password) {
      setError('Enter your phone number and password');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await login(phone, password);
      // On success the navigator switches to the app automatically.
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp() {
    if (!phone || phone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await requestOtp(phone, name, referralCode);
      setStep('otp');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={brandGradient} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoEmoji}>🍰</Text>
        </View>
        <Text style={styles.title}>Munchbox</Text>
        <Text style={styles.subtitle}>Cakes, food & catering — delivered warm</Text>
      </LinearGradient>

      <View style={styles.formCard}>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>👤 Customer login</Text>
        </View>

        <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, authMethod === 'otp' && styles.tabActive]}
          onPress={() => { setAuthMethod('otp'); setError(''); }}>
          <Text style={[styles.tabText, authMethod === 'otp' && styles.tabTextActive]}>OTP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, authMethod === 'password' && styles.tabActive]}
          onPress={() => { setAuthMethod('password'); setError(''); }}>
          <Text style={[styles.tabText, authMethod === 'password' && styles.tabTextActive]}>Password</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {authMethod === 'password' ? (
        <>
          <Text style={styles.fieldLabel}>Sign in with your phone number and password</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.button} onPress={doPasswordLogin} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </>
      ) : step === 'phone' ? (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    paddingTop: 64,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoEmoji: {fontSize: 32},
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
  },
  formCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    padding: 24,
    paddingTop: 28,
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
  tabRow: {flexDirection: 'row', gap: 8, marginBottom: 16},
  tab: {flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.card},
  tabActive: {borderColor: colors.primary, backgroundColor: colors.primary},
  tabText: {fontSize: 13, color: colors.text, fontWeight: '600'},
  tabTextActive: {color: '#fff'},
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
