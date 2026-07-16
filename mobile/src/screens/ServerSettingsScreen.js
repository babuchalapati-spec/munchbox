import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {API_URL, setServerUrl, resetServerUrl} from '../api/client';
import {colors} from '../theme';

// Lets whoever's setting up the app point it at a new server address (e.g. after the
// WiFi router hands out a new IP) without needing a new APK build — just type the new
// address here and save. Reachable from every login screen via a small link.
export default function ServerSettingsScreen({navigation}) {
  const [value, setValue] = useState(API_URL.replace('/api', ''));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.trim()) {
      Alert.alert('Enter an address', 'e.g. 192.168.1.8:5001 or https://yourdomain.com');
      return;
    }
    setSaving(true);
    try {
      const applied = await setServerUrl(value);
      Alert.alert('Saved', `The app will now use:\n${applied}`, [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    const restored = await resetServerUrl();
    setValue(restored.replace('/api', ''));
    Alert.alert('Auto-detected', `Found a working server at:\n${restored}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Server settings</Text>
      <Text style={styles.body}>
        This is the address the app uses to reach Munchbox's server. The app automatically tries every address you've
        used before each time it opens (e.g. home and office WiFi) — you only need to type a new one below the first
        time you use a network it hasn't seen yet.
      </Text>

      <Text style={styles.label}>Server address</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder="192.168.1.8:5001"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <TouchableOpacity style={styles.button} onPress={save} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save & use this address'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.resetButton} onPress={reset}>
        <Text style={styles.resetButtonText}>Forget manual address & auto-detect again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 40},
  title: {fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 10},
  body: {fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 24},
  label: {fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8},
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  button: {backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center'},
  buttonText: {color: '#fff', fontWeight: '700'},
  resetButton: {marginTop: 16, alignItems: 'center'},
  resetButtonText: {color: colors.muted, fontSize: 12, textAlign: 'center'},
});
