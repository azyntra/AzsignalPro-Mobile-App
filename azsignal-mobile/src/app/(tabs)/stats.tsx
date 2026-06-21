import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Animated, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import api from '../../api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DailyData {
  day: string;
  date: string;
  wins: number;
  losses: number;
}

interface ExchangeData {
  name: string;
  signals: number;
  wins: number;
  losses: number;
  winRate: string;
}

interface BestPair {
  symbol: string;
  winRate: string;
  trades: number;
  wins: number;
}

interface RecentTrade {
  id: number;
  symbol: string;
  direction: string;
  exchange: string;
  outcome: string;
  profitPct: string;
  closedAt: string;
}

interface StatsData {
  totalSignals: number;
  closedSignals: number;
  wins: number;
  losses: number;
  winRate: string;
  avgProfit: string;
  cumulativePnl: string;
  dailyBreakdown: DailyData[];
  byExchange: ExchangeData[];
  bestPair: BestPair | null;
  streak: { count: number; type: string | null };
  recentTrades: RecentTrade[];
}

// ─── Animated Number Counter ─────────────────────────────────────────────────
function AnimatedCounter({ value, prefix = '', suffix = '', style }: {
  value: number;
  prefix?: string;
  suffix?: string;
  style: any;
}) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    animValue.setValue(0);
    const listener = animValue.addListener(({ value: v }) => {
      if (Number.isInteger(value)) {
        setDisplay(Math.round(v).toString());
      } else {
        setDisplay(v.toFixed(1));
      }
    });
    Animated.timing(animValue, {
      toValue: value,
      duration: 800,
      useNativeDriver: false,
    }).start();
    return () => animValue.removeListener(listener);
  }, [value]);

  return <Text style={style}>{prefix}{display}{suffix}</Text>;
}

