import { View, Text, Switch, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { useAuthStore } from '../../store/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import Slider from '@react-native-community/slider';
import * as SecureStore from 'expo-secure-store';

export default function SettingsScreen() {
  const { logout } = useAuthStore();
  const [allPush, setAllPush] = useState(true);
  const [scalpSignals, setScalpSignals] = useState(true);
  const [swingSignals, setSwingSignals] = useState(true);
  const [shortSignals, setShortSignals] = useState(false);
  const [minConfidence, setMinConfidence] = useState(75);
  
  useEffect(() => {
    SecureStore.getItemAsync('settings').then(data => {
      if (data) {
        const p = JSON.parse(data);
        setAllPush(p.allPush ?? true);
        setScalpSignals(p.scalpSignals ?? true);
        setSwingSignals(p.swingSignals ?? true);
        setShortSignals(p.shortSignals ?? false);
        setMinConfidence(p.minConfidence ?? 75);
      }
    }).catch(console.warn);
  }, []);

  const saveSettings = (key: string, value: any) => {
    const p = { allPush, scalpSignals, swingSignals, shortSignals, minConfidence, [key]: value };
    SecureStore.setItemAsync('settings', JSON.stringify(p)).catch(console.warn);
  };

  const updateSetting = (key: string, value: any) => {
    switch(key) {
      case 'allPush': setAllPush(value); break;
      case 'scalpSignals': setScalpSignals(value); break;
      case 'swingSignals': setSwingSignals(value); break;
      case 'shortSignals': setShortSignals(value); break;
      case 'minConfidence': setMinConfidence(value); break;
    }
    saveSettings(key, value);
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
      <View className="mb-8">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-white font-semibold text-base mb-1">All push notifications</Text>
            <Text className="text-gray-500 text-xs">Master on/off switch</Text>
          </View>
          <Switch 
            value={allPush} 
            onValueChange={(val) => updateSetting('allPush', val)}
            trackColor={{ false: '#333', true: '#16C784' }}
            thumbColor="#fff"
          />
        </View>

        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-white font-semibold text-base mb-1">Scalp signals</Text>
            <Text className="text-gray-500 text-xs">1m/5m/15m timeframes</Text>
          </View>
          <Switch 
            value={scalpSignals} 
            onValueChange={(val) => updateSetting('scalpSignals', val)}
            trackColor={{ false: '#333', true: '#16C784' }}
            thumbColor="#fff"
          />
        </View>

        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-white font-semibold text-base mb-1">Swing signals</Text>
            <Text className="text-gray-500 text-xs">1h/4h/1d timeframes</Text>
          </View>
          <Switch 
            value={swingSignals} 
            onValueChange={(val) => updateSetting('swingSignals', val)}
            trackColor={{ false: '#333', true: '#16C784' }}
            thumbColor="#fff"
          />
        </View>

        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-white font-semibold text-base mb-1">Short signals</Text>
            <Text className="text-gray-500 text-xs">Bearish trades only</Text>
          </View>
          <Switch 
            value={shortSignals} 
            onValueChange={(val) => updateSetting('shortSignals', val)}
            trackColor={{ false: '#333', true: '#16C784' }}
            thumbColor="#fff"
          />
        </View>

        {/* Min Confidence Slider */}
        <View className="mt-2 mb-2">
          <View className="flex-row items-center mb-2">
            <Text className="text-white font-semibold text-base">Min confidence: </Text>
            <Text className="text-[#F5B300] font-bold text-base">{minConfidence}%</Text>
          </View>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={70}
            maximumValue={95}
            step={1}
            value={minConfidence}
            onValueChange={(val) => updateSetting('minConfidence', val)}
            minimumTrackTintColor="#F5B300"
            maximumTrackTintColor="#333"
            thumbTintColor="#F5B300"
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
