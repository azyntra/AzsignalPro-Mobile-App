import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import api from '../../api';

export default function StatsScreen() {
  const [activeRange, setActiveRange] = useState('30D');
  const [stats, setStats] = useState({ totalSignals: 84, winRate: '68.4', avgProfit: '+2.8', cumulativePnl: '+38.6' });
  const ranges = ['7D', '30D', '90D', 'All'];

  useEffect(() => {
    api.get('/stats').then(res => {
      setStats({
        totalSignals: res.data.totalSignals,
        winRate: res.data.winRate,
        avgProfit: `+${res.data.avgProfit}`,
        cumulativePnl: `+${res.data.cumulativePnl}`
      });
    }).catch(console.error);
  }, []);

  // Mock data to match the UI mockup
  const chartData = [
    { day: 'M', winHeight: 60, lossHeight: 20 },
    { day: 'T', winHeight: 40, lossHeight: 15 },
    { day: 'W', winHeight: 50, lossHeight: 10 },
    { day: 'T', winHeight: 70, lossHeight: 30 },
    { day: 'F', winHeight: 30, lossHeight: 5 },
    { day: 'S', winHeight: 40, lossHeight: 10 },
    { day: 'S', winHeight: 20, lossHeight: 5 },
  ];

  const exchanges = [
    { name: 'OKX', signals: 28, winRate: '71%' },
    { name: 'Bybit', signals: 24, winRate: '66%' },
    { name: 'Binance', signals: 19, winRate: '68%' },
    { name: 'KuCoin', signals: 13, winRate: '61%' },
  ];

  return (
    <ScrollView className="flex-1 bg-background pt-12">
      {/* Header */}
      <View className="px-5 mb-5">
        <Text className="text-white text-3xl font-bold tracking-tight">Performance</Text>
      </View>

      {/* Range Filters */}
      <View className="px-5 mb-6 flex-row">
        {ranges.map(range => (
          <TouchableOpacity
            key={range}
            onPress={() => setActiveRange(range)}
            className={`px-4 py-1.5 rounded-full mr-2 border ${
              activeRange === range 
                ? 'bg-[#16C784]/20 border-[#16C784]' 
                : 'bg-transparent border-gray-800'
            }`}
          >
            <Text className={`text-sm font-medium ${
              activeRange === range ? 'text-[#16C784]' : 'text-gray-400'
            }`}>
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="px-5 mb-8">
        {/* KPI Grid */}
        <View className="flex-row flex-wrap justify-between">
          {/* Card 1 */}
          <View className="bg-secondary rounded-2xl p-4 mb-4 border border-gray-800/80 w-[48%]">
            <Text className="text-gray-400 text-xs font-semibold mb-2">Total signals</Text>
            <Text className="text-white text-2xl font-bold">{stats.totalSignals}</Text>
          </View>
          {/* Card 2 */}
          <View className="bg-secondary rounded-2xl p-4 mb-4 border border-gray-800/80 w-[48%]">
            <Text className="text-gray-400 text-xs font-semibold mb-2">Win rate</Text>
            <Text className="text-[#16C784] text-2xl font-bold">{stats.winRate}%</Text>
          </View>
          {/* Card 3 */}
          <View className="bg-secondary rounded-2xl p-4 mb-4 border border-gray-800/80 w-[48%]">
            <Text className="text-gray-400 text-xs font-semibold mb-2">Avg profit</Text>
            <Text className="text-[#16C784] text-2xl font-bold">{stats.avgProfit}%</Text>
          </View>
          {/* Card 4 */}
          <View className="bg-secondary rounded-2xl p-4 mb-4 border border-gray-800/80 w-[48%]">
            <Text className="text-gray-400 text-xs font-semibold mb-2">Cumulative P&L</Text>
            <Text className="text-[#F5B300] text-2xl font-bold">{stats.cumulativePnl}%</Text>
          </View>
        </View>

        {/* Stacked Bar Chart Card */}
        <View className="bg-secondary rounded-2xl p-5 mb-4 border border-gray-800/80 h-56 flex-col justify-between">
          <Text className="text-gray-400 text-sm font-semibold mb-2">Daily signals (wins vs losses)</Text>
          
          <View className="flex-1 flex-row items-end justify-between px-2 pt-4">
            {chartData.map((d, i) => (
              <View key={i} className="items-center w-8">
                <View className="w-4 rounded-t-sm bg-[#16C784]" style={{ height: d.winHeight }} />
                <View className="w-4 rounded-b-sm bg-[#EA3943] mb-2" style={{ height: d.lossHeight }} />
                <Text className="text-gray-500 text-[10px] font-bold">{d.day}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row items-center justify-start space-x-4 mt-2">
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-[#16C784] rounded-sm mr-2" />
              <Text className="text-gray-400 text-xs font-medium">Win</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-[#EA3943] rounded-sm mr-2" />
              <Text className="text-gray-400 text-xs font-medium">Loss</Text>
            </View>
          </View>
        </View>

        {/* By Exchange List */}
        <View className="mt-4">
          <Text className="text-gray-400 text-sm font-semibold mb-3 ml-1">By exchange</Text>
          <View className="bg-secondary rounded-2xl p-4 border border-gray-800/80">
            {exchanges.map((ex, i) => (
              <View 
                key={ex.name} 
                className={`flex-row justify-between items-center py-3 ${i !== exchanges.length - 1 ? 'border-b border-gray-800/50' : ''}`}
              >
                <Text className="text-white font-semibold w-24">{ex.name}</Text>
                <Text className="text-gray-400 text-sm">{ex.signals} signals</Text>
                <Text className="text-[#16C784] font-bold">{ex.winRate}</Text>
              </View>
            ))}
          </View>
        </View>

      </View>
      <View className="h-10" />
    </ScrollView>
  );
}
