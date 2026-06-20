import { View, Text, FlatList, TouchableOpacity, RefreshControl, ScrollView, Animated, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
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
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);

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
    const mainColor = isLong ? '#16C784' : '#EA3943';
    
    let statusText = 'ACTIVE';
    let statusColor = '#3B82F6';

    if (item.outcome === 'WIN') {
      statusText = 'TARGET HIT';
      statusColor = '#16C784';
    } else if (item.outcome === 'LOSS') {
      statusText = 'STOPPED OUT';
      statusColor = '#EA3943';
    }

    return (
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => router.push(`/signal/${item.id}`)}
        style={styles.cardContainer}
      >
        {/* Top Accent Line */}
        <View style={[styles.cardAccentLine, { backgroundColor: mainColor }]} />

        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.symbolContainer}>
              <MaterialCommunityIcons name={isLong ? "trending-up" : "trending-down"} size={22} color={mainColor} />
              <Text style={styles.symbolText}>{item.symbol}</Text>
            </View>
            <View style={styles.timeBadge}>
              <MaterialCommunityIcons name="clock-outline" size={12} color="#9CA3AF" />
              <Text style={styles.timeText}>{getTimeAgo(item.created_at)}</Text>
            </View>
          </View>

          {/* Meta Information */}
          <Text style={styles.metaText}>
            {item.exchange} • {item.market_type} • {item.timeframe} {item.style}
          </Text>

          {/* Data Grid */}
          <View style={styles.gridContainer}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>ENTRY</Text>
              <Text style={styles.gridValue}>${item.entry_low}</Text>
            </View>
            <View style={styles.gridDivider} />
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>TARGET 1</Text>
              <Text style={[styles.gridValue, { color: '#16C784' }]}>
                +{item.tp1_pct ? item.tp1_pct.toFixed(2) : '0.00'}%
              </Text>
            </View>
            <View style={styles.gridDivider} />
            <View style={[styles.gridItem, { alignItems: 'flex-end' }]}>
              <Text style={styles.gridLabel}>STATUS</Text>
              <Text style={[styles.gridValue, { color: statusColor, fontSize: 12 }]}>{statusText}</Text>
            </View>
          </View>

          {/* Confidence Bar */}
          <ConfidenceBar confidence={item.confidence} rrRatio={`1:${item.rr_ratio}`} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.headerTitle}>AzSignal Pro</Text>
          <View style={styles.liveIndicatorContainer}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.liveText}>LIVE MARKET</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <MaterialCommunityIcons name="bell-ring-outline" size={24} color="#FFF" />
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScrollContent}>
          {filters.map(filter => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={[
                  styles.filterPill,
                  isActive ? styles.filterPillActive : styles.filterPillInactive
                ]}
              >
                <Text style={[
                  styles.filterText,
                  isActive ? styles.filterTextActive : styles.filterTextInactive
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Feed */}
      <FlatList
        data={filteredSignals}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSignal}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16C784" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <MaterialCommunityIcons name="satellite-variant" size={48} color="#16C784" />
            </View>
            <Text style={styles.emptyTitle}>Scanning Markets</Text>
            <Text style={styles.emptySubtitle}>
              Our AI is currently analyzing charts.{'\n'}Signals will appear here automatically.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
    paddingTop: 60,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  liveIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 199, 132, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(22, 199, 132, 0.2)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16C784',
    marginRight: 6,
  },
  liveText: {
    color: '#16C784',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1D24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    backgroundColor: '#EA3943',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1A1D24',
  },
  filtersContainer: {
    marginBottom: 20,
  },
  filtersScrollContent: {
    paddingHorizontal: 24,
  },
  filterPill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: '#16C784',
    borderColor: '#16C784',
  },
  filterPillInactive: {
    backgroundColor: '#1A1D24',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterTextActive: {
    color: '#000',
  },
  filterTextInactive: {
    color: '#9CA3AF',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  cardContainer: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  cardAccentLine: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  symbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  metaText: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1115',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
  },
  gridDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 12,
  },
  gridLabel: {
    color: '#6B7280',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  gridValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(22, 199, 132, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
