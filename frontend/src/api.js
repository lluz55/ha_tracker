import axios from 'axios';

// Use environment variable for API URL, fallback to empty string (relative) for development proxy
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
});

// Prepend '/hat' to all requests starting with '/api' and add auth token
api.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('/api')) {
    config.url = `/hat${config.url}`;
  } else if (config.url && config.url.startsWith('/auth')) {
    // Also prepend /hat for auth routes
    config.url = `/hat${config.url}`;
  }

  const token = localStorage.getItem('ha_tracker_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
