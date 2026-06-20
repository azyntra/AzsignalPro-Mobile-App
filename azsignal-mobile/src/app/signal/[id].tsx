import { View, Text, ScrollView, TouchableOpacity, Share, StyleSheet, StatusBar, Platform, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSignalStore, Signal } from '../../store/signals';
import { ConfidenceBar } from '../../components/ConfidenceBar';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignalDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { signals } = useSignalStore();
  
  const signal = signals.find(s => s.id === Number(id));

  if (!signal) {
    return (
      <View style={styles.notFoundContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text style={styles.notFoundText}>Signal not found</Text>
        <TouchableOpacity style={styles.backButtonFallback} onPress={() => router.back()}>
          <Text style={styles.backButtonFallbackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLong = signal.direction === 'LONG';
  const mainColor = isLong ? '#10B981' : '#FB7185';
  const gradientColors = isLong 
    ? ['rgba(16, 185, 129, 0.15)', 'rgba(2, 6, 23, 0.95)'] 
    : ['rgba(239, 68, 68, 0.15)', 'rgba(2, 6, 23, 0.95)'];

  // Parse JSON fields safely (handle both string and already-parsed object/array)
  let reasons: string[] = [];
  try {
    if (Array.isArray(signal.reasons_json)) {
      reasons = signal.reasons_json;
    } else if (typeof signal.reasons_json === 'string') {
      reasons = JSON.parse(signal.reasons_json);
    }
  } catch (e) {}

  let indicators: any = {};
  try {
    if (typeof signal.indicators_json === 'object' && signal.indicators_json !== null && !Array.isArray(signal.indicators_json)) {
      indicators = signal.indicators_json;
    } else if (typeof signal.indicators_json === 'string') {
      indicators = JSON.parse(signal.indicators_json);
    }
  } catch (e) {}

  const handleShare = () => {
    Share.share({ 
      message: `Check out this ${signal.direction} signal on ${signal.symbol}! Entry: $${signal.entry_low} - Targets up to +${signal.tp3_pct?.toFixed(2)}% 🚀` 
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Signal Details</Text>
        <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
          <MaterialCommunityIcons name="share-variant" size={22} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Hero Section */}
        <LinearGradient
          colors={gradientColors as [string, string]}
          style={styles.heroSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroTopRow}>
              <View style={[styles.badge, { backgroundColor: isLong ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)' }]}>
                <MaterialCommunityIcons name={isLong ? "trending-up" : "trending-down"} size={16} color={mainColor} />
                <Text style={[styles.badgeText, { color: mainColor }]}>{signal.direction}</Text>
              </View>
              <Text style={styles.heroMeta}>
                {signal.exchange} • {signal.timeframe} {signal.style}
              </Text>
            </View>

            <Text style={styles.symbolText}>{signal.symbol}</Text>
            
            <View style={styles.confidenceWrapper}>
              <ConfidenceBar confidence={signal.confidence} rrRatio={`1:${signal.rr_ratio} • ${signal.leverage || '5-10x'}`} />
              
              <View style={styles.aiMetaContainer}>
                <View style={styles.aiMetaRow}>
                  <Text style={styles.emojiIcon}>🤖</Text>
                  <Text style={styles.aiMetaLabel}>AI View:</Text>
                  <Text style={styles.aiMetaValue}>{signal.ai_decision || 'AI Filter bypassed'}</Text>
                </View>
                <View style={styles.aiMetaRow}>
                  <Text style={styles.emojiIcon}>🧠</Text>
                  <Text style={styles.aiMetaLabel}>ML Win Prob:</Text>
                  <Text style={styles.aiMetaValue}>{indicators['ML Win Prob'] || indicators['ml_win_prob'] || '50%'}</Text>
                </View>
                <View style={styles.aiMetaRow}>
                  <Text style={styles.emojiIcon}>🌐</Text>
                  <Text style={styles.aiMetaLabel}>Sentiment:</Text>
                  <Text style={styles.aiMetaValue}>{indicators['Sentiment'] || indicators['sentiment'] || 'Extreme Fear'}</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentPadding}>
          
          <View style={styles.validForContainer}>
            <Text style={styles.emojiIcon}>⏱️</Text>
            <Text style={styles.validForText}>Valid for: {signal.style.toLowerCase() === 'scalp' ? '15–60 min' : '1–3 days'}</Text>
          </View>
          
          {/* Target Ladder */}
          <View style={styles.ladderContainer}>
            <Text style={styles.sectionTitle}>TRADE SETUP</Text>

            <View style={styles.ladderRow}>
              <Text style={styles.ladderLabelGreen}>TP3</Text>
              <Text style={styles.ladderPrice}>${signal.tp3}</Text>
              <Text style={styles.ladderPctGreen}>+{signal.tp3_pct?.toFixed(2)}%</Text>
            </View>
            <View style={styles.ladderRow}>
              <Text style={styles.ladderLabelGreen}>TP2</Text>
              <Text style={styles.ladderPrice}>${signal.tp2}</Text>
              <Text style={styles.ladderPctGreen}>+{signal.tp2_pct?.toFixed(2)}%</Text>
            </View>
            <View style={styles.ladderRow}>
              <Text style={styles.ladderLabelGreen}>TP1</Text>
              <Text style={styles.ladderPrice}>${signal.tp1}</Text>
              <Text style={styles.ladderPctGreen}>+{signal.tp1_pct?.toFixed(2)}%</Text>
            </View>
            
            <View style={styles.entryZone}>
              <View style={styles.entryZoneLeft}>
                <MaterialCommunityIcons name="target" size={16} color="#FBBF24" style={{ marginRight: 6 }} />
                <Text style={styles.entryZoneLabel}>ENTRY ZONE</Text>
              </View>
              <Text style={styles.entryZoneValue}>${signal.entry_low} – {signal.entry_high}</Text>
            </View>

            <View style={styles.ladderRow}>
              <Text style={styles.ladderLabelGray}>Current</Text>
              <Text style={styles.ladderPriceCurrent}>${signal.price_at_signal}</Text>
              <Text style={styles.ladderPctGray}>-</Text>
            </View>

            <View style={[styles.ladderRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.ladderLabelRed}>Stop Loss</Text>
              <Text style={styles.ladderPrice}>${signal.stop_loss}</Text>
              <Text style={styles.ladderPctRed}>-{signal.risk_pct?.toFixed(2)}%</Text>
            </View>
          </View>

          {/* AI Analysis Box (if available) */}
          {signal.ai_reasoning ? (
            <View style={styles.aiBox}>
              <View style={styles.aiBoxHeader}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>🧠</Text>
                <Text style={styles.aiBoxTitle}>AI ANALYSIS</Text>
              </View>
              <Text style={styles.aiBoxText}>{signal.ai_reasoning}</Text>
            </View>
          ) : null}

          {/* Technical Setup Indicators */}
          {(reasons.length > 0 || Object.keys(indicators).length > 0) && (
            <View style={styles.indicatorsSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>SETUP</Text>
              </View>
              
              {reasons.map((reason, idx) => (
                <View key={idx} style={styles.reasonRow}>
                  <Text style={{ fontSize: 14, marginRight: 10 }}>✅</Text>
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}

              {/* Indicator Metrics Line */}
              {Object.keys(indicators).length > 0 && (
                <View style={[styles.reasonRow, { marginTop: 8 }]}>
                  <Text style={{ fontSize: 14, marginRight: 10 }}>📌</Text>
                  <Text style={styles.reasonText}>
                    {Object.entries(indicators)
                      .filter(([key]) => key !== 'ML Win Prob' && key !== 'Sentiment' && key !== 'ml_win_prob' && key !== 'sentiment')
                      .map(([key, val]) => `${key}: ${val}`)
                      .join(' · ')}
                    {Object.keys(indicators).length > 0 ? ' ✅' : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  notFoundContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  backButtonFallback: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonFallbackText: {
    color: '#F8FAFC',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#020617',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroSection: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  heroContent: {
    padding: 24,
    paddingTop: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  heroMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  symbolText: {
    color: '#F8FAFC',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 24,
  },
  confidenceWrapper: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  contentPadding: {
    padding: 24,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  ladderContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  ladderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  ladderLabelGreen: { color: '#10B981', fontSize: 13, fontWeight: '800', width: '20%' },
  ladderLabelRed: { color: '#FB7185', fontSize: 13, fontWeight: '800', width: '25%' },
  ladderLabelGray: { color: '#94A3B8', fontSize: 13, fontWeight: '700', width: '20%' },
  
  ladderPrice: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  ladderPriceCurrent: { color: '#FCD34D', fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  
  ladderPctGreen: { color: '#10B981', fontSize: 14, fontWeight: '700', width: '25%', textAlign: 'right' },
  ladderPctRed: { color: '#FB7185', fontSize: 14, fontWeight: '700', width: '25%', textAlign: 'right' },
  ladderPctGray: { color: '#64748B', fontSize: 14, fontWeight: '700', width: '25%', textAlign: 'right' },

  entryZone: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    marginVertical: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FBBF24',
  },
  entryZoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryZoneLabel: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  entryZoneValue: {
    color: '#FBBF24',
    fontSize: 15,
    fontWeight: '800',
  },
  aiBox: {
    backgroundColor: 'rgba(67, 56, 202, 0.15)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  aiBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiBoxTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  aiBoxText: {
    color: '#E0E7FF',
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '500',
  },
  indicatorsSection: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reasonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: 12,
  },
  reasonText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  chipLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 6,
    textTransform: 'uppercase',
  },
  chipValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  aiMetaContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  aiMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiMetaLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
    width: 90,
  },
  aiMetaValue: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  validForContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  validForText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  emojiIcon: {
    fontSize: 14,
    marginRight: 6,
  },
});
