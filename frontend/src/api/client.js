import axios from 'axios';

let csrfToken = null;

const rawBaseUrl = import.meta.env.VITE_API_URL || '/api';
const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

export const api = axios.create({
  baseURL: normalizedBaseUrl,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
  },
});

export function setCachedCsrfToken(token) {
  csrfToken = token;
}

export function getCachedCsrfToken() {
  if (csrfToken) return csrfToken;
  // Fallback to cookie (supporting both current sifon_csrf and legacy rocoware_csrf)
  const match = document.cookie.match(new RegExp('(^|;\\s*)(sifon_csrf|rocoware_csrf)=([^;]+)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export async function fetchCsrfToken() {
  try {
    const res = await axios.get(`${normalizedBaseUrl}/auth/csrf`, {
      withCredentials: true,
    });
    if (res.data?.data?.csrfToken) {
      csrfToken = res.data.data.csrfToken;
    }
    return csrfToken;
  } catch (err) {
    console.error('Failed to fetch CSRF token:', err);
    return null;
  }
}

// Request interceptor to attach CSRF token for mutating requests
api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    let token = getCachedCsrfToken();
    if (!token) {
      token = await fetchCsrfToken();
    }
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    }
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor to handle errors cleanly
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Retry once if CSRF token was invalid/expired
    if (error.response?.status === 403 && error.response?.data?.error?.code === 'CSRF_INVALID' && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await fetchCsrfToken();
      if (newToken) {
        originalRequest.headers['X-CSRF-Token'] = newToken;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

