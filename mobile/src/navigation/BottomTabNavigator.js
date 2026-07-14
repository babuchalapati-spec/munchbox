import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { colors } from '../theme';
import ActiveDeliveryBanner from '../components/ActiveDeliveryBanner';

// A lightweight bottom-tab navigator with an independent screen stack per tab,
// so each tab remembers where you were. No native navigation deps.
export default function BottomTabNavigator({ tabs, screens, initialTab }) {
  const tabRoots = tabs.map((t) => t.name);

  const activeTabRef = useRef(initialTab);
  const [activeTab, setActiveTabState] = useState(initialTab);
  const setActiveTab = (name) => {
    activeTabRef.current = name;
    setActiveTabState(name);
  };

  const [stacks, setStacks] = useState(() =>
    tabs.reduce((acc, t) => {
      acc[t.name] = [{ name: t.name, params: undefined }];
      return acc;
    }, {})
  );

  const navigation = useMemo(
    () => ({
      navigate(name, params) {
        if (tabRoots.includes(name)) {
          setActiveTab(name);
          setStacks((s) => ({ ...s, [name]: [{ name, params }] }));
        } else {
          const tab = activeTabRef.current;
          setStacks((s) => ({ ...s, [tab]: [...s[tab], { name, params }] }));
        }
      },
      goBack() {
        const tab = activeTabRef.current;
        setStacks((s) => ({ ...s, [tab]: s[tab].length > 1 ? s[tab].slice(0, -1) : s[tab] }));
      },
      reset({ routes }) {
        const target = routes[routes.length - 1];
        if (tabRoots.includes(target.name)) {
          setActiveTab(target.name);
          setStacks((s) => ({ ...s, [target.name]: [{ name: target.name, params: target.params }] }));
        } else {
          const tab = activeTabRef.current;
          setStacks((s) => ({ ...s, [tab]: [{ name: target.name, params: target.params }] }));
        }
      },
      switchTab(name) {
        setActiveTab(name);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const currentStack = stacks[activeTab];
  const current = currentStack[currentStack.length - 1];
  const screenConfig = screens[current.name];
  const Component = screenConfig.component;
  const canGoBack = currentStack.length > 1;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      {screenConfig.headerShown !== false && (
        <View style={styles.header}>
          {canGoBack ? (
            <TouchableOpacity onPress={navigation.goBack} style={styles.side}>
              <Text style={styles.back}>‹ Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.side} />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {current.params?.title || screenConfig.title || current.name}
          </Text>
          <View style={styles.side} />
        </View>
      )}

      <View style={styles.body}>
        <Component navigation={navigation} route={{ params: current.params }} />
      </View>

      <ActiveDeliveryBanner navigation={navigation} />

      <View style={styles.tabBar}>
        {tabs.map((t) => {
          const focused = t.name === activeTab;
          return (
            <TouchableOpacity key={t.name} style={styles.tab} onPress={() => navigation.switchTab(t.name)}>
              <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  side: { width: 70 },
  back: { color: colors.primary, fontWeight: '600' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabIcon: { fontSize: 20, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
});
