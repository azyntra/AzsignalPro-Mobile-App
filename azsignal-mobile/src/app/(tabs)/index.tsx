import { View, Text, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import api from '../../api';
import { useSignalStore, Signal } from '../../store/signals';
import { useAuthStore } from '../../store/auth';
import { ConfidenceBar } from '../../components/ConfidenceBar';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SignalFeedScreen() {
  const { signals, setSignals, connect, disconnect } = useSignalStore();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const router = useRouter();

  const fetchSignals = async () => {
    try {
      const response = await api.get('/signals');
      setSignals(response.data);
    } catch (error) {
      console.error('Failed to fetch signals', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSignals();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchSignals();
    connect();
    return () => disconnect();
  }, []);

  const filteredSignals = signals.filter(s => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Scalp') return s.style === 'scalp';
    if (activeFilter === 'Swing') return s.style === 'swing';
    if (activeFilter === 'Long') return s.direction === 'LONG';
    if (activeFilter === 'Short') return s.direction === 'SHORT';
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filters = ['All', 'Scalp', 'Swing', 'Long', 'Short'];

  const getTimeAgo = (dateStr: string | Date) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const renderSignal = ({ item }: { item: Signal }) => {
    const isLong = item.direction === 'LONG';
    const borderColor = isLong ? 'border-[#16C784]' : 'border-[#EA3943]';
    const badgeColor = isLong ? 'border-[#16C784] text-[#16C784]' : 'border-[#EA3943] text-[#EA3943]';
    
    // Outcome status handling
    let dotColor = '#9CA3AF'; // gray
    let statusText = 'Open';
    if (item.outcome === 'WIN') {
      dotColor = '#16C784';
      statusText = '✓ TP Hit';
    } else if (item.outcome === 'LOSS') {
      dotColor = '#EA3943';
      statusText = '✗ SL Hit';
    } else {
      dotColor = '#9CA3AF';
      statusText = '• Open';
    }

    const isLocked = user?.tier === 'free' || user?.tier === 'basic' ? false : false; // Placeholder logic for locked state

    return (
      <TouchableOpacity 
        className={`bg-secondary rounded-2xl p-4 mb-4 border-l-4 border-t border-b border-r border-t-gray-800 border-b-gray-800 border-r-gray-800 ${borderColor}`}
        onPress={() => router.push(`/signal/${item.id}`)}
      >
        {/* Header Row */}
        <View className="flex-row justify-between items-center mb-1">
          <View className="flex-row items-center space-x-2">
            <View className={`border px-2 py-0.5 rounded-sm ${badgeColor}`}>
              <Text className={`font-bold text-[10px] ${badgeColor}`}>{item.direction}</Text>
            </View>
            <Text className="text-white font-bold text-lg">{item.symbol}</Text>
          </View>
          <Text className="text-gray-500 text-xs">{getTimeAgo(item.created_at)}</Text>
        </View>

        {/* Meta Row */}
        <Text className="text-gray-400 text-[10px] tracking-widest font-semibold mb-2 uppercase">
          {item.exchange} · {item.market_type} · {item.timeframe} {item.style}
        </Text>

        {/* Confidence & RR */}
        <ConfidenceBar confidence={item.confidence} rrRatio={`1:${item.rr_ratio}`} />

        {/* Targets Row */}
        <View className="flex-row justify-between items-center mt-3">
          <View>
            <Text className="text-goldText text-xs font-semibold mb-1">
              ${item.entry_low}–${item.entry_high}
            </Text>
            <Text className="text-gray-400 text-xs font-medium">
              <Text className="text-[#16C784]">TP1 +{item.tp1_pct ? item.tp1_pct.toFixed(2) : 0}%</Text>   <Text className="text-[#16C784]">TP2 +{item.tp2_pct ? item.tp2_pct.toFixed(2) : 0}%</Text>
            </Text>
          </View>
          <View className="items-end justify-end h-full">
            <Text className={`text-xs font-semibold ${item.outcome === 'WIN' ? 'text-[#16C784]' : item.outcome === 'LOSS' ? 'text-[#EA3943]' : 'text-gray-400'}`}>
              {statusText}
            </Text>
          </View>
        </View>
        
        {/* Lock Overlay for Free users - Add later if needed */}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background pt-12">
      {/* App Header */}
      <View className="px-5 mb-4">
        <Text className="text-white text-3xl font-bold tracking-tight">AzSignal Pro</Text>
        <View className="flex-row items-center mt-1">
          <View className="w-2 h-2 rounded-full bg-[#16C784] mr-2 animate-pulse" />
          <Text className="text-gray-400 text-sm font-medium">Live</Text>
        </View>
      </View>

      {/* Filters */}
      <View className="px-5 mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {filters.map(filter => (
            <TouchableOpacity
              key={filter}
              onPress={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full mr-2 border ${
                activeFilter === filter 
                  ? 'bg-[#16C784]/20 border-[#16C784]' 
                  : 'bg-transparent border-gray-800'
              }`}
            >
              <Text className={`text-sm font-medium ${
                activeFilter === filter ? 'text-[#16C784]' : 'text-gray-400'
              }`}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Feed */}
      <FlatList
        data={filteredSignals}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSignal}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16C784" />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20 mt-10">
            <MaterialCommunityIcons name="satellite-uplink" size={48} color="#333" />
            <Text className="text-gray-500 mt-4 text-center font-medium">
              Scanning the market...{'\n'}No signals matching your criteria.
            </Text>
          </View>
        }
      />
    </View>
  );
}
