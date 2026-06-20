import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useAuthStore } from '../store/auth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import Purchases from 'react-native-purchases';
import '../global.css';

export default function RootLayout() {
  const { isAuthenticated, initializeAuth, token } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  
  // Initialize Push Notifications
  usePushNotifications();

  useEffect(() => {
    initializeAuth();
    
    // Initialize RevenueCat
    if (Platform.OS === 'ios' && process.env.EXPO_PUBLIC_RC_IOS) {
      Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_RC_IOS });
    } else if (Platform.OS === 'android' && process.env.EXPO_PUBLIC_RC_ANDROID) {
      Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_RC_ANDROID });
    }
  }, []);

  useEffect(() => {
    // Wait until auth is initialized before routing
    if (token === undefined) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to the login page.
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect away from the login page.
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, token]);

  if (token === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#16C784" />
      </View>
    );
  }

  return <Slot />;
}
