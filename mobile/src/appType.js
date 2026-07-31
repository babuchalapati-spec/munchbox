import React, {createContext, useContext} from 'react';

/**
 * Which of the four Munchbox apps this build is. Set once in index.js from the Android
 * product flavor and read anywhere that needs to differ per app — login screens, the
 * update check, and the navigator's screen list.
 *
 * appType   applicationId            account role   entry
 * customer  com.munchbox.customer    customer       shop browsing + ordering
 * partner   com.munchbox.partner     delivery       deliveries + earnings
 * shop      com.munchbox.shop        shop           shop owner dashboard
 * admin     com.munchbox.admin       admin          admin dashboard (WebView)
 */
const AppTypeContext = createContext('customer');

// The account role the backend must return for a login to be accepted in this app.
// Keeps a delivery account from signing in to the customer app and vice versa.
export const ROLE_FOR_APP = {
  customer: 'customer',
  partner: 'delivery',
  shop: 'shop',
  admin: 'admin',
};

export const LABEL_FOR_APP = {
  customer: 'Customer',
  partner: 'Delivery partner',
  shop: 'Shop owner',
  admin: 'Admin',
};

// The app's actual name, matching each flavor's android:label in build.gradle — what the
// phone's home screen shows for that APK. Used anywhere in-app branding needs to match the
// launcher name instead of always saying "Munchbox" (which is only the customer app's name).
export const APP_NAME = {
  customer: 'Munchbox',
  partner: 'Munchbox Partner',
  shop: 'Munchbox Shop',
  admin: 'Munchbox Admin',
};

export function AppTypeProvider({appType = 'customer', children}) {
  return <AppTypeContext.Provider value={appType}>{children}</AppTypeContext.Provider>;
}

export function useAppType() {
  return useContext(AppTypeContext);
}

export function useAppRole() {
  return ROLE_FOR_APP[useAppType()] || 'customer';
}
