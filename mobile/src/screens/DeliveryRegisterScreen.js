import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { requestOtp, submitKyc, deliveryRegister } from '../api/auth';
import { uploadImage } from '../api/upload';
import { colors } from '../theme';

const DOCS = [
  { key: 'photoUrl', label: 'Your photo' },
  { key: 'aadhaarUrl', label: 'Aadhaar card' },
  { key: 'licenseUrl', label: 'Driving license' },
  { key: 'rcUrl', label: 'Bike RC book' },
];

// OTP-first delivery partner entry: phone -> OTP -> log in if registered, else register + KYC.
export default function DeliveryRegisterScreen({ navigation }) {
  const { loginWithOtp, refreshUser } = useAuth();
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'profile' | 'docs'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ name: '', vehicleNumber: '' });
  const [docs, setDocs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function sendOtp() {
    if (!phone || phone.length < 10) return setError('Enter a valid phone number');
    setError('');
    setBusy(true);
    try {
      await requestOtp(phone);
      setStep('otp');
      setResendCooldown(30);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    if (resendCooldown > 0 || busy) return;
    setError('');
    setBusy(true);
    try {
      await requestOtp(phone);
      setResendCooldown(30);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend OTP');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!code || code.length < 4) return setError('Enter the OTP');
    setError('');
    setBusy(true);
    try {
      const result = await loginWithOtp(phone, code, undefined, 'delivery');
      if (result.user) return; // existing partner logged in; navigator switches
      setStep('profile'); // new partner: collect registration + documents
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setBusy(false);
    }
  }

  function pickDoc(key) {
    const isPhotoOnly = key === 'photoUrl';
    const options = [
      { text: 'Camera', onPress: () => capture(key, launchCamera, true) },
      { text: 'Gallery', onPress: () => capture(key, launchImageLibrary, !isPhotoOnly) },
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Add document', isPhotoOnly ? 'Take a photo' : 'Photo or document (PDF)', options);
  }

  async function capture(key, launcher, allowPdf = false) {
    const options = {
      mediaType: 'photo',
      quality: 0.7,
    };
    if (allowPdf && launcher === launchImageLibrary) {
      // For documents, also allow file picker to select PDFs
      options.selectionLimit = 1;
    }

    const res = await launcher(options);
    if (res.didCancel || !res.assets || !res.assets[0]) return;
    const asset = res.assets[0];
    setDocs((d) => ({ ...d, [key]: { uri: asset.uri, uploading: true } }));
    try {
      const url = await uploadImage(asset);
      setDocs((d) => ({ ...d, [key]: { uri: asset.uri, uploading: false, url } }));
    } catch (err) {
      setDocs((d) => ({ ...d, [key]: undefined }));
      setError(`Could not upload ${key === 'photoUrl' ? 'photo' : 'document'}. Check file format and try again.`);
    }
  }

  // Creates the account FIRST so a token exists before touching /uploads (which
  // requires login) — uploading documents before the account existed was why
  // Aadhaar/PAN/license uploads silently failed for new partners. Stores the token
  // directly (not via context) so the navigator doesn't switch away mid-registration,
  // before documents are submitted.
  async function createAccount() {
    if (!form.name) return setError('Enter your name');
    setError('');
    setBusy(true);
    try {
      const { token } = await deliveryRegister({ name: form.name, phone, vehicleNumber: form.vehicleNumber });
      await AsyncStorage.setItem('cake_token', token);
      setStep('docs');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitDocs() {
    const missing = DOCS.filter((d) => !docs[d.key]?.url);
    if (missing.length) return setError(`Please add: ${missing.map((m) => m.label).join(', ')}`);
    setError('');
    setBusy(true);
    try {
      const updated = await submitKyc({
        photoUrl: docs.photoUrl.url,
        aadhaarUrl: docs.aadhaarUrl.url,
        licenseUrl: docs.licenseUrl.url,
        rcUrl: docs.rcUrl.url,
        vehicleNumber: form.vehicleNumber,
      });
      refreshUser(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit documents');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Delivery partner</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 'phone' && (
        <>
          <Text style={styles.sub}>Log in or register with your phone number.</Text>
          <TextInput style={styles.input} placeholder="Phone number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <TouchableOpacity style={styles.button} onPress={sendOtp} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      )}

      {step === 'otp' && (
        <>
          <Text style={styles.sub}>Enter the OTP sent to {phone}</Text>
          <TextInput style={[styles.input, styles.code]} placeholder="OTP" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
          <TouchableOpacity style={styles.button} onPress={verify} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={resendOtp} disabled={resendCooldown > 0 || busy}>
            <Text style={[styles.link, (resendCooldown > 0 || busy) && styles.linkDisabled]}>
              {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('phone')}>
            <Text style={styles.link}>Change number</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'profile' && (
        <>
          <Text style={styles.sub}>New partner — let's set up your account first, then add your documents.</Text>
          <TextInput style={styles.input} placeholder="Full name" value={form.name} onChangeText={(v) => update('name', v)} />
          <TextInput style={styles.input} placeholder="Bike number (e.g. TS09AB1234)" value={form.vehicleNumber} onChangeText={(v) => update('vehicleNumber', v)} />
          <TouchableOpacity style={styles.button} onPress={createAccount} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableOpacity>
        </>
      )}

      {step === 'docs' && (
        <>
          <Text style={styles.sub}>Almost done — upload your documents. Admin will verify.</Text>
          <Text style={styles.section}>Documents</Text>
          {DOCS.map((d) => {
            const doc = docs[d.key];
            return (
              <TouchableOpacity key={d.key} style={styles.docRow} onPress={() => pickDoc(d.key)}>
                {doc?.uri ? (
                  <Image source={{ uri: doc.uri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Text style={styles.thumbPlus}>+</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.docLabel}>{d.label}</Text>
                  <Text style={styles.docStatus}>{doc?.uploading ? 'Uploading...' : doc?.url ? '✓ Added' : 'Tap to add'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.button} onPress={submitDocs} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit documents</Text>}
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
  content: { padding: 20, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 6 },
  sub: { color: colors.muted, marginBottom: 16, lineHeight: 19 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 10 },
  code: { fontSize: 20, letterSpacing: 6, textAlign: 'center' },
  section: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 8 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  thumb: { width: 54, height: 54, borderRadius: 8, backgroundColor: colors.border },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbPlus: { fontSize: 26, color: colors.muted },
  docLabel: { color: colors.text, fontWeight: '600' },
  docStatus: { color: colors.muted, fontSize: 12, marginTop: 2 },
  button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: colors.primary, textAlign: 'center', marginTop: 16 },
  linkDisabled: { color: colors.muted },
  error: { color: '#c62828', marginBottom: 10 },
});
