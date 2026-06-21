import { View, Text, FlatList, TouchableOpacity, RefreshControl, ScrollView, Animated, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api';
import { useSignalStore, Signal } from '../../store/signals';
import { useAuthStore } from '../../store/auth';
import { ConfidenceBar } from '../../components/ConfidenceBar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

// ─── Skeleton Card Component ─────────────────────────────────────────────────
function SkeletonCard({ delay = 0 }: { delay?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View style={[styles.cardContainer, { opacity }]}>
      <View style={[styles.cardAccentLine, { backgroundColor: '#2A2D35' }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 22, height: 22, borderRadius: 4, backgroundColor: '#2A2D35' }} />
            <View style={{ width: 120, height: 18, borderRadius: 4, backgroundColor: '#2A2D35', marginLeft: 8 }} />
          </View>
          <View style={{ width: 60, height: 20, borderRadius: 8, backgroundColor: '#2A2D35' }} />
        </View>
        <View style={{ width: 180, height: 10, borderRadius: 4, backgroundColor: '#2A2D35', marginBottom: 16 }} />
        <View style={[styles.gridContainer, { backgroundColor: '#13151A' }]}>
          <View style={{ flex: 1 }}>
            <View style={{ width: 40, height: 8, borderRadius: 3, backgroundColor: '#2A2D35', marginBottom: 6 }} />
            <View style={{ width: 60, height: 14, borderRadius: 3, backgroundColor: '#2A2D35' }} />
          </View>
          <View style={styles.gridDivider} />
          <View style={{ flex: 1 }}>
            <View style={{ width: 50, height: 8, borderRadius: 3, backgroundColor: '#2A2D35', marginBottom: 6 }} />
            <View style={{ width: 50, height: 14, borderRadius: 3, backgroundColor: '#2A2D35' }} />
          </View>
          <View style={styles.gridDivider} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={{ width: 40, height: 8, borderRadius: 3, backgroundColor: '#2A2D35', marginBottom: 6 }} />
            <View style={{ width: 55, height: 14, borderRadius: 3, backgroundColor: '#2A2D35' }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ width: 100, height: 12, borderRadius: 3, backgroundColor: '#2A2D35' }} />
          <View style={{ width: 60, height: 12, borderRadius: 3, backgroundColor: '#2A2D35' }} />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Animated Card Wrapper ───────────────────────────────────────────────────
function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay: index * 100, // staggered
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function SignalFeedScreen() {
  const { signals, setSignals, connect, disconnect } = useSignalStore();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const router = useRouter();
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // User notification preferences (loaded from backend)
  const [userPrefs, setUserPrefs] = useState({
    scalpSignals: true,
    swingSignals: true,
    shortSignals: false,
    longSignals: true,
    minConfidence: 70,
  });

  // Reload preferences every time the user navigates back to this tab
  useFocusEffect(
    useCallback(() => {
      api.get('/preferences').then(res => {
        setUserPrefs({
          scalpSignals: res.data.scalpSignals ?? true,
          swingSignals: res.data.swingSignals ?? true,
          shortSignals: res.data.shortSignals ?? false,
          longSignals: res.data.longSignals ?? true,
          minConfidence: res.data.minConfidence ?? 70,
        });
      }).catch(() => {});
      fetchSignals();
    }, [])
  );

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
    } finally {
      setIsInitialLoad(false);
    }
  };

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    // Expiry check
    const ageMs = Date.now() - new Date(s.created_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const isScalp = s.style?.toLowerCase() === 'scalp';
    
    // Scalp expires after 1 hour, Swing expires after 72 hours
    const isExpired = isScalp ? ageHours > 1 : ageHours > 72;
    
    if (isExpired) return false;

    // Apply user preference filters
    if (isScalp && !userPrefs.scalpSignals) return false;
    if (s.style?.toLowerCase() === 'swing' && !userPrefs.swingSignals) return false;
    if (s.direction === 'SHORT' && !userPrefs.shortSignals) return false;
    if (s.direction === 'LONG' && !userPrefs.longSignals) return false;
    if (s.confidence < userPrefs.minConfidence) return false;

    if (activeFilter === 'All') return true;
    if (activeFilter === 'Scalp') return isScalp;
    if (activeFilter === 'Swing') return s.style?.toLowerCase() === 'swing';
    if (activeFilter === 'Long') return s.direction === 'LONG';
    if (activeFilter === 'Short') return s.direction === 'SHORT';
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filters = ['All', 'Scalp', 'Swing', 'Long', 'Short'];

  const getTimeAgo = (dateStr: string | Date) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.max(0, Math.floor(diff / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getOutcomeBadge = (outcome: string | undefined | null) => {
    if (!outcome) return null;

    const isWin = ['TP1', 'TP2', 'TP3'].includes(outcome);
    const isSL = outcome === 'SL';
    const isExpired = outcome === 'EXPIRED';

    let label = '';
    let bgColor = '';
    let textColor = '';
    let icon: any = '';

    if (isWin) {
      label = `${outcome} HIT`;
      bgColor = 'rgba(22, 199, 132, 0.15)';
      textColor = '#16C784';
      icon = 'check-circle';
    } else if (isSL) {
      label = 'STOPPED OUT';
      bgColor = 'rgba(234, 57, 67, 0.15)';
      textColor = '#EA3943';
      icon = 'close-circle';
    } else if (isExpired) {
      label = 'EXPIRED';
      bgColor = 'rgba(156, 163, 175, 0.15)';
      textColor = '#9CA3AF';
      icon = 'clock-outline';
    }

    return { label, bgColor, textColor, icon };
  };

  const handleFilterTap = (filter: string) => {
    Haptics.selectionAsync();
    setActiveFilter(filter);
  };

  const renderSignal = ({ item, index }: { item: Signal; index: number }) => {
    const isLong = item.direction === 'LONG';
    const mainColor = isLong ? '#16C784' : '#EA3943';
    const outcomeBadge = getOutcomeBadge(item.outcome);
    const isClosed = !!item.outcome;

    return (
      <AnimatedCard index={index}>
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/signal/${item.id}`);
          }}
          style={[styles.cardContainer, isClosed && styles.cardContainerClosed]}
        >
          {/* Top Accent Line */}
          <View style={[styles.cardAccentLine, { backgroundColor: isClosed ? (outcomeBadge?.textColor || '#6B7280') : mainColor }]} />

          <View style={styles.cardContent}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.symbolContainer}>
                <MaterialCommunityIcons name={isLong ? "trending-up" : "trending-down"} size={22} color={isClosed ? '#6B7280' : mainColor} />
                <Text style={[styles.symbolText, isClosed && { color: '#9CA3AF' }]}>{item.symbol}</Text>
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

            {/* Outcome Badge (if closed) */}
            {outcomeBadge && (
              <View style={[styles.outcomeBadge, { backgroundColor: outcomeBadge.bgColor }]}>
                <MaterialCommunityIcons name={outcomeBadge.icon} size={16} color={outcomeBadge.textColor} />
                <Text style={[styles.outcomeBadgeText, { color: outcomeBadge.textColor }]}>{outcomeBadge.label}</Text>
                {item.profit_pct !== undefined && item.profit_pct !== null && (
                  <Text style={[styles.outcomeProfitText, { color: outcomeBadge.textColor }]}>
                    {item.profit_pct >= 0 ? '+' : ''}{typeof item.profit_pct === 'number' ? item.profit_pct.toFixed(2) : item.profit_pct}%
                  </Text>
                )}
              </View>
            )}

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
                {isClosed ? (
                  <Text style={[styles.gridValue, { color: outcomeBadge?.textColor || '#9CA3AF', fontSize: 12 }]}>
                    CLOSED
                  </Text>
                ) : (
                  <View style={styles.activeStatusContainer}>
                    <View style={styles.activeStatusDot} />
                    <Text style={[styles.gridValue, { color: '#3B82F6', fontSize: 12 }]}>ACTIVE</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Confidence Bar */}
            <ConfidenceBar confidence={item.confidence} rrRatio={`1:${item.rr_ratio}`} />
          </View>
        </TouchableOpacity>
      </AnimatedCard>
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
                onPress={() => handleFilterTap(filter)}
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
      {isInitialLoad ? (
        <ScrollView style={{ paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
          <SkeletonCard delay={0} />
          <SkeletonCard delay={150} />
          <SkeletonCard delay={300} />
        </ScrollView>
      ) : (
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
      )}
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
  cardContainerClosed: {
    opacity: 0.75,
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
    marginBottom: 12,
  },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  outcomeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  outcomeProfitText: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 'auto',
  },
  activeStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginRight: 4,
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
    borderWidth: 1,
    borderColor: 'rgba(22, 199, 132, 0.2)',
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
});
