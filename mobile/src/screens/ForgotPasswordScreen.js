import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {requestOtp, resetPasswordWithOtp} from '../api/auth';
import {colors} from '../theme';

// Forgot-password for customers: verify the phone via OTP, then set a new password.
// Only works once real SMS is configured in admin Settings — same as OTP login itself.
export default function ForgotPasswordScreen({navigation}) {
  const [step, setStep] = useState('phone'); // 'phone' | 'reset'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
      await requestOtp(phone);
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!code) {
      setError('Enter the OTP');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await resetPasswordWithOtp(phone, code, newPassword, 'customer');
      Alert.alert('Password updated', 'You can now log in with your new password.', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset your password</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 'phone' ? (
        <>
          <Text style={styles.label}>Enter the phone number on your account</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TouchableOpacity style={styles.button} onPress={sendOtp} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>OTP sent to {phone}</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="Enter OTP"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <TextInput
            style={styles.input}
            placeholder="New password"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity style={styles.button} onPress={reset} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset password</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('phone')}>
            <Text style={styles.link}>Change number</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>← Back to login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center'},
  title: {fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 20},
  label: {color: colors.muted, fontSize: 13, marginBottom: 8},
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  codeInput: {fontSize: 20, letterSpacing: 6, textAlign: 'center'},
  button: {backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4},
  buttonText: {color: '#fff', fontWeight: '600'},
  link: {color: colors.primary, textAlign: 'center', marginTop: 16},
  error: {color: '#c62828', textAlign: 'center', marginBottom: 12},
});
