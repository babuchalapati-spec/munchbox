import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LABEL_FOR_APP, ROLE_FOR_APP } from '../appType';
import { colors } from '../theme';
import StackNavigator from './StackNavigator';
import BottomTabNavigator from './BottomTabNavigator';

import OtpLoginScreen from '../screens/OtpLoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ServerSettingsScreen from '../screens/ServerSettingsScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DeliveryRegisterScreen from '../screens/DeliveryRegisterScreen';
import ShopLoginScreen from '../screens/ShopLoginScreen';
import LandingScreen from '../screens/LandingScreen';
import ShopsScreen from '../screens/ShopsScreen';
import ShopScreen from '../screens/ShopScreen';
import CateringRequestScreen from '../screens/CateringRequestScreen';
import MyCateringScreen from '../screens/MyCateringScreen';
import FoodPickupScreen from '../screens/FoodPickupScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import ChatScreen from '../screens/ChatScreen';
import AccountScreen from '../screens/AccountScreen';
import DeliveryOrdersScreen from '../screens/DeliveryOrdersScreen';
import DeliveryOrderDetailScreen from '../screens/DeliveryOrderDetailScreen';
import NearbyDeliveriesScreen from '../screens/NearbyDeliveriesScreen';
import ShopOwnerScreen from '../screens/ShopOwnerScreen';
import EarningsScreen from '../screens/EarningsScreen';
import RazorpayCheckoutScreen from '../screens/RazorpayCheckoutScreen';
import HelpChatScreen from '../screens/HelpChatScreen';
import PaymentHistoryScreen from '../screens/PaymentHistoryScreen';
import AdminScreen from '../screens/AdminScreen';

// Every app can always reach these two: password reset, and the server address screen
// (the way out when a phone is on a network the backend isn't reachable from).
const sharedAuthScreens = {
  ForgotPassword: { component: ForgotPasswordScreen, title: 'Reset password' },
  ServerSettings: { component: ServerSettingsScreen, title: 'Server settings' },
};

// Sign-in screens per app. The four APKs are single-role, so each one offers only its
// own way in — no "I'm a delivery partner" cross-links to a role this app can't run.
const authScreensByApp = {
  customer: {
    OtpLogin: { component: OtpLoginScreen, headerShown: false },
    Register: { component: RegisterScreen, title: 'Create account' },
    ...sharedAuthScreens,
  },
  partner: {
    OtpLogin: { component: OtpLoginScreen, headerShown: false },
    DeliveryRegister: { component: DeliveryRegisterScreen, title: 'Become a partner' },
    ...sharedAuthScreens,
  },
  shop: {
    ShopLogin: { component: ShopLoginScreen, headerShown: false },
    ...sharedAuthScreens,
  },
  // The admin dashboard does its own login inside the WebView, so the admin app has
  // no native sign-in step at all.
  admin: {
    Admin: { component: AdminScreen, headerShown: false },
    ...sharedAuthScreens,
  },
};

const initialAuthRoute = {
  customer: 'OtpLogin',
  partner: 'OtpLogin',
  shop: 'ShopLogin',
  admin: 'Admin',
};

const customerTabs = [
  { name: 'Home', label: 'Home', icon: '🏠' },
  { name: 'Orders', label: 'Orders', icon: '🧾' },
  { name: 'Account', label: 'Account', icon: '👤' },
];

const customerScreens = {
  Home: { component: LandingScreen, headerShown: false },
  Shops: { component: ShopsScreen, title: 'Shops' },
  Shop: { component: ShopScreen, title: 'Shop' },
  CateringRequest: { component: CateringRequestScreen, title: 'Catering' },
  MyCatering: { component: MyCateringScreen, title: 'My catering' },
  FoodPickup: { component: FoodPickupScreen, title: 'Food pickup' },
  ProductDetail: { component: ProductDetailScreen, title: 'Details' },
  Cart: { component: CartScreen, title: 'Your cart' },
  Checkout: { component: CheckoutScreen, title: 'Checkout' },
  RazorpayCheckout: { component: RazorpayCheckoutScreen, title: 'Payment' },
  Orders: { component: OrdersScreen, title: 'My orders' },
  OrderTracking: { component: OrderTrackingScreen, title: 'Track order' },
  Chat: { component: ChatScreen, title: 'Chat' },
  Help: { component: HelpChatScreen, title: 'Help' },
  PaymentHistory: { component: PaymentHistoryScreen, title: 'Payment history' },
  Account: { component: AccountScreen, title: 'Account' },
};

const deliveryScreens = {
  DeliveryOrders: { component: DeliveryOrdersScreen, headerShown: false },
  NearbyDeliveries: { component: NearbyDeliveriesScreen, headerShown: false },
  DeliveryOrderDetail: { component: DeliveryOrderDetailScreen, title: 'Delivery' },
  Earnings: { component: EarningsScreen, title: 'Earnings' },
  RazorpayCheckout: { component: RazorpayCheckoutScreen, title: 'Payment' },
  Chat: { component: ChatScreen, title: 'Chat' },
};

const shopOwnerScreens = {
  ShopOwner: { component: ShopOwnerScreen, headerShown: false },
  Earnings: { component: EarningsScreen, title: 'Earnings' },
  RazorpayCheckout: { component: RazorpayCheckoutScreen, title: 'Payment' },
  Chat: { component: ChatScreen, title: 'Chat' },
};

// Shown when someone signs in with an account this app isn't for — e.g. a delivery
// account on the customer app. Without it they'd land on a screen set their role has
// no data for and see empty lists instead of an explanation.
function WrongAppScreen({ appType, role, onLogout }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.wrongTitle}>Wrong app for this account</Text>
      <Text style={styles.wrongText}>
        This is the {LABEL_FOR_APP[appType]?.toLowerCase()} app, but you signed in with a{' '}
        {LABEL_FOR_APP[Object.keys(ROLE_FOR_APP).find((k) => ROLE_FOR_APP[k] === role)]?.toLowerCase() || role}{' '}
        account. Install the matching Munchbox app and sign in there.
      </Text>
      <TouchableOpacity style={styles.wrongBtn} onPress={onLogout}>
        <Text style={styles.wrongBtnText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootNavigator({ appType = 'customer' }) {
  const { user, loading, logout } = useAuth();
  const expectedRole = ROLE_FOR_APP[appType] || 'customer';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // The admin app is the dashboard in a WebView, which handles its own session — it
  // never uses the native auth state at all.
  if (appType === 'admin') {
    return <StackNavigator key="admin" screens={authScreensByApp.admin} initialRouteName="Admin" />;
  }

  if (!user) {
    return (
      <StackNavigator
        key="auth"
        screens={authScreensByApp[appType] || authScreensByApp.customer}
        initialRouteName={initialAuthRoute[appType] || 'OtpLogin'}
      />
    );
  }

  if (user.role !== expectedRole) {
    return <WrongAppScreen appType={appType} role={user.role} onLogout={logout} />;
  }

  if (user.role === 'delivery') {
    return <StackNavigator key="delivery" screens={deliveryScreens} initialRouteName="DeliveryOrders" />;
  }

  if (user.role === 'shop') {
    return <StackNavigator key="shop" screens={shopOwnerScreens} initialRouteName="ShopOwner" />;
  }

  return <BottomTabNavigator key="app" tabs={customerTabs} screens={customerScreens} initialTab="Home" />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  wrongTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10, textAlign: 'center' },
  wrongText: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  wrongBtn: { backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  wrongBtnText: { color: '#fff', fontWeight: '700' },
});
