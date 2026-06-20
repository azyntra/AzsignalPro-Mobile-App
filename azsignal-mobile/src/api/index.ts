import axios from 'axios';
import { Platform } from 'react-native';
import { getItem } from '../utils/storage';

// For local testing on emulator/simulator:
// iOS Simulator uses localhost
// Android Emulator uses 10.0.2.2
const localApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
const API_URL = process.env.EXPO_PUBLIC_API_URL || localApiUrl;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Import store here to avoid circular dependency issues
      const { useAuthStore } = require('../store/auth');
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
