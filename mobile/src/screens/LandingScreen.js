import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { colors, brandGradient, cardShadow, categoryThemes } from '../theme';

// Cross-promotion / partner ads shown in the app.
const ADS = [
  { title: 'Drivo — Ride anywhere', text: 'Book bikes & cabs in minutes.', gradient: ['#42A5F5', '#1565C0'], icon: '🚗', url: 'https://example.com/drivo' },
  { title: 'RentEasy — Rent anything', text: 'Homes, gear and more on rent.', gradient: ['#66BB6A', '#2E7D32'], icon: '🏠', url: 'https://example.com/rent' },
];

const CATEGORIES = [
  { key: 'cake', label: 'Cakes', icon: '🎂', blurb: 'Fresh & customized' },
  { key: 'restaurant', label: 'Restaurants', icon: '🍔', blurb: 'Hot meals, fast' },
  { key: 'catering', label: 'Catering', icon: '🍽️', blurb: 'Book for events' },
];

const SPECIALTIES = [
  { icon: '🎂', title: 'Custom cakes', text: 'Personalise flavour, message and photo — baked to order.' },
  { icon: '🍛', title: 'Restaurant parcels', text: 'Hot meals and biryani from local kitchens.' },
  { icon: '🍽️', title: 'Event catering', text: 'Get a bulk quote for weddings and parties, with discounts.' },
  { icon: '📍', title: 'Live tracking', text: 'Watch your delivery move on a live map.' },
];

export default function LandingScreen({ navigation }) {
  const { items } = useCart();
  const { user } = useAuth();
  const firstName = (user?.name || '').trim().split(' ')[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.brand}>🍱 Munchbox</Text>
            {firstName ? <Text style={styles.greeting}>Hi, {firstName} 👋</Text> : null}
          </View>
          <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')} activeOpacity={0.8}>
            <Text style={styles.cartButtonIcon}>🛒</Text>
            {items.length > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{items.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.tagline}>Cakes, food and catering{'\n'}delivered to your door.</Text>

        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Shops', {})}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search shops, cakes, dishes...</Text>
        </TouchableOpacity>
      </LinearGradient>

      <Text style={styles.sectionTitle}>What are you looking for?</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => {
          const theme = categoryThemes[c.key];
          return (
            <TouchableOpacity
              key={c.key}
              style={styles.categoryCardWrap}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Shops', { category: c.key, title: c.label })}
            >
              <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.categoryCard}>
                <Text style={styles.categoryIcon}>{c.icon}</Text>
                <Text style={styles.categoryLabel}>{c.label}</Text>
                <Text style={styles.categoryBlurb}>{c.blurb}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.pickupBannerWrap} activeOpacity={0.85} onPress={() => navigation.navigate('FoodPickup')}>
        <LinearGradient colors={['#26A69A', '#00695C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pickupBanner}>
          <View style={styles.pickupIconWrap}>
            <Text style={styles.pickupIcon}>🛵</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pickupTitle}>Food pickup & delivery</Text>
            <Text style={styles.pickupText}>Send food home ↔ office. We pick up and deliver.</Text>
          </View>
          <Text style={styles.pickupChevron}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Our specialities</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specScroll}>
        {SPECIALTIES.map((s) => (
          <View key={s.title} style={[styles.specCard, cardShadow(1)]}>
            <View style={styles.specIconBadge}>
              <Text style={styles.specIcon}>{s.icon}</Text>
            </View>
            <Text style={styles.specTitle}>{s.title}</Text>
            <Text style={styles.specText}>{s.text}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>From our partners</Text>
      {ADS.map((ad) => (
        <TouchableOpacity key={ad.title} style={styles.adCardWrap} activeOpacity={0.85} onPress={() => Linking.openURL(ad.url)}>
          <LinearGradient colors={ad.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.adCard}>
            <Text style={styles.adIcon}>{ad.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.adTitle}>{ad.title}</Text>
              <Text style={styles.adText}>{ad.text}</Text>
            </View>
            <Text style={styles.adCta}>Open ›</Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}

      <View style={[styles.infoCard, cardShadow(1)]}>
        <Text style={styles.infoTitle}>Why Munchbox?</Text>
        <View style={styles.infoLine}>
          <Text style={styles.infoBullet}>✓</Text>
          <Text style={styles.infoLineText}>Cakes, restaurants and catering — all in one app</Text>
        </View>
        <View style={styles.infoLine}>
          <Text style={styles.infoBullet}>✓</Text>
          <Text style={styles.infoLineText}>Transparent delivery charges based on distance</Text>
        </View>
        <View style={styles.infoLine}>
          <Text style={styles.infoBullet}>✓</Text>
          <Text style={styles.infoLineText}>Live GPS tracking once your order is out for delivery</Text>
        </View>
        <View style={styles.infoLine}>
          <Text style={styles.infoBullet}>✓</Text>
          <Text style={styles.infoLineText}>Chat with your delivery partner for instructions</Text>
        </View>
      </View>

      <Text style={styles.footer}>Munchbox</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  hero: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  greeting: { color: 'rgba(255,255,255,0.95)', fontSize: 14, fontWeight: '600', marginTop: 4 },
  cartButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButtonIcon: { fontSize: 18 },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  tagline: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 18, lineHeight: 30 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 18,
    gap: 8,
  },
  searchIcon: { fontSize: 15 },
  searchPlaceholder: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  categoryRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  categoryCardWrap: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  categoryCard: { padding: 14, alignItems: 'center', minHeight: 118, justifyContent: 'center' },
  categoryIcon: { fontSize: 30 },
  categoryLabel: { fontSize: 13, fontWeight: '800', color: '#fff', marginTop: 8 },
  categoryBlurb: { fontSize: 10, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 2 },
  pickupBannerWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  pickupBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  pickupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupIcon: { fontSize: 22 },
  pickupTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  pickupText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  pickupChevron: { color: '#fff', fontSize: 26, fontWeight: '300' },
  specScroll: { gap: 12, paddingRight: 4, marginBottom: 24 },
  specCard: {
    width: 168,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  specIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  specIcon: { fontSize: 22 },
  specTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  specText: { fontSize: 12, color: colors.muted, marginTop: 5, lineHeight: 17 },
  adCardWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  adCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  adIcon: { fontSize: 22 },
  adTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  adText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 1 },
  adCta: { color: '#fff', fontWeight: '800', fontSize: 12 },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    marginTop: 10,
  },
  infoTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  infoBullet: { color: colors.success, fontWeight: '800', fontSize: 13 },
  infoLineText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, marginBottom: 8 },
});
