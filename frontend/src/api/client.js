import axios from 'axios';

let csrfToken = null;

// Determine same-origin baseURL:
// Default to /api for same-origin proxying through Vercel (or Vite proxy in dev)
let rawBaseUrl = import.meta.env.VITE_API_URL || '/api';

// If an external backend origin (like Railway) was passed in the browser build,
// normalize to same-origin /api to ensure first-party cookie handling
if (typeof window !== 'undefined' && (rawBaseUrl.includes('railway.app') || rawBaseUrl.startsWith('http://') || rawBaseUrl.startsWith('https://'))) {
  try {
    const parsed = new URL(rawBaseUrl, window.location.origin);
    rawBaseUrl = parsed.pathname.startsWith('/api') ? parsed.pathname : '/api';
  } catch {
    rawBaseUrl = '/api';
  }
}

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
      headers: {
        'Accept': 'application/json',
      },
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

// Request interceptor to attach CSRF token and prevent duplicate /api prefix
api.interceptors.request.use(async (config) => {
  // Prevent duplicate /api segment if url was passed starting with /api/
  if (config.url && config.baseURL && (config.baseURL === '/api' || config.baseURL.endsWith('/api'))) {
    if (config.url.startsWith('/api/')) {
      config.url = config.url.replace(/^\/api/, '');
    } else if (config.url === '/api') {
      config.url = '/';
    }
  }

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

