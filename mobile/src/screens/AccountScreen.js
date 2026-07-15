import React, {useEffect, useState} from 'react';
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
import {useAuth} from '../context/AuthContext';
import {listMyCoupons} from '../api/orders';
import {setPassword as setPasswordApi} from '../api/auth';
import {colors} from '../theme';

export default function AccountScreen({navigation}) {
  const {user, logout} = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    listMyCoupons()
      .then(setCoupons)
      .catch(() => setCoupons([]));
  }, []);

  async function savePassword() {
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    setPasswordError('');
    setSavingPassword(true);
    try {
      await setPasswordApi(newPassword);
      setNewPassword('');
      setShowPasswordForm(false);
      Alert.alert('Password set', 'You can now also sign in with your phone number and this password.');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Could not set password');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        {user?.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}
        {user?.address ? <Text style={styles.meta}>{user.address}</Text> : null}
      </View>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => navigation.navigate('MyCatering')}>
        <Text style={styles.linkRowText}>My catering bookings</Text>
        <Text style={styles.linkChevron}>{'>'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => navigation.navigate('PaymentHistory')}>
        <Text style={styles.linkRowText}>Payment history</Text>
        <Text style={styles.linkChevron}>{'>'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => navigation.navigate('Help')}>
        <Text style={styles.linkRowText}>Help & FAQ</Text>
        <Text style={styles.linkChevron}>{'>'}</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Password login</Text>
        <Text style={styles.body}>
          Set a password so you can sign in with your phone number and password, as a backup to OTP.
        </Text>
        {showPasswordForm ? (
          <>
            {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
            <TextInput
              style={styles.passwordInput}
              placeholder="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity style={styles.smallButton} onPress={savePassword} disabled={savingPassword}>
              {savingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.smallButtonText}>Save password</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.smallButton} onPress={() => setShowPasswordForm(true)}>
            <Text style={styles.smallButtonText}>Set password</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Refer and earn</Text>
        <Text style={styles.body}>
          Share this code with a friend. They get a welcome coupon, and you get
          a bonus coupon after their first order.
        </Text>
        <Text style={styles.referralCode}>
          {user?.referralCode || 'Login again to generate your code'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Active coupons</Text>
        {coupons.length ? (
          coupons.map(coupon => (
            <View key={coupon._id} style={styles.couponRow}>
              <Text style={styles.couponCode}>{coupon.code}</Text>
              <Text style={styles.meta}>
                {coupon.type === 'free_delivery'
                  ? 'Free delivery on your next order — thanks for being a regular!'
                  : `Rs ${coupon.amount} off orders above Rs ${coupon.minOrderAmount}`}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.body}>No active coupons yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>About Munchbox</Text>
        <Text style={styles.body}>
          Order fresh, customizable cakes and track your delivery live on a map.
          Chat directly with your delivery partner to share instructions like
          gate codes or landmarks.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>How delivery works</Text>
        <Text style={styles.body}>
          1. Place your order and pick a delivery date.
        </Text>
        <Text style={styles.body}>
          2. We bake it. Customized cakes need a day's notice.
        </Text>
        <Text style={styles.body}>
          3. A delivery partner picks it up and you see them live on the map.
        </Text>
        <Text style={styles.body}>
          4. Chat with them and receive your order.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.meta}>Munchbox - Version 1.0.0</Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg},
  content: {padding: 16},
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {color: '#fff', fontSize: 26, fontWeight: '700'},
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  linkRowText: {color: colors.text, fontWeight: '600', fontSize: 14},
  linkChevron: {color: colors.muted, fontSize: 22},
  name: {fontSize: 18, fontWeight: '700', color: colors.text},
  meta: {fontSize: 13, color: colors.muted, marginTop: 2},
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  body: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 4,
    alignSelf: 'flex-start',
    lineHeight: 19,
  },
  referralCode: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  couponRow: {
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 8,
  },
  couponCode: {color: colors.text, fontWeight: '800', fontSize: 14},
  passwordInput: {
    alignSelf: 'stretch',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  smallButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  smallButtonText: {color: '#fff', fontWeight: '600', fontSize: 13},
  error: {color: '#c62828', alignSelf: 'stretch', marginTop: 8},
  logout: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  logoutText: {color: '#fff', fontWeight: '600'},
});
