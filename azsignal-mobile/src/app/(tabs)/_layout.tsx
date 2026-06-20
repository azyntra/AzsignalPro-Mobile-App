import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import Purchases from 'react-native-purchases';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/auth';

export default function TabLayout() {
  usePushNotifications();
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    // API keys should ideally come from environment variables.
    // Using placeholders for now until configured in the RevenueCat dashboard.
    if (Platform.OS !== 'web') {
      if (Platform.OS === 'ios') {
        Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || 'appl_api_key' });
      } else if (Platform.OS === 'android') {
        Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || 'goog_api_key' });
      }

      if (user?.id) {
        Purchases.logIn(user.id.toString());
      }
    }
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1A1A2E' },
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#1E2028',
          borderTopColor: '#333',
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          height: Platform.OS === 'ios' ? 85 : 65,
        },
        tabBarActiveTintColor: '#16C784',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Signals',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="broadcast" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-box" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
