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
import {colors, brandGradient} from '../theme';

export default function RegisterScreen({navigation}) {
  const {register} = useAuth();
  const [form, setForm] = useState({name: '', address: '', phone: '', password: ''});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({...f, [field]: value}));
  }

  async function handleSubmit() {
    if (!form.name || !form.phone || !form.password) {
      setError('Name, phone number and password are required');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      // On success the navigator switches to the app automatically.
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={brandGradient} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoEmoji}>🍰</Text>
        </View>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join Munchbox in a minute</Text>
      </LinearGradient>

      <View style={styles.formCard}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} placeholder="Your full name" value={form.name} onChangeText={(v) => update('name', v)} />

        <Text style={styles.label}>Phone number</Text>
        <TextInput
          style={styles.input}
          placeholder="Phone number"
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={(v) => update('phone', v)}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Flat, street, city, pincode (optional)"
          multiline
          value={form.address}
          onChangeText={(v) => update('address', v)}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Create a password"
          secureTextEntry
          value={form.password}
          onChangeText={(v) => update('password', v)}
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('OtpLogin')}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg},
  scrollContent: {flexGrow: 1},
  hero: {
    paddingTop: 56,
    paddingBottom: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoEmoji: {fontSize: 28},
  title: {fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center'},
  subtitle: {fontSize: 13, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginTop: 4, fontWeight: '500'},
  formCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    padding: 24,
    paddingTop: 28,
  },
  label: {fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 4},
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  multiline: {minHeight: 60, textAlignVertical: 'top'},
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {color: '#fff', fontWeight: '600'},
  link: {color: colors.primary, textAlign: 'center', marginTop: 16},
  error: {color: '#c62828', textAlign: 'center', marginBottom: 12},
});
