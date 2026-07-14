import React, { createContext, useContext, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { colors } from '../theme';

const NavigationContext = createContext(null);

export function useNavigation() {
  return useContext(NavigationContext);
}

export default function StackNavigator({ screens, initialRouteName }) {
  const [stack, setStack] = useState([{ name: initialRouteName, params: undefined }]);
  const [navigation] = useState(() => ({
    navigate(name, params) {
      setStack((s) => [...s, { name, params }]);
    },
    goBack() {
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    },
    reset({ routes }) {
      setStack(routes.map((r) => ({ name: r.name, params: r.params })));
    },
  }));

  const current = stack[stack.length - 1];
  const screenConfig = screens[current.name];
  const Component = screenConfig.component;

  return (
    <NavigationContext.Provider value={navigation}>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        {screenConfig.headerShown !== false && (
          <View style={styles.header}>
            {stack.length > 1 ? (
              <TouchableOpacity onPress={navigation.goBack} style={styles.backButton}>
                <Text style={styles.backText}>‹ Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            <Text style={styles.title} numberOfLines={1}>
              {current.params?.title || screenConfig.title || current.name}
            </Text>
            <View style={styles.backButton} />
          </View>
        )}
        <View style={styles.body}>
          <Component navigation={navigation} route={{ params: current.params }} />
        </View>
      </SafeAreaView>
    </NavigationContext.Provider>
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
  backButton: { width: 70 },
  backText: { color: colors.primary, fontWeight: '600' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { flex: 1 },
});
