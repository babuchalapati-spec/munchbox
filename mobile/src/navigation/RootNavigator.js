import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
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

const authScreens = {
  OtpLogin: { component: OtpLoginScreen, headerShown: false },
  ForgotPassword: { component: ForgotPasswordScreen, title: 'Reset password' },
  Register: { component: RegisterScreen, title: 'Create account' },
  DeliveryRegister: { component: DeliveryRegisterScreen, title: 'Delivery partner' },
  ShopLogin: { component: ShopLoginScreen, headerShown: false },
  ServerSettings: { component: ServerSettingsScreen, title: 'Server settings' },
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
  Chat: { component: ChatScreen, title: 'Chat' },
};

const shopOwnerScreens = {
  ShopOwner: { component: ShopOwnerScreen, headerShown: false },
  Earnings: { component: EarningsScreen, title: 'Earnings' },
  Chat: { component: ChatScreen, title: 'Chat' },
};

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <StackNavigator key="auth" screens={authScreens} initialRouteName="OtpLogin" />;
  }

  if (user.role === 'delivery') {
    return <StackNavigator key="delivery" screens={deliveryScreens} initialRouteName="DeliveryOrders" />;
  }

  if (user.role === 'shop') {
    return <StackNavigator key="shop" screens={shopOwnerScreens} initialRouteName="ShopOwner" />;
  }

  return <BottomTabNavigator key="app" tabs={customerTabs} screens={customerScreens} initialTab="Home" />;
}