// ─── Win Rate Ring ───────────────────────────────────────────────────────────
function WinRateRing({ rate, size = 72 }: { rate: number; size?: number }) {
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: rate,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [rate]);

  // Build a simple horizontal progress bar styled as a ring-like gauge
  const barWidth = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={ringStyles.container}>
      <View style={[ringStyles.outerRing, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[ringStyles.innerRing, { width: size - 12, height: size - 12, borderRadius: (size - 12) / 2 }]}>
          <Text style={ringStyles.rateText}>{rate.toFixed(0)}%</Text>
          <Text style={ringStyles.rateLabel}>Win</Text>
        </View>
      </View>
      {/* Circular progress illusion via border */}
      <View style={[
        ringStyles.progressArc,
        {
          width: size, height: size, borderRadius: size / 2,
          borderTopColor: rate > 0 ? '#16C784' : 'transparent',
          borderRightColor: rate > 25 ? '#16C784' : 'transparent',
          borderBottomColor: rate > 50 ? '#16C784' : 'transparent',
          borderLeftColor: rate > 75 ? '#16C784' : 'transparent',
        }
      ]} />
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  outerRing: {
    backgroundColor: 'rgba(22, 199, 132, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(22, 199, 132, 0.3)',
  },
  innerRing: {
    backgroundColor: '#1A1D24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateText: { color: '#16C784', fontSize: 18, fontWeight: '800' },
  rateLabel: { color: '#6B7280', fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  progressArc: {
    position: 'absolute',
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
});

// ─── Animated Bar ────────────────────────────────────────────────────────────
function AnimatedBar({ height, color, delay = 0 }: { height: number; color: string; delay?: number }) {
  const animHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animHeight.setValue(0);
    const timeout = setTimeout(() => {
      Animated.spring(animHeight, {
        toValue: Math.max(height, 0),
        tension: 60,
        friction: 8,
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [height]);

  return (
    <Animated.View
      style={{
        width: 14,
        backgroundColor: color,
        borderRadius: 3,
        height: animHeight,
      }}
    />
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, backgroundColor: '#2A2D35', borderRadius: 8, opacity },
        style,
      ]}
    />
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.content}>
      {/* KPI skeleton */}
      <View style={styles.kpiRow}>
        <SkeletonBlock width="48%" height={88} />
        <SkeletonBlock width="48%" height={88} />
      </View>
      <View style={styles.kpiRow}>
        <SkeletonBlock width="48%" height={88} />
        <SkeletonBlock width="48%" height={88} />
      </View>
      {/* Chart skeleton */}
      <SkeletonBlock width="100%" height={200} style={{ marginBottom: 16 }} />
      {/* Exchange skeleton */}
      <SkeletonBlock width="100%" height={160} style={{ marginBottom: 16 }} />
    </View>
  );
}

// ─── Main Stats Screen ──────────────────────────────────────────────────────
export default function StatsScreen() {
  const [activeRange, setActiveRange] = useState('30D');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBar, setSelectedBar] = useState<number | null>(null);

  const ranges = ['7D', '30D', '90D', 'All'];

  const fetchStats = useCallback(async (range: string, isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const res = await api.get(`/stats?range=${range}`);
      // Safe defaults for backward compat with old API responses
      setStats({
        totalSignals: res.data.totalSignals ?? 0,
        closedSignals: res.data.closedSignals ?? 0,
        wins: res.data.wins ?? 0,
        losses: res.data.losses ?? 0,
        winRate: res.data.winRate ?? '0.0',
        avgProfit: res.data.avgProfit ?? '0.0',
        cumulativePnl: res.data.cumulativePnl ?? '0.0',
        dailyBreakdown: res.data.dailyBreakdown ?? [],
        byExchange: res.data.byExchange ?? [],
        bestPair: res.data.bestPair ?? null,
        streak: res.data.streak ?? { count: 0, type: null },
        recentTrades: res.data.recentTrades ?? [],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats(activeRange);
    }, [activeRange])
  );

  const handleRangeChange = (range: string) => {
    setActiveRange(range);
    setSelectedBar(null);
    fetchStats(range);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats(activeRange, true);
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return `${Math.max(1, Math.floor(diff / (1000 * 60)))}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Calculate max bar height for scaling
  const maxBarValue = stats?.dailyBreakdown
    ? Math.max(...stats.dailyBreakdown.map(d => d.wins + d.losses), 1)
    : 1;
  const BAR_MAX_HEIGHT = 100;

  // ─── Error State ─────────────────────────────────────────────────────
  if (error && !stats) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Performance</Text>
        </View>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}>
            <MaterialCommunityIcons name="wifi-off" size={40} color="#EA3943" />
          </View>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchStats(activeRange)}>
            <MaterialCommunityIcons name="refresh" size={18} color="#000" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16C784" />
      }
    >
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Performance</Text>
        {stats?.streak && stats.streak.count >= 2 && (
          <View style={[
            styles.streakBadge,
            { backgroundColor: stats.streak.type === 'WIN' ? 'rgba(22, 199, 132, 0.15)' : 'rgba(234, 57, 67, 0.15)' }
          ]}>
            <Text style={styles.streakEmoji}>
              {stats.streak.type === 'WIN' ? '🔥' : '❄️'}
            </Text>
            <Text style={[
              styles.streakText,
              { color: stats.streak.type === 'WIN' ? '#16C784' : '#EA3943' }
            ]}>
              {stats.streak.count} {stats.streak.type === 'WIN' ? 'Win' : 'Loss'} Streak
            </Text>
          </View>
        )}
      </View>

      {/* ─── Range Filters ──────────────────────────────────────────── */}
      <View style={styles.rangeContainer}>
        {ranges.map(range => {
          const isActive = activeRange === range;
          return (
            <TouchableOpacity
              key={range}
              onPress={() => handleRangeChange(range)}
              style={[
                styles.rangePill,
                isActive ? styles.rangePillActive : styles.rangePillInactive,
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.rangeText,
                isActive ? styles.rangeTextActive : styles.rangeTextInactive,
              ]}>
                {range}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Content ────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingSkeleton />
      ) : stats ? (
        <View style={styles.content}>
          {/* ─── KPI Cards + Win Rate Ring ──────────────────────────── */}
          <View style={styles.kpiSection}>
            {/* Left: 2x2 KPI Grid */}
            <View style={styles.kpiGridLeft}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total signals</Text>
                <AnimatedCounter value={stats.totalSignals} style={styles.kpiValue} />
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Win rate</Text>
                <AnimatedCounter value={parseFloat(stats.winRate)} suffix="%" style={styles.kpiValueGreen} />
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Avg profit</Text>
                <AnimatedCounter
                  value={parseFloat(stats.avgProfit)}
                  prefix={parseFloat(stats.avgProfit) >= 0 ? '+' : ''}
                  suffix="%"
                  style={[styles.kpiValueGreen, parseFloat(stats.avgProfit) < 0 && { color: '#EA3943' }]}
                />
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Cumulative P&L</Text>
                <AnimatedCounter
                  value={parseFloat(stats.cumulativePnl)}
                  prefix={parseFloat(stats.cumulativePnl) >= 0 ? '+' : ''}
                  suffix="%"
                  style={[styles.kpiValueGold, parseFloat(stats.cumulativePnl) < 0 && { color: '#EA3943' }]}
                />
              </View>
            </View>

            {/* Right: Win Rate Ring */}
            <View style={styles.kpiRingContainer}>
              <WinRateRing rate={parseFloat(stats.winRate)} size={80} />
              <View style={styles.wlCountRow}>
                <View style={styles.wlItem}>
                  <View style={[styles.wlDot, { backgroundColor: '#16C784' }]} />
                  <Text style={styles.wlText}>{stats.wins}W</Text>
                </View>
                <View style={styles.wlItem}>
                  <View style={[styles.wlDot, { backgroundColor: '#EA3943' }]} />
                  <Text style={styles.wlText}>{stats.losses}L</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── Best Pair Card ─────────────────────────────────────── */}
          {stats.bestPair && (
            <View style={styles.bestPairCard}>
              <View style={styles.bestPairLeft}>
                <View style={styles.bestPairIconWrap}>
                  <MaterialCommunityIcons name="trophy" size={20} color="#F5B300" />
                </View>
                <View>
                  <Text style={styles.bestPairTitle}>Best Performer</Text>
                  <Text style={styles.bestPairSymbol}>{stats.bestPair.symbol}</Text>
                </View>
              </View>
              <View style={styles.bestPairRight}>
                <Text style={styles.bestPairRate}>{stats.bestPair.winRate}%</Text>
                <Text style={styles.bestPairTrades}>{stats.bestPair.trades} trades</Text>
              </View>
            </View>
          )}

          {/* ─── Daily Bar Chart ────────────────────────────────────── */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Daily signals (wins vs losses)</Text>

            <View style={styles.chartArea}>
              {stats.dailyBreakdown.map((d, i) => {
                const winH = (d.wins / maxBarValue) * BAR_MAX_HEIGHT;
                const lossH = (d.losses / maxBarValue) * BAR_MAX_HEIGHT;
                const isSelected = selectedBar === i;
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.barColumn}
                    activeOpacity={0.7}
                    onPress={() => setSelectedBar(isSelected ? null : i)}
                  >
                    {/* Tooltip */}
                    {isSelected && (
                      <View style={styles.tooltip}>
                        <Text style={styles.tooltipText}>W:{d.wins} L:{d.losses}</Text>
                        <View style={styles.tooltipArrow} />
                      </View>
                    )}
                    <View style={styles.barGroup}>
                      <AnimatedBar height={winH} color="#16C784" delay={i * 60} />
                      <AnimatedBar height={lossH} color="#EA3943" delay={i * 60 + 100} />
                    </View>
                    <Text style={[styles.barLabel, isSelected && { color: '#FFF' }]}>{d.day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#16C784' }]} />
                <Text style={styles.legendText}>Win</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EA3943' }]} />
                <Text style={styles.legendText}>Loss</Text>
              </View>
            </View>
          </View>

          {/* ─── By Exchange ─────────────────────────────────────────── */}
          {stats.byExchange.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>By exchange</Text>
              <View style={styles.exchangeCard}>
                {stats.byExchange.map((ex, i) => {
                  const wr = parseFloat(ex.winRate);
                  return (
                    <View
                      key={ex.name}
                      style={[
                        styles.exchangeRow,
                        i !== stats.byExchange.length - 1 && styles.exchangeRowBorder,
                      ]}
                    >
                      <View style={styles.exchangeLeft}>
                        <View style={styles.exchangeIconWrap}>
                          <MaterialCommunityIcons
                            name="bank"
                            size={16}
                            color="#6B7280"
                          />
                        </View>
                        <View>
                          <Text style={styles.exchangeName}>{ex.name}</Text>
                          <Text style={styles.exchangeSignals}>{ex.signals} signals</Text>
                        </View>
                      </View>
                      <View style={styles.exchangeRight}>
                        <Text style={[
                          styles.exchangeRate,
                          { color: wr >= 60 ? '#16C784' : wr >= 50 ? '#F5B300' : '#EA3943' }
                        ]}>
                          {ex.winRate}%
                        </Text>
                        {/* Mini progress bar */}
                        <View style={styles.exchangeBarBg}>
                          <View style={[
                            styles.exchangeBarFill,
                            {
                              width: `${Math.min(wr, 100)}%` as any,
                              backgroundColor: wr >= 60 ? '#16C784' : wr >= 50 ? '#F5B300' : '#EA3943',
                            }
                          ]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ─── Recent Trades ───────────────────────────────────────── */}
          {stats.recentTrades.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Recent closed trades</Text>
              <View style={styles.tradesCard}>
                {stats.recentTrades.map((trade, i) => {
                  const isWin = trade.outcome === 'WIN';
                  const profit = parseFloat(trade.profitPct as any);
                  return (
                    <View
                      key={trade.id}
                      style={[
                        styles.tradeRow,
                        i !== stats.recentTrades.length - 1 && styles.tradeRowBorder,
                      ]}
                    >
                      {/* Left: icon + symbol */}
                      <View style={styles.tradeLeft}>
                        <View style={[
                          styles.tradeIconWrap,
                          { backgroundColor: isWin ? 'rgba(22, 199, 132, 0.15)' : 'rgba(234, 57, 67, 0.15)' }
                        ]}>
                          <MaterialCommunityIcons
                            name={isWin ? 'check-circle' : 'close-circle'}
                            size={18}
                            color={isWin ? '#16C784' : '#EA3943'}
                          />
                        </View>
                        <View>
                          <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
                          <Text style={styles.tradeMeta}>
                            {trade.direction} • {trade.exchange}
                          </Text>
                        </View>
                      </View>
                      {/* Right: PnL + time */}
                      <View style={styles.tradeRight}>
                        <Text style={[
                          styles.tradePnl,
                          { color: isWin ? '#16C784' : '#EA3943' }
                        ]}>
                          {profit >= 0 ? '+' : ''}{typeof profit === 'number' && !isNaN(profit) ? profit.toFixed(2) : trade.profitPct}%
                        </Text>
                        <Text style={styles.tradeTime}>{getTimeAgo(trade.closedAt)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ─── Empty State for no data ─────────────────────────────── */}
          {stats.closedSignals === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons name="chart-line" size={44} color="#16C784" />
              </View>
              <Text style={styles.emptyTitle}>No Data Yet</Text>
              <Text style={styles.emptySubtitle}>
                Stats will appear here once signals{'\n'}start closing with outcomes.
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
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
    marginBottom: 20,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Streak badge
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  streakEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Range filters
  rangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  rangePill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
  },
  rangePillActive: {
    backgroundColor: '#16C784',
    borderColor: '#16C784',
  },
  rangePillInactive: {
    backgroundColor: '#1A1D24',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rangeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rangeTextActive: {
    color: '#000',
  },
  rangeTextInactive: {
    color: '#9CA3AF',
  },

  content: {
    paddingHorizontal: 24,
  },

  // ─── KPI Section ───────────────────────────────────────────────────
  kpiSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  kpiGridLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginRight: 12,
  },
  kpiCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    width: '48%',
  },
  kpiLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  kpiValue: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  kpiValueGreen: {
    color: '#16C784',
    fontSize: 22,
    fontWeight: '800',
  },
  kpiValueGold: {
    color: '#F5B300',
    fontSize: 22,
    fontWeight: '800',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  // Win Rate Ring container
  kpiRingContainer: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
  },
  wlCountRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  wlItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wlDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  wlText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
  },

  // ─── Best Pair Card ────────────────────────────────────────────────
  bestPairCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 179, 0, 0.15)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bestPairLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestPairIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 179, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bestPairTitle: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  bestPairSymbol: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bestPairRight: {
    alignItems: 'flex-end',
  },
  bestPairRate: {
    color: '#F5B300',
    fontSize: 20,
    fontWeight: '800',
  },
  bestPairTrades: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // ─── Chart Card ────────────────────────────────────────────────────
  chartCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  chartTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
    paddingBottom: 24,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barGroup: {
    alignItems: 'center',
    gap: 2,
  },
  barLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  tooltip: {
    position: 'absolute',
    top: -30,
    backgroundColor: '#2A2D35',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  tooltipText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    marginLeft: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2A2D35',
  },
  legendRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
  },

  // ─── Sections ──────────────────────────────────────────────────────
  sectionBlock: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 2,
  },

  // ─── Exchange Rows ─────────────────────────────────────────────────
  exchangeCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  exchangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  exchangeRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  exchangeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exchangeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  exchangeName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  exchangeSignals: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  exchangeRight: {
    alignItems: 'flex-end',
    width: 80,
  },
  exchangeRate: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  exchangeBarBg: {
    width: 60,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  exchangeBarFill: {
    height: 4,
    borderRadius: 2,
  },

  // ─── Recent Trades ─────────────────────────────────────────────────
  tradesCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  tradeRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tradeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tradeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  tradeSymbol: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tradeMeta: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tradeRight: {
    alignItems: 'flex-end',
  },
  tradePnl: {
    fontSize: 14,
    fontWeight: '800',
  },
  tradeTime: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // ─── Empty State ───────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(22, 199, 132, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ─── Error State ───────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(234, 57, 67, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  errorSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16C784',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  retryText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
});
