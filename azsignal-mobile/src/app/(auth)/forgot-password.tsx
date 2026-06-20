import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const router = useRouter();

  const handleRequestCode = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      // Always proceed to the next screen to prevent email enumeration
      router.push({
        pathname: '/(auth)/reset-password',
        params: { email }
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to request reset code. Please try again.');
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
                <MaterialCommunityIcons name="lock-reset" size={48} color="#10B981" />
              </View>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>Enter your email to receive a reset code</Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" style={styles.errorIcon} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <View style={[styles.inputWrapper, isEmailFocused && styles.inputWrapperFocused]}>
                <MaterialCommunityIcons name="email" size={24} color={isEmailFocused ? "#10B981" : "#64748B"} />
                <TextInput
                  placeholder="Enter your email"
                  placeholderTextColor="#475569"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setIsEmailFocused(true)}
                  onBlur={() => setIsEmailFocused(false)}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleRequestCode}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#020617" style={{ marginRight: 8 }} />
              ) : null}
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Sending...' : 'Send Reset Code'}
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
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 20,
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
  errorIcon: {
    marginRight: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 32,
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
  },
  submitButtonText: {
    color: '#020617',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
