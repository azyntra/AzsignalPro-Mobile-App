import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import api from '../../api';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password || !username) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/register', { email, username, password });
      const { accessToken, user } = response.data;
      
      await login(accessToken, user);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background justify-center px-6">
      <View className="items-center mb-10">
        <Text className="text-4xl font-bold text-white mb-2">Create Account</Text>
        <Text className="text-gray-400 text-lg">Join AzSignal Pro today</Text>
      </View>

      <View className="space-y-4">
        {error ? <Text className="text-accentRed text-center">{error}</Text> : null}
        
        <View className="bg-secondary rounded-xl p-4">
          <TextInput
            placeholder="Username"
            placeholderTextColor="#666"
            className="text-white text-base"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
        </View>

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
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#1A1A2E" className="mr-2" />
          ) : null}
          <Text className="text-primary font-bold text-lg">Sign Up</Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-400">Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-accent font-semibold">Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
