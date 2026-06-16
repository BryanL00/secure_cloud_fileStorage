import axios from 'axios';

const api = axios.create({
  // Defaults to the TLS-enabled backend; override with VITE_API_URL if needed.
  baseURL: import.meta.env.VITE_API_URL || 'https://localhost:3001/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect if already on login page (prevents loop during /auth/me init check)
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;