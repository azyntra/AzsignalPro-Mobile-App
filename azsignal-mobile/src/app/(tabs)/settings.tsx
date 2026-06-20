import { View, Text, Switch, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { useAuthStore } from '../../store/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect, useCallback, useRef } from 'react';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import Slider from '@react-native-community/slider';
import api from '../../api';

export default function SettingsScreen() {
  const { logout } = useAuthStore();
  const [allPush, setAllPush] = useState(true);
  const [scalpSignals, setScalpSignals] = useState(true);
  const [swingSignals, setSwingSignals] = useState(true);
  const [shortSignals, setShortSignals] = useState(false);
  const [longSignals, setLongSignals] = useState(true);
  const [minConfidence, setMinConfidence] = useState(75);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Load preferences from backend on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/preferences');
      const prefs = response.data;
      setAllPush(prefs.allPush ?? true);
      setScalpSignals(prefs.scalpSignals ?? true);
      setSwingSignals(prefs.swingSignals ?? true);
      setShortSignals(prefs.shortSignals ?? false);
      setLongSignals(prefs.longSignals ?? true);
      setMinConfidence(prefs.minConfidence ?? 75);
    } catch (error) {
      console.warn('Failed to load preferences from server, using defaults');
    } finally {
      setIsLoading(false);
    }
  };

  // Save preferences to backend (debounced for slider)
  const savePreferences = useCallback(async (updates: Record<string, any>) => {
    try {
      setIsSaving(true);
      await api.put('/preferences', updates);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateToggle = (key: string, value: boolean) => {
    // Update local state immediately for snappy UI
    switch(key) {
      case 'allPush': setAllPush(value); break;
      case 'scalpSignals': setScalpSignals(value); break;
      case 'swingSignals': setSwingSignals(value); break;
      case 'shortSignals': setShortSignals(value); break;
      case 'longSignals': setLongSignals(value); break;
    }

    // If master switch is turned off, disable all sub-toggles
    if (key === 'allPush' && !value) {
      setScalpSignals(false);
      setSwingSignals(false);
      setShortSignals(false);
      setLongSignals(false);
      savePreferences({ allPush: false });
      return;
    }

    // If master switch is turned on, enable all sub-toggles
    if (key === 'allPush' && value) {
      setScalpSignals(true);
      setSwingSignals(true);
      setShortSignals(true);
      setLongSignals(true);
      savePreferences({
        scalpSignals: true,
        swingSignals: true,
        shortSignals: true,
        longSignals: true,
      });
      return;
    }

    // Save individual toggle to backend
    savePreferences({ [key]: value });
  };

  const handleConfidenceChange = (value: number) => {
    const rounded = Math.round(value);
    setMinConfidence(rounded);

    // Debounce the API call so we don't spam the server while dragging
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      savePreferences({ minConfidence: rounded });
    }, 500);
  };

  const [paywallVisible, setPaywallVisible] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);

  const fetchOfferings = async () => {
    setIsLoadingOffers(true);
    setPaywallVisible(true);
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (e: any) {
      console.warn(e);
      Alert.alert('Error', 'Failed to fetch subscription packages.');
    } finally {
      setIsLoadingOffers(false);
    }
  };

  const purchasePackage = async (pack: PurchasesPackage) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pack);
      if (typeof customerInfo.entitlements.active['pro'] !== 'undefined') {
        Alert.alert('Success', 'Subscription activated!');
        setPaywallVisible(false);
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Error', e.message);
      }
    }
  };

  return (
    <ScrollView className="flex-1 bg-background pt-12 px-5">
      {/* Header */}
      <View className="mb-6">
        <Text className="text-white text-3xl font-bold tracking-tight">Settings</Text>
      </View>

      <Text className="text-gray-400 font-semibold mb-4 uppercase text-xs tracking-wider">Notifications</Text>
      
      {/* Notifications Section */}
      <View className="mb-8" style={{ opacity: isLoading ? 0.5 : 1 }}>
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-white font-semibold text-base mb-1">All push notifications</Text>
            <Text className="text-gray-500 text-xs">Master on/off switch</Text>
          </View>
          <Switch 
            value={allPush} 
            onValueChange={(val) => updateToggle('allPush', val)}
            trackColor={{ false: '#333', true: '#16C784' }}
            thumbColor="#fff"
            disabled={isLoading}
          />
        </View>

        <View className="flex-row justify-between items-center mb-6" style={{ opacity: allPush ? 1 : 0.4 }}>
          <View>
            <Text className="text-white font-semibold text-base mb-1">Scalp signals</Text>
            <Text className="text-gray-500 text-xs">1m/5m/15m timeframes</Text>
          </View>
          <Switch 
            value={scalpSignals} 
            onValueChange={(val) => updateToggle('scalpSignals', val)}
            trackColor={{ false: '#333', true: '#16C784' }}
            thumbColor="#fff"
            disabled={!allPush || isLoading}
          />
        </View>

        <View className="flex-row justify-between items-center mb-6" style={{ opacity: allPush ? 1 : 0.4 }}>
          <View>
            <Text className="text-white font-semibold text-base mb-1">Swing signals</Text>
            <Text className="text-gray-500 text-xs">1h/4h/1d timeframes</Text>
          </View>
          <Switch 
            value={swingSignals} 
            onValueChange={(val) => updateToggle('swingSignals', val)}
            trackColor={{ false: '#333', true: '#16C784' }}
            thumbColor="#fff"
            disabled={!allPush || isLoading}
          />
        </View>

        <View className="flex-row justify-between items-center mb-6" style={{ opacity: allPush ? 1 : 0.4 }}>
          <View>
            <Text className="text-white font-semibold text-base mb-1">Short signals</Text>
            <Text className="text-gray-500 text-xs">Bearish trades only</Text>
          </View>
          <Switch 
            value={shortSignals} 
            onValueChange={(val) => updateToggle('shortSignals', val)}
            trackColor={{ false: '#333', true: '#16C784' }}
            thumbColor="#fff"
            disabled={!allPush || isLoading}
          />
        </View>

        {/* Min Confidence Slider */}
        <View className="mt-2 mb-2" style={{ opacity: allPush ? 1 : 0.4 }}>
          <View className="flex-row items-center mb-2">
            <Text className="text-white font-semibold text-base">Min confidence: </Text>
            <Text className="text-[#F5B300] font-bold text-base">{minConfidence}%</Text>
            {isSaving && <ActivityIndicator size="small" color="#16C784" style={{ marginLeft: 8 }} />}
          </View>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={70}
            maximumValue={95}
            step={1}
            value={minConfidence}
            onValueChange={handleConfidenceChange}
            minimumTrackTintColor="#F5B300"
            maximumTrackTintColor="#333"
            thumbTintColor="#F5B300"
            disabled={!allPush || isLoading}
          />
          <View className="flex-row justify-between px-1">
            <Text className="text-gray-500 text-xs font-semibold">70%</Text>
            <Text className="text-gray-500 text-xs font-semibold">95%</Text>
          </View>
        </View>
      </View>

      <Text className="text-gray-400 font-semibold mb-4 uppercase text-xs tracking-wider">Subscription</Text>
      
      {/* Subscription Card */}
      <View className="bg-secondary rounded-2xl p-5 mb-6 border border-gray-800/80">
        <Text className="text-white font-bold text-lg mb-1">Pro plan</Text>
        <Text className="text-[#16C784] font-bold text-3xl mb-4">$19/mo</Text>
        
        <View className="mb-6 space-y-2">
          <Text className="text-gray-300 font-medium leading-6">Unlimited signals</Text>
          <Text className="text-gray-300 font-medium leading-6">AI analysis on all signals</Text>
          <Text className="text-gray-300 font-medium leading-6">90-day performance history</Text>
          <Text className="text-gray-300 font-medium leading-6">Exchange filter in preferences</Text>
        </View>

        <TouchableOpacity 
          className="bg-[#16C784] rounded-xl py-4 items-center justify-center shadow-lg shadow-[#16C784]/20"
          onPress={fetchOfferings}
        >
          <Text className="text-[#0F1115] font-bold text-lg">Upgrade to Elite →</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity 
        className="py-4 items-center mb-10"
        onPress={logout}
      >
        <Text className="text-[#EA3943] font-semibold text-base">Sign Out</Text>
      </TouchableOpacity>
      <View className="h-10" />

      {/* Paywall Modal */}
      <Modal visible={paywallVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPaywallVisible(false)}>
        <View className="flex-1 bg-background p-6 pt-12">
          <View className="flex-row justify-between items-center mb-8">
            <Text className="text-white text-2xl font-bold">Select Subscription</Text>
            <TouchableOpacity onPress={() => setPaywallVisible(false)}>
              <MaterialCommunityIcons name="close" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {isLoadingOffers ? (
            <ActivityIndicator size="large" color="#16C784" className="mt-10" />
          ) : packages.length === 0 ? (
            <Text className="text-gray-400 text-center mt-10">No subscription packages found. Check your RevenueCat configuration.</Text>
          ) : (
            packages.map((pkg) => (
              <TouchableOpacity 
                key={pkg.identifier}
                className="bg-secondary rounded-xl p-5 mb-4 border border-accent/50"
                onPress={() => purchasePackage(pkg)}
              >
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-white font-bold text-lg mb-1">{pkg.product.title}</Text>
                    <Text className="text-gray-400 text-sm">{pkg.product.description}</Text>
                  </View>
                  <Text className="text-accent font-bold text-xl">{pkg.product.priceString}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}
