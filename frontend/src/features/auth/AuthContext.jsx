import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setCachedCsrfToken, fetchCsrfToken } from '../../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      // First ensure we have a valid CSRF token in memory
      await fetchCsrfToken();

      const res = await api.get('/auth/me');
      if (res.data?.success && res.data?.data?.admin) {
        setAdmin(res.data.data.admin);
      } else {
        setAdmin(null);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        // Confirmed unauthenticated
        setAdmin(null);
      } else {
        // Server or network error
        setAuthError(err.response?.data?.error?.message || err.message || 'Failed to connect to authentication server');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.success) {
        const { admin: userAdmin, csrfToken } = res.data.data;
        if (csrfToken) {
          setCachedCsrfToken(csrfToken);
        }
        setAdmin(userAdmin);
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Login failed. Please check your credentials.';
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setAdmin(null);
      setCachedCsrfToken(null);
    }
  };

  const updateCurrentAdmin = (updated) => {
    setAdmin((prev) => (prev ? { ...prev, ...updated } : updated));
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        authError,
        checkAuth,
        login,
        logout,
        updateCurrentAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

