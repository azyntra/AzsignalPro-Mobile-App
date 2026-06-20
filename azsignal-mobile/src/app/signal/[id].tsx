import { View, Text, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSignalStore, Signal } from '../../store/signals';
import { ConfidenceBar } from '../../components/ConfidenceBar';

export default function SignalDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { signals } = useSignalStore();
  
  const signal = signals.find(s => s.id === Number(id));

  if (!signal) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Text className="text-gray-400 font-medium">Signal not found or loading...</Text>
      </View>
    );
  }

  const isLong = signal.direction === 'LONG';
  const badgeColor = isLong ? 'border-[#16C784] text-[#16C784]' : 'border-[#EA3943] text-[#EA3943]';
  const bgBadgeColor = isLong ? 'bg-[#16C784]/20' : 'bg-[#EA3943]/20';

  // Parse JSON fields
  let reasons: string[] = [];
  try {
    if (signal.reasons_json) reasons = JSON.parse(signal.reasons_json);
  } catch (e) {}

  let indicators: any = {};
  try {
    if (signal.indicators_json) indicators = JSON.parse(signal.indicators_json);
  } catch (e) {}

  return (
    <ScrollView className="flex-1 bg-background">
      <Stack.Screen 
        options={{ 
          title: 'Back',
          headerStyle: { backgroundColor: '#0F1115' },
          headerTintColor: '#fff',
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={() => Share.share({ message: `Check out this ${signal.direction} on ${signal.symbol}!` })}>
              <MaterialCommunityIcons name="share-variant" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          ),
        }} 
      />

      <View className="p-5">
        {/* Title Row */}
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center space-x-3">
            <View className={`border px-2 py-0.5 rounded-sm ${bgBadgeColor} ${badgeColor}`}>
              <Text className={`font-bold text-xs ${badgeColor}`}>{signal.direction}</Text>
            </View>
            <Text className="text-white font-bold text-2xl">{signal.symbol}</Text>
          </View>
          <Text className="text-gray-500 text-xs font-semibold uppercase text-right">
            {signal.exchange} · {signal.timeframe}{'\n'}{signal.style}
          </Text>
        </View>

        {/* Confidence Row */}
        <View className="mt-4 mb-6">
          <ConfidenceBar confidence={signal.confidence} rrRatio={`1:${signal.rr_ratio} · 5-10x`} size="md" />
        </View>

        {/* Price Ladder */}
        <View className="mb-8">
          <View className="flex-row justify-between py-3 border-b border-gray-800/50">
            <Text className="text-[#16C784] font-bold text-sm">TP3</Text>
            <Text className="text-white font-semibold">${signal.tp3}</Text>
            <Text className="text-[#16C784] font-semibold">+{signal.tp3_pct}%</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-gray-800/50">
            <Text className="text-[#16C784] font-bold text-sm">TP2</Text>
            <Text className="text-white font-semibold">${signal.tp2}</Text>
            <Text className="text-[#16C784] font-semibold">+{signal.tp2_pct}%</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-gray-800/50">
            <Text className="text-[#16C784] font-bold text-sm">TP1</Text>
            <Text className="text-white font-semibold">${signal.tp1}</Text>
            <Text className="text-[#16C784] font-semibold">+{signal.tp1_pct}%</Text>
          </View>
          
          <View className="flex-row justify-between py-4 border-l-4 border-[#FFD700] pl-3 my-2 bg-[#FFD700]/5 rounded-r-lg">
            <Text className="text-[#FFD700] font-bold text-sm">Entry zone</Text>
            <Text className="text-[#FFD700] font-bold">${signal.entry_low}–{signal.entry_high}</Text>
          </View>

          <View className="flex-row justify-between py-3 border-b border-gray-800/50">
            <Text className="text-gray-400 text-sm">Current price</Text>
            <Text className="text-goldText font-semibold">${signal.price_at_signal}</Text>
            <Text className="text-gray-400 font-semibold">-</Text>
          </View>

          <View className="flex-row justify-between py-3">
            <Text className="text-[#EA3943] font-bold text-sm">Stop loss</Text>
            <Text className="text-white font-semibold">${signal.stop_loss}</Text>
            <Text className="text-[#EA3943] font-semibold">-{signal.risk_pct}%</Text>
          </View>
        </View>

        {/* AI Analysis */}
        {signal.ai_reasoning ? (
          <View className="bg-secondary rounded-xl p-4 border border-indigo-500/30 bg-indigo-900/10 mb-6">
            <Text className="text-indigo-300 font-semibold text-xs mb-2 uppercase tracking-wider">AI analysis</Text>
            <Text className="text-indigo-100 leading-6">{signal.ai_reasoning}</Text>
          </View>
        ) : null}

        {/* Setup Indicators */}
        {reasons.length > 0 && (
          <View className="mb-10">
            <Text className="text-gray-400 font-semibold text-sm mb-4">Setup indicators</Text>
            {reasons.map((reason, idx) => (
              <View key={idx} className="flex-row items-start mb-3">
                <View className="w-1.5 h-1.5 rounded-full bg-[#16C784] mt-2 mr-3" />
                <Text className="text-white font-medium flex-1 leading-5">{reason}</Text>
              </View>
            ))}

            {/* Indicator Chips */}
            <View className="flex-row flex-wrap mt-4">
              {Object.entries(indicators).map(([key, val], idx) => {
                if (typeof val === 'object') return null;
                return (
                  <View key={idx} className="bg-secondary border border-gray-700 rounded-full px-3 py-1.5 mr-2 mb-2 flex-row items-center">
                    <Text className="text-gray-400 text-xs font-semibold mr-1">{key}</Text>
                    <Text className="text-white text-xs font-bold">{val}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
