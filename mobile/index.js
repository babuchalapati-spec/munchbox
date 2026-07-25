/**
 * @format
 *
 * One codebase, four apps. Each Android product flavor (see android/app/build.gradle)
 * launches a different registered component, and that is the only thing deciding which
 * role an installed APK is for — everything else branches on the `appType` prop.
 */

import React from 'react';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

const APPS = {
  MunchboxCustomer: 'customer',
  MunchboxPartner: 'partner',
  MunchboxShop: 'shop',
  MunchboxAdmin: 'admin',
  // Kept registered so a stale build, or Metro launched by the old name, still starts
  // as the customer app instead of crashing with "component not registered".
  [appName]: 'customer',
};

Object.entries(APPS).forEach(([componentName, appType]) => {
  AppRegistry.registerComponent(componentName, () => props => (
    <App {...props} appType={appType} />
  ));
});
