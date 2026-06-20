import axios from 'axios';
import { Platform } from 'react-native';
import { getItem } from '../utils/storage';

const API_URL = 'http://130.162.189.149:3000/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  console.log('[AXIOS REQUEST]', config.method?.toUpperCase(), config.baseURL, config.url);
  const token = await getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('[AXIOS ERROR]', error.message, 'URL:', error.config?.baseURL, error.config?.url);
    if (error.toJSON) {
      console.log('[AXIOS ERROR JSON]', JSON.stringify(error.toJSON(), null, 2));
    }
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Import store here to avoid circular dependency issues
      const { useAuthStore } = require('../store/auth');
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
