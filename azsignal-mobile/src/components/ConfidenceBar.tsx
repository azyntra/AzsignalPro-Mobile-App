import React from 'react';
import { View, Text } from 'react-native';

interface ConfidenceBarProps {
  confidence: number; // 0 to 100
  rrRatio?: string;
  size?: 'sm' | 'md';
}

export function ConfidenceBar({ confidence, rrRatio, size = 'sm' }: ConfidenceBarProps) {
  const blocks = 10;
  const activeBlocks = Math.round((confidence / 100) * blocks);
  
  const blockHeight = size === 'sm' ? 'h-3' : 'h-4';
  const blockWidth = size === 'sm' ? 'w-2' : 'w-2.5';
  
  return (
    <View className="flex-row items-center justify-between w-full mt-2 mb-2">
      <View className="flex-row items-center space-x-[2px]">
        {Array.from({ length: blocks }).map((_, i) => (
          <View
            key={i}
            className={`${blockWidth} ${blockHeight} ${
              i < activeBlocks ? 'bg-[#FFD700]' : 'bg-gray-800'
            } rounded-sm`}
          />
        ))}
        <Text className="text-[#FFD700] font-bold text-xs ml-2">{confidence}%</Text>
      </View>
      
      {rrRatio && (
        <Text className="text-gray-400 text-xs font-semibold tracking-wider">
          R:R {rrRatio}
        </Text>
      )}
    </View>
  );
}
