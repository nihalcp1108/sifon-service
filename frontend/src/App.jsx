import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ComplaintsListPage } from './pages/ComplaintsListPage';
import { CompletedComplaintsPage } from './pages/CompletedComplaintsPage';
import { NewComplaintPage } from './pages/NewComplaintPage';
import { ComplaintDetailsPage } from './pages/ComplaintDetailsPage';
import { BrandsPage } from './pages/BrandsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ServicersPage } from './pages/ServicersPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Authentication Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Administrator Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/complaints" element={<ComplaintsListPage />} />
                  <Route path="/complaints/completed" element={<CompletedComplaintsPage />} />
                  <Route path="/complaints/new" element={<NewComplaintPage />} />
                  <Route path="/complaints/:id" element={<ComplaintDetailsPage />} />
                  <Route path="/brands" element={<BrandsPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/servicers" element={<ServicersPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>

              {/* Fallback 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

