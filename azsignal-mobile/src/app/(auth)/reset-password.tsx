import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../api';

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isTokenFocused, setIsTokenFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!token || !newPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(response.data.message || 'Password successfully reset.');
      
      // Navigate back to login after 2 seconds
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
      
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Please check your code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <LinearGradient
          colors={['#0F172A', '#020617']}
          style={styles.gradient}
        >
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={28} color="#F8FAFC" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="shield-key" size={48} color="#10B981" />
              </View>
              <Text style={styles.title}>Create New Password</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to{'\n'}
                <Text style={{ color: '#E2E8F0', fontWeight: '600' }}>{email || 'your email'}</Text>
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" style={styles.errorIcon} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View style={styles.successBox}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" style={styles.errorIcon} />
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>6-DIGIT CODE</Text>
              <View style={[styles.inputWrapper, isTokenFocused && styles.inputWrapperFocused]}>
                <MaterialCommunityIcons name="numeric" size={24} color={isTokenFocused ? "#10B981" : "#64748B"} />
                <TextInput
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="#475569"
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={token}
                  onChangeText={setToken}
                  onFocus={() => setIsTokenFocused(true)}
                  onBlur={() => setIsTokenFocused(false)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NEW PASSWORD</Text>
              <View style={[styles.inputWrapper, isPasswordFocused && styles.inputWrapperFocused]}>
                <MaterialCommunityIcons name="lock" size={24} color={isPasswordFocused ? "#10B981" : "#64748B"} />
                <TextInput
                  placeholder="Enter new password"
                  placeholderTextColor="#475569"
                  style={styles.input}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleResetPassword}
              disabled={isLoading || !!success}
            >
              {isLoading ? (
                <ActivityIndicator color="#020617" style={{ marginRight: 8 }} />
              ) : null}
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Text>
            </TouchableOpacity>

          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  headerBar: {
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 24,
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 24,
  },
  errorIcon: {
    marginRight: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  successText: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    height: 60,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  inputWrapperFocused: {
    borderColor: '#10B981',
    backgroundColor: '#0F172A',
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    marginLeft: 12,
    height: '100%',
  },
  submitButton: {
    backgroundColor: '#10B981',
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 12,
  },
  submitButtonText: {
    color: '#020617',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
