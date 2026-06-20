import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import api from '../../api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user } = response.data;
      
      await login(accessToken, user);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background justify-center px-6">
      <View className="items-center mb-10">
        <Text className="text-4xl font-bold text-white mb-2">AzSignal Pro</Text>
        <Text className="text-gray-400 text-lg">Login to your account</Text>
      </View>

      <View className="space-y-4">
        {error ? <Text className="text-accentRed text-center">{error}</Text> : null}
        
        <View className="bg-secondary rounded-xl p-4">
          <TextInput
            placeholder="Email Address"
            placeholderTextColor="#666"
            className="text-white text-base"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View className="bg-secondary rounded-xl p-4">
          <TextInput
            placeholder="Password"
            placeholderTextColor="#666"
            className="text-white text-base"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity 
          className="bg-accent rounded-xl p-4 items-center mt-4 flex-row justify-center"
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#1A1A2E" className="mr-2" />
          ) : null}
          <Text className="text-primary font-bold text-lg">Sign In</Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-400">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-accent font-semibold">Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
