import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  MessageSquare,
  Sparkles,
  HelpCircle,
  Check,
  Send,
  RefreshCw,
  Phone,
  Info,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../components/Toast';

export function SettingsPage() {
  const { admin, updateCurrentAdmin, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Profile Form
  const [profileName, setProfileName] = useState(admin?.name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Email Form
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // WhatsApp Notification Settings
  const [waSettings, setWaSettings] = useState({
    clickToChatEnabled: true,
    enabled: true,
    serverSenderConfigured: false,
    maskedSenderNumber: '',
    serverSenderNote: '',
    templateName: 'sifon_complaint_confirmation',
    templateLanguage: 'en_US',
    companyName: 'sifon-service',
    customMessageDraft: '',
    templateParameters: [],
    testRecipientPhone: '',
    providerConnection: {
      isConfigured: false,
      status: 'CHECKING',
      message: 'Checking provider connection...',
      providerNumber: null,
      verifiedName: null,
      matched: false,
    },
  });
  const [isLoadingWa, setIsLoadingWa] = useState(true);
  const [loadWaError, setLoadWaError] = useState('');
  const [isSavingWa, setIsSavingWa] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Refs to prevent race conditions and stale responses
  const fetchRequestIdRef = useRef(0);
  const isDirtyRef = useRef(false);

  // WhatsApp Test Message State
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const fetchNotificationSettings = async () => {
    const requestId = ++fetchRequestIdRef.current;
    setIsLoadingWa(true);
    setLoadWaError('');
    try {
      const res = await api.get('/settings/notifications');
      if (requestId !== fetchRequestIdRef.current) return; // Stale fetch response

      if (res.data?.success) {
        const data = res.data.data;

        // Only overwrite local form state if user has not entered unsaved edits
        if (!isDirtyRef.current) {
          const isChatActive = Boolean(data.clickToChatEnabled ?? data.enabled ?? true);
          setWaSettings((prev) => ({
            ...prev,
            ...data,
            clickToChatEnabled: isChatActive,
            enabled: isChatActive,
            maskedSenderNumber: data.maskedSenderNumber || '',
            serverSenderConfigured: Boolean(data.serverSenderConfigured),
            serverSenderNote: data.serverSenderNote || '',
          }));
          if (data.testRecipientPhone) {
            setTestPhone(data.testRecipientPhone);
          }
        }
      }
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      const msg = err.response?.data?.error?.message || 'Failed to load WhatsApp notification settings';
      setLoadWaError(msg);
      toast.error(msg);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setIsLoadingWa(false);
      }
    }
  };

  useEffect(() => {
    fetchNotificationSettings();
  }, []);

  // Handle Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    setIsUpdatingProfile(true);
    try {
      const res = await api.patch('/admin/profile', { name: profileName.trim() });
      if (res.data?.success) {
        updateCurrentAdmin({ name: profileName.trim() });
        toast.success('Admin name updated successfully');
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle Email Update
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailError('');
    setIsUpdatingEmail(true);
    try {
      const res = await api.patch('/admin/email', emailForm);
      if (res.data?.success) {
        toast.success(res.data.message || 'Email updated. Please log in with your new email.');
        await logout();
        navigate('/login');
      }
    } catch (err) {
      setEmailError(err.response?.data?.error?.message || 'Failed to update email address');
      toast.error(err.response?.data?.error?.message || 'Failed to update email');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Handle Password Update
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await api.patch('/admin/password', passwordForm);
      if (res.data?.success) {
        toast.success(res.data.message || 'Password changed. Please sign in with your new password.');
        await logout();
        navigate('/login');
      }
    } catch (err) {
      setPasswordError(err.response?.data?.error?.message || 'Failed to change password');
      toast.error(err.response?.data?.error?.message || 'Failed to change password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Handle WhatsApp Settings Save
  const handleSaveWaSettings = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSavingWa || isLoadingWa) return;

    setIsSavingWa(true);
    setSaveSuccessMsg('');
    try {
      const isChatActive = Boolean(waSettings.clickToChatEnabled ?? waSettings.enabled);
      const res = await api.patch('/settings/notifications', {
        clickToChatEnabled: isChatActive,
        enabled: isChatActive,
        companyName: String(waSettings.companyName || '').trim(),
        customMessageDraft: String(waSettings.customMessageDraft || ''),
        templateParameters: waSettings.templateParameters,
        testRecipientPhone: testPhone,
      });
      if (res.data?.success) {
        isDirtyRef.current = false;
        fetchRequestIdRef.current++; // Invalidate any pending in-flight GETs

        const savedData = res.data.data;
        const savedChatActive = Boolean(savedData.clickToChatEnabled ?? savedData.enabled);
        setWaSettings((prev) => ({
          ...prev,
          ...savedData,
          clickToChatEnabled: savedChatActive,
          enabled: savedChatActive,
        }));
        if (savedData.testRecipientPhone) {
          setTestPhone(savedData.testRecipientPhone);
        }
        toast.success('WhatsApp notification settings saved successfully');
        setSaveSuccessMsg('WhatsApp message template saved successfully to MongoDB.');
      }
    } catch (err) {
      // Retain the entered values on failure and display clear error
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to save notification settings');
    } finally {
      setIsSavingWa(false);
    }
  };

  // Re-verify provider status live
  const handleCheckStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await api.get('/settings/notifications/status');
      if (res.data?.success) {
        setWaSettings((prev) => ({ ...prev, providerConnection: res.data.data }));
        toast.success('Click-to-chat status refreshed');
      }
    } catch {
      toast.error('Failed to check provider connection');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Send test message / generate test link
  const handleSendTestMessage = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!testPhone.trim()) {
      toast.error('Please enter a test recipient phone number');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await api.post('/settings/notifications/test', {
        testRecipientPhone: testPhone.trim(),
      });
      if (res.data?.success) {
        setTestResult({
          success: true,
          message: res.data.message || 'Click-to-Chat WhatsApp link generated successfully!',
          linkData: res.data.data,
        });
        toast.success('Click-to-Chat WhatsApp link generated');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to generate test link';
      setTestResult({
        success: false,
        message: errMsg,
      });
      toast.error(errMsg);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Sample data interpolation for live preview
  const sampleValues = {
    customer_name: 'Ramesh Patel',
    complaint_id: 'SIF-2026/001',
    brand_name: 'Aquafresh',
    category_name: 'Water Purifier',
    product_name: '10L RO Water Purifier',
    servicer_name: 'Suresh Kumar',
    status: 'Registered',
    registered_date: new Date().toLocaleDateString('en-IN'),
    company_name: waSettings.companyName || 'sifon-service',
  };

  const getInterpolatedPreview = () => {
    const template = waSettings.customMessageDraft ||
      'Hello {{customer_name}}, your complaint #{{complaint_id}} for {{brand_name}} {{product_name}} has been registered with {{company_name}}. Assigned servicer: {{servicer_name}}. Current status: {{status}}.';
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => sampleValues[key] !== undefined ? sampleValues[key] : match);
  };

  const availablePlaceholders = [
    { tag: '{{customer_name}}', desc: 'Customer name' },
    { tag: '{{complaint_id}}', desc: 'Manual ticket ID' },
    { tag: '{{brand_name}}', desc: 'Brand name' },
    { tag: '{{category_name}}', desc: 'Category name' },
    { tag: '{{product_name}}', desc: 'Product name' },
    { tag: '{{servicer_name}}', desc: 'Assigned servicer' },
    { tag: '{{status}}', desc: 'Ticket status' },
    { tag: '{{registered_date}}', desc: 'Registration date' },
    { tag: '{{company_name}}', desc: 'Company branding' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administrator Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your account profile, login email, password, and WhatsApp customer notification settings.
        </p>
      </div>

      {/* 1. Account Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <User className="w-4 h-4 text-teal-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Administrator Profile
          </h2>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Email
            </label>
            <input
              type="text"
              disabled
              value={admin?.email || ''}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400 mt-1">To change your email address, use the section below.</p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUpdatingProfile || profileName === admin?.name}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition shadow-sm"
            >
              {isUpdatingProfile ? 'Saving...' : 'Update Name'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Change Email Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Mail className="w-4 h-4 text-teal-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Change Login Email
          </h2>
        </div>

        <p className="text-xs text-slate-500">
          Updating your email address will immediately terminate all active sessions for security. You will be required to log in again with the new email.
        </p>

        {emailError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{emailError}</span>
          </div>
        )}

        <form onSubmit={handleUpdateEmail} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                placeholder="newadmin@sifon.local"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={emailForm.currentPassword}
                onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                placeholder="Verify identity"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUpdatingEmail || !emailForm.newEmail || !emailForm.currentPassword}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition shadow-sm"
            >
              {isUpdatingEmail ? 'Updating Email...' : 'Change Email'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Change Password Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Lock className="w-4 h-4 text-teal-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Change Password
          </h2>
        </div>

        <p className="text-xs text-slate-500">
          Choose a strong password with at least 8 characters. Changing your password will invalidate all active sessions.
        </p>

        {passwordError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password <span className="text-rose-500">*</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPassword ? 'Hide Passwords' : 'Show Passwords'}</span>
            </button>

            <button
              type="submit"
              disabled={
                isUpdatingPassword ||
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
              }
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition shadow-sm"
            >
              {isUpdatingPassword ? 'Updating Password...' : 'Save New Password'}
            </button>
          </div>
        </form>
      </div>

      {/* 4. WhatsApp Customer Notifications Card (Click-to-Chat) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                WhatsApp Message Template (Click-to-Chat)
              </h2>
              <p className="text-xs text-slate-500">
                Manual customer communication via direct WhatsApp Click-to-Chat links. No Meta API credentials required.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {(waSettings.clickToChatEnabled ?? waSettings.enabled) ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Active (Click-to-Chat)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 ring-1 ring-slate-400/20">
                <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Disabled</span>
              </span>
            )}
          </div>
        </div>

        {/* Dynamic WhatsApp Content based on loading/error state */}
        {isLoadingWa ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-xs font-medium">Loading WhatsApp template settings...</p>
          </div>
        ) : loadWaError ? (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Failed to load WhatsApp settings</span>
            </div>
            <p className="text-xs text-rose-700">{loadWaError}</p>
            <button
              type="button"
              onClick={fetchNotificationSettings}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Loading Settings
            </button>
          </div>
        ) : (
          <>
            {/* Direct Click-to-Chat Flow Explanatory Callout */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>How Direct &ldquo;Send on WhatsApp&rdquo; Works</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-900/90 leading-relaxed pl-1">
                <li>
                  <strong>Opens WhatsApp. Review the message and press Send.</strong>
                </li>
                <li>
                  <strong>The sender is the WhatsApp account logged in on the device.</strong>
                </li>
                <li>
                  No Meta Cloud API credentials, phone-number IDs, or access tokens are required.
                </li>
                <li>
                  Links open directly on your mobile or web browser using the standard <code className="bg-emerald-100 px-1 py-0.5 rounded text-[10px] font-mono">https://wa.me/{'{phone}'}?text={'{message}'}</code> format.
                </li>
              </ul>
            </div>

            {/* Settings Saved Notification Banner */}
            {saveSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveSuccessMsg('')}
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* WhatsApp Settings Form */}
            <form onSubmit={handleSaveWaSettings} className="space-y-5">
              {/* Toggle Enable / Disable */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Enable &ldquo;Send on WhatsApp&rdquo; Actions
                  </span>
                  <p className="text-[11px] text-slate-500">
                    When enabled, a &ldquo;Send on WhatsApp&rdquo; button is available after registering a complaint and in complaint details.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLoadingWa || isSavingWa}
                    checked={Boolean(waSettings.clickToChatEnabled ?? waSettings.enabled)}
                    onChange={(e) => {
                      isDirtyRef.current = true;
                      setWaSettings({
                        ...waSettings,
                        clickToChatEnabled: e.target.checked,
                        enabled: e.target.checked,
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {/* Company Display Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company / Organization Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isLoadingWa || isSavingWa}
                  value={waSettings.companyName || ''}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setWaSettings({ ...waSettings, companyName: e.target.value });
                  }}
                  placeholder="e.g. sifon-service"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 disabled:opacity-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Replaces the <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">&#123;&#123;company_name&#125;&#125;</code> placeholder in your template.
                </p>
              </div>

              {/* Message Template Draft with Placeholders */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Message Template <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Saved in MongoDB and persisted across refreshes</span>
                </div>
                <textarea
                  rows={4}
                  required
                  disabled={isLoadingWa || isSavingWa}
                  value={waSettings.customMessageDraft || ''}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setWaSettings({ ...waSettings, customMessageDraft: e.target.value });
                  }}
                  placeholder="Hello {{customer_name}}, your complaint #{{complaint_id}} for {{brand_name}} {{product_name}} has been registered with {{company_name}}. Current status: {{status}}."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 font-sans disabled:opacity-50"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  This text will be URL-encoded with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">encodeURIComponent</code> and prefilled when opening WhatsApp.
                </p>
              </div>

              {/* Available Placeholders Guidance */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 block">Supported Placeholders:</span>
                <div className="flex flex-wrap gap-1.5">
                  {availablePlaceholders.map((p) => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => {
                        isDirtyRef.current = true;
                        setWaSettings(prev => ({
                          ...prev,
                          customMessageDraft: (prev.customMessageDraft || '') + ' ' + p.tag,
                        }));
                      }}
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                      title={`Click to add ${p.tag} (${p.desc})`}
                    >
                      {p.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5 font-semibold text-teal-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Live Preview (Formatted Message)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Sample Customer: Ramesh Patel</span>
                </div>
                <div className="bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-800/40 text-xs text-emerald-100 font-sans leading-relaxed whitespace-pre-wrap">
                  {getInterpolatedPreview()}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-400">
                  Settings are stored in MongoDB and applied immediately to all new complaints and complaint details.
                </p>
                <button
                  type="submit"
                  disabled={isLoadingWa || isSavingWa}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition shadow-sm"
                >
                  {isSavingWa ? 'Saving Settings...' : 'Save Settings'}
                </button>
              </div>
            </form>

            {/* Test WhatsApp Link Generation Section */}
            <div className="pt-6 border-t border-slate-200 space-y-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Test WhatsApp Click-to-Chat Link
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Generate and test a sample Click-to-Chat link using your configured template and an international test recipient number.
              </p>

              <form onSubmit={handleSendTestMessage} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="tel"
                      required
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="e.g. +91 9876543210 or 919876543210"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-teal-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingTest}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition shadow-sm shrink-0"
                  >
                    {isSendingTest ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{isSendingTest ? 'Generating...' : 'Generate Test Link'}</span>
                  </button>
                </div>
              </form>

              {/* Test Message Result Alert */}
              {testResult && (
                <div className={`p-4 rounded-xl border text-xs space-y-3 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5 overflow-hidden flex-1">
                      <span className="font-bold block">
                        {testResult.success ? 'Click-to-Chat Link Ready' : 'Link Generation Failed'}
                      </span>
                      <p className="break-words">{testResult.message}</p>
                    </div>
                  </div>

                  {testResult.success && testResult.linkData?.url && (
                    <div className="space-y-2 pt-2 border-t border-emerald-200/60">
                      <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 font-mono text-[11px] break-all">
                        {testResult.linkData.url}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => window.open(testResult.linkData.url, '_blank', 'noopener,noreferrer')}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Open in WhatsApp</span>
                        </button>

                        <div className="text-[11px] text-emerald-800 leading-snug">
                          <p className="font-semibold">Opens WhatsApp. Review the message and press Send.</p>
                          <p className="text-emerald-700 text-[10px]">The sender is the WhatsApp account logged in on the device.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
