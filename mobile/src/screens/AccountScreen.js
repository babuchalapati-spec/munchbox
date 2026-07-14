import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {useAuth} from '../context/AuthContext';
import {listMyCoupons} from '../api/orders';
import {colors} from '../theme';

export default function AccountScreen({navigation}) {
  const {user, logout} = useAuth();
  const [coupons, setCoupons] = useState([]);

  useEffect(() => {
    listMyCoupons()
      .then(setCoupons)
      .catch(() => setCoupons([]));
  }, []);

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
                Rs {coupon.amount} off orders above Rs {coupon.minOrderAmount}
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
