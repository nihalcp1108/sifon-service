import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UploadCloud,
  File,
  X,
  ArrowLeft,
  Plus,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Tag,
  Folder,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import {
  validateAndFormatCustomerPhone,
  cleanDuplicateCountryCode,
  SUPPORTED_COUNTRY_CODES,
} from '../utils/whatsapp';

export function NewComplaintPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [servicers, setServicers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isWhatsAppGloballyEnabled, setIsWhatsAppGloballyEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Registration Success Modal & WhatsApp Link state
  const [registeredComplaint, setRegisteredComplaint] = useState(null);
  const [registeredWhatsAppLink, setRegisteredWhatsAppLink] = useState(null);
  const [modalPhone, setModalPhone] = useState('');
  const [modalCountryCode, setModalCountryCode] = useState('+91');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [phoneUpdateError, setPhoneUpdateError] = useState('');

  // Inline Brand Modal State
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSubmitting, setBrandSubmitting] = useState(false);
  const [brandModalForm, setBrandModalForm] = useState({ name: '', description: '' });
  const [brandModalError, setBrandModalError] = useState('');

  // Inline Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryModalForm, setCategoryModalForm] = useState({ name: '', description: '' });
  const [categoryModalError, setCategoryModalError] = useState('');

  // Form fields
  const [formData, setFormData] = useState({
    complaintNumber: '',
    brand: '',
    category: '',
    customerName: '',
    customerPhone: '',
    countryCode: '+91',
    alternatePhone: '',
    customerEmail: '',
    customerAddress: '',
    area: '',
    productName: '',
    modelNumber: '',
    serialNumber: '',
    purchaseDate: '',
    warrantyStatus: 'unknown',
    subject: '',
    description: '',
    priority: 'medium',
    assignedServicer: '',
    scheduledServiceDate: '',
    internalNotes: '',
  });

  const handleResetForm = () => {
    setRegisteredComplaint(null);
    setRegisteredWhatsAppLink(null);
    setFormData({
      complaintNumber: '',
      brand: '',
      category: '',
      customerName: '',
      customerPhone: '',
      countryCode: '+91',
      alternatePhone: '',
      customerEmail: '',
      customerAddress: '',
      area: '',
      productName: '',
      modelNumber: '',
      serialNumber: '',
      purchaseDate: '',
      warrantyStatus: 'unknown',
      subject: '',
      description: '',
      priority: 'medium',
      assignedServicer: '',
      scheduledServiceDate: '',
      internalNotes: '',
    });
    setFiles([]);
    setUploadProgress(0);
    setSubmitError('');
    setFormErrors({});
  };

  // Selected files with local preview
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Load initial dropdown options
  const fetchActiveBrands = async () => {
    try {
      const res = await api.get('/brands', { params: { activeOnly: 'true' } });
      if (res.data?.success) {
        setBrands(res.data.data);
        return res.data.data;
      }
    } catch {
      // Non-blocking
    }
    return [];
  };

  const fetchActiveCategories = async () => {
    try {
      const res = await api.get('/categories', { params: { activeOnly: 'true' } });
      if (res.data?.success) {
        setCategories(res.data.data);
        return res.data.data;
      }
    } catch {
      // Non-blocking
    }
    return [];
  };

  useEffect(() => {
    api.get('/servicers', { params: { activeOnly: 'true' } })
      .then((res) => {
        if (res.data?.success) {
          setServicers(res.data.data);
        }
      })
      .catch(() => {});

    fetchActiveBrands();
    fetchActiveCategories();

    api.get('/settings/notifications')
      .then((res) => {
        if (res.data?.success) {
          const isChatActive = Boolean(res.data.data?.clickToChatEnabled ?? res.data.data?.enabled);
          setIsWhatsAppGloballyEnabled(isChatActive);
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  // Inline Brand Creation
  const handleCreateBrand = async (e) => {
    e.preventDefault();
    if (!brandModalForm.name.trim()) return;
    setBrandModalError('');
    setBrandSubmitting(true);
    try {
      const res = await api.post('/brands', brandModalForm);
      if (res.data?.success) {
        const newBrand = res.data.data;
        toast.success(`Brand "${newBrand.name}" created`);
        await fetchActiveBrands();
        setFormData((prev) => ({ ...prev, brand: newBrand._id }));
        setBrandModalOpen(false);
        setBrandModalForm({ name: '', description: '' });
      }
    } catch (err) {
      setBrandModalError(err.response?.data?.error?.message || 'Failed to create brand');
    } finally {
      setBrandSubmitting(false);
    }
  };

  // Inline Category Creation
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!categoryModalForm.name.trim()) return;
    setCategoryModalError('');
    setCategorySubmitting(true);
    try {
      const res = await api.post('/categories', categoryModalForm);
      if (res.data?.success) {
        const newCat = res.data.data;
        toast.success(`Category "${newCat.name}" created`);
        await fetchActiveCategories();
        setFormData((prev) => ({ ...prev, category: newCat._id }));
        setCategoryModalOpen(false);
        setCategoryModalForm({ name: '', description: '' });
      }
    } catch (err) {
      setCategoryModalError(err.response?.data?.error?.message || 'Failed to create category');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const maxFiles = 10;
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    const validBatch = [];
    for (const f of newFiles) {
      if (files.length + validBatch.length >= maxFiles) {
        toast.error(`Maximum ${maxFiles} attachments allowed`);
        break;
      }

      if (!allowedMime.includes(f.type)) {
        toast.error(`"${f.name}" is not a supported file type (JPEG, PNG, WebP, PDF only)`);
        continue;
      }

      if (f.size > maxSizeBytes) {
        toast.error(`"${f.name}" exceeds 10 MB limit`);
        continue;
      }

      let previewUrl = null;
      if (f.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(f);
      }

      validBatch.push({ file: f, previewUrl, id: Math.random().toString(36).substring(2) });
    }

    setFiles((prev) => [...prev, ...validBatch]);
  };

  const removeFile = (id) => {
    setFiles((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    setUploadProgress(0);
    setFormErrors({});

    try {
      const payload = new FormData();

      // Append form fields
      Object.entries(formData).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          payload.append(key, val);
        }
      });

      // Append files
      files.forEach(({ file }) => {
        payload.append('attachments', file);
      });

      const res = await api.post('/complaints', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      if (res.data?.success) {
        toast.success(`Complaint ${res.data.data.complaintNumber} registered successfully!`);
        setRegisteredComplaint(res.data.data);
        setRegisteredWhatsAppLink(res.data.whatsappLink || null);
        setModalPhone(res.data.data.customerPhone || '');
        setModalCountryCode(formData.countryCode || '+91');
      }
    } catch (err) {
      const respData = err.response?.data?.error;
      const errorMessage = respData?.message || err.message || 'Failed to register complaint';
      setSubmitError(errorMessage);

      if (respData?.details && typeof respData.details === 'object') {
        const mappedErrors = {};
        if (Array.isArray(respData.details)) {
          respData.details.forEach((d) => {
            if (d.path?.[0]) mappedErrors[d.path[0]] = d.message;
          });
        }
        setFormErrors(mappedErrors);
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateModalPhone = async () => {
    if (!registeredComplaint) return;
    setPhoneUpdateError('');

    const validation = validateAndFormatCustomerPhone(modalPhone, modalCountryCode);
    if (!validation.isValid) {
      setPhoneUpdateError(validation.error || 'Enter a valid customer WhatsApp number with country code.');
      return;
    }

    const cleanedPhone = cleanDuplicateCountryCode(modalPhone.trim(), modalCountryCode);

    setIsUpdatingPhone(true);
    try {
      const patchRes = await api.patch(`/complaints/${registeredComplaint._id}`, {
        customerPhone: cleanedPhone,
        countryCode: modalCountryCode,
        version: registeredComplaint.version,
      });

      if (patchRes.data?.success) {
        setRegisteredComplaint(patchRes.data.data);

        // Fetch fresh WhatsApp link with the updated phone
        const linkRes = await api.get(`/complaints/${registeredComplaint._id}/whatsapp-link`);
        if (linkRes.data?.success && linkRes.data?.data) {
          setRegisteredWhatsAppLink(linkRes.data.data);
          toast.success('Customer phone updated and WhatsApp link generated!');
        }
      }
    } catch (err) {
      setPhoneUpdateError(err.response?.data?.error?.message || 'Failed to update phone number');
    } finally {
      setIsUpdatingPhone(false);
    }
  };

  const handleRetryModalLink = async () => {
    if (!registeredComplaint) return;
    try {
      const linkRes = await api.get(`/complaints/${registeredComplaint._id}/whatsapp-link`);
      if (linkRes.data?.success && linkRes.data?.data) {
        setRegisteredWhatsAppLink(linkRes.data.data);
        if (linkRes.data.data.isValid) {
          toast.success('WhatsApp link loaded successfully');
        } else if (linkRes.data.data.error) {
          toast.info(linkRes.data.data.error);
        }
      }
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error?.message;
      if (status === 404 && errorMsg && errorMsg.includes('Endpoint')) {
        setRegisteredWhatsAppLink({
          url: '',
          isValid: false,
          reason: 'ENDPOINT_UNAVAILABLE',
          error: 'WhatsApp click-to-chat endpoint is unavailable on the server. Please verify backend routes and restart the backend server.',
        });
      } else if (status === 401) {
        setRegisteredWhatsAppLink({
          url: '',
          isValid: false,
          reason: 'UNAUTHORIZED',
          error: 'Session expired. Please log in again.',
        });
      } else {
        setRegisteredWhatsAppLink({
          url: '',
          isValid: false,
          reason: 'SETTINGS_ERROR',
          error: 'Could not load WhatsApp settings. Please retry.',
        });
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            to="/complaints"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Register New Complaint</h1>
            <p className="text-xs text-slate-500">Record customer issues, assign field servicers, and attach proof files.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Ticket Identification & Classification Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-600 border-b border-slate-100 pb-2">
            1. Ticket Identification & Classification
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Manual Complaint ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Complaint ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="complaintNumber"
                value={formData.complaintNumber}
                onChange={handleChange}
                placeholder="e.g. SIF-2026/001 or 0042"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono font-semibold transition focus:bg-white ${
                  formErrors.complaintNumber ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Letters, numbers, hyphens (-), and slashes (/) allowed. Preserves leading zeros.
              </p>
              {formErrors.complaintNumber && (
                <p className="text-[11px] text-rose-600 mt-1">{formErrors.complaintNumber}</p>
              )}
            </div>

            {/* Brand Dropdown with Add Brand Modal */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Brand <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBrandModalError('');
                    setBrandModalOpen(true);
                  }}
                  className="text-[11px] text-teal-600 hover:text-teal-700 font-semibold inline-flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Brand</span>
                </button>
              </div>
              <select
                required
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs transition focus:bg-white ${
                  formErrors.brand ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              >
                <option value="">-- Select Active Brand --</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {formErrors.brand && (
                <p className="text-[11px] text-rose-600 mt-1">{formErrors.brand}</p>
              )}
            </div>

            {/* Category Dropdown with Add Category Modal */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryModalError('');
                    setCategoryModalOpen(true);
                  }}
                  className="text-[11px] text-teal-600 hover:text-teal-700 font-semibold inline-flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Category</span>
                </button>
              </div>
              <select
                required
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs transition focus:bg-white ${
                  formErrors.category ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              >
                <option value="">-- Select Category --</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {formErrors.category && (
                <p className="text-[11px] text-rose-600 mt-1">{formErrors.category}</p>
              )}
            </div>
          </div>
        </div>

        {/* Customer Information Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-600 border-b border-slate-100 pb-2">
            2. Customer Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="e.g. Ramesh Patel"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs transition focus:bg-white ${
                  formErrors.customerName ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {formErrors.customerName && (
                <p className="text-[11px] text-rose-600 mt-1">{formErrors.customerName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Phone <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={handleChange}
                  className="w-24 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white shrink-0 font-medium"
                >
                  <option value="+91">+91 (IN)</option>
                  <option value="+1">+1 (US/CA)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+971">+971 (UAE)</option>
                  <option value="+65">+65 (SG)</option>
                  <option value="+61">+61 (AU)</option>
                </select>
                <input
                  type="tel"
                  required
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210"
                  className={`flex-1 px-3 py-2 bg-slate-50 border rounded-xl text-xs transition focus:bg-white ${
                    formErrors.customerPhone ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                  }`}
                />
              </div>
              {formErrors.customerPhone && (
                <p className="text-[11px] text-rose-600 mt-1">{formErrors.customerPhone}</p>
              )}

              {/* WhatsApp direct Click-to-Chat info */}
              <div className="mt-2.5 flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900">
                <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  A direct <strong>Send on WhatsApp</strong> link will be generated after registration to open customer chat with prefilled complaint details.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alternate Phone (Optional)
              </label>
              <input
                type="tel"
                name="alternatePhone"
                value={formData.alternatePhone}
                onChange={handleChange}
                placeholder="e.g. 9811122233"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs transition focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                name="customerEmail"
                value={formData.customerEmail}
                onChange={handleChange}
                placeholder="customer@example.com"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs transition focus:bg-white ${
                  formErrors.customerEmail ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {formErrors.customerEmail && (
                <p className="text-[11px] text-rose-600 mt-1">{formErrors.customerEmail}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Area / Location <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="area"
                value={formData.area}
                onChange={handleChange}
                placeholder="e.g. Indiranagar, South Zone"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs transition focus:bg-white ${
                  formErrors.area ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {formErrors.area && (
                <p className="text-[11px] text-rose-600 mt-1">{formErrors.area}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Physical Address <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                name="customerAddress"
                value={formData.customerAddress}
                onChange={handleChange}
                placeholder="House / Flat No., Street, Landmark, Pincode"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs transition focus:bg-white ${
                  formErrors.customerAddress ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {formErrors.customerAddress && (
                <p className="text-[11px] text-rose-600 mt-1">{formErrors.customerAddress}</p>
              )}
            </div>
          </div>
        </div>

        {/* Product Information Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-600 border-b border-slate-100 pb-2">
            3. Product & Warranty Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                placeholder="e.g. 10L RO Water Purifier"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Model Number (Optional)
              </label>
              <input
                type="text"
                name="modelNumber"
                value={formData.modelNumber}
                onChange={handleChange}
                placeholder="e.g. SIF-RO-2026"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Serial Number (Optional)
              </label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                placeholder="e.g. SN-88220011"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Warranty Status
              </label>
              <select
                name="warrantyStatus"
                value={formData.warrantyStatus}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              >
                <option value="unknown">Unknown</option>
                <option value="in_warranty">In Warranty</option>
                <option value="out_of_warranty">Out of Warranty</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purchase Date (Optional)
              </label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Complaint Information Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-600 border-b border-slate-100 pb-2">
            4. Issue Information & Priority
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Complaint Subject <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="e.g. Water leaking from membrane housing"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority Level <span className="text-rose-500">*</span>
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white font-medium"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the symptoms, observations, or troubleshooting previously attempted..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Administrative Notes (Optional)
              </label>
              <textarea
                rows={2}
                name="internalNotes"
                value={formData.internalNotes}
                onChange={handleChange}
                placeholder="Notes visible only to administrators..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Servicer Assignment Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-600 border-b border-slate-100 pb-2">
            5. Servicer Assignment (Optional)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assign Active Servicer
              </label>
              <select
                name="assignedServicer"
                value={formData.assignedServicer}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              >
                <option value="">-- Unassigned (Assign Later) --</option>
                {servicers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.phone}) {s.serviceArea ? `- ${s.serviceArea}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Scheduled Service Date (Optional)
              </label>
              <input
                type="datetime-local"
                name="scheduledServiceDate"
                value={formData.scheduledServiceDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Attachments Upload Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-teal-600 border-b border-slate-100 pb-2">
            6. Attachments & Supporting Documents
          </h2>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition ${
              isDragging ? 'border-teal-500 bg-teal-50/50' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
            }`}
          >
            <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">
              Drag & drop photos or PDF documents here
            </p>
            <p className="text-[11px] text-slate-400 mt-1 mb-4">
              Supports JPEG, PNG, WebP, and PDF up to 10 MB each (Max 10 files)
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition">
              <span>Choose Files</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </div>

          {/* File Previews List */}
          {files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
              {files.map(({ file, previewUrl, id }) => (
                <div
                  key={id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 relative group overflow-hidden"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="w-12 h-12 rounded-lg object-cover bg-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                      <File className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB &bull; {file.type.split('/')[1]?.toUpperCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submission Error Banner */}
        {submitError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-900">Registration Failed</p>
              <p className="text-rose-700">{submitError}</p>
              <p className="text-[11px] text-rose-600/80">
                All your entered information and selected attachments have been preserved. Please address the issue and try again.
              </p>
            </div>
          </div>
        )}

        {/* Upload Progress Indicator */}
        {isSubmitting && files.length > 0 && (
          <div className="bg-white rounded-2xl border border-teal-100 p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                Uploading {files.length} attachment(s) to secure storage...
              </span>
              <span className="font-mono text-teal-700">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-teal-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            to="/complaints"
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-md shadow-teal-600/20 disabled:opacity-50 transition"
          >
            {isSubmitting && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>
              {isSubmitting
                ? files.length > 0
                  ? `Uploading & Saving (${uploadProgress}%)...`
                  : 'Registering Complaint...'
                : 'Register Complaint'}
            </span>
          </button>
        </div>
      </form>

      {/* Inline Brand Creation Modal */}
      <Modal
        isOpen={brandModalOpen}
        onClose={() => setBrandModalOpen(false)}
        title="Add New Brand"
      >
        <form onSubmit={handleCreateBrand} className="space-y-4">
          {brandModalError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{brandModalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Brand Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={brandModalForm.name}
              onChange={(e) => setBrandModalForm({ ...brandModalForm, name: e.target.value })}
              placeholder="e.g. Aquafresh, Kent"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={brandModalForm.description}
              onChange={(e) => setBrandModalForm({ ...brandModalForm, description: e.target.value })}
              placeholder="Brand notes or manufacturer..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setBrandModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={brandSubmitting || !brandModalForm.name.trim()}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {brandSubmitting ? 'Creating...' : 'Save & Select Brand'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Inline Category Creation Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Add New Category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          {categoryModalError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{categoryModalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={categoryModalForm.name}
              onChange={(e) => setCategoryModalForm({ ...categoryModalForm, name: e.target.value })}
              placeholder="e.g. Water Purifier, Geyser"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={categoryModalForm.description}
              onChange={(e) => setCategoryModalForm({ ...categoryModalForm, description: e.target.value })}
              placeholder="Category scope or notes..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCategoryModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={categorySubmitting || !categoryModalForm.name.trim()}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {categorySubmitting ? 'Creating...' : 'Save & Select Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Registration Success Modal with Send on WhatsApp */}
      {registeredComplaint && (
        <Modal
          isOpen={Boolean(registeredComplaint)}
          onClose={() => navigate(`/complaints/${registeredComplaint._id}`)}
          title="Complaint Registered Successfully"
          maxWidth="max-w-xl"
        >
          <div className="space-y-5">
            {/* Header / Ticket Summary */}
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-950 text-base">
                    #{registeredComplaint.complaintNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                    {registeredComplaint.status || 'Registered'}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 truncate mt-0.5">
                  {registeredComplaint.customerName} &bull; {registeredComplaint.customerPhone}
                </p>
              </div>
            </div>

            {/* WhatsApp Action Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Send Confirmation on WhatsApp
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Direct click-to-chat messaging to customer
                  </p>
                </div>
              </div>

              {registeredWhatsAppLink?.url ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 block">
                      Message Preview:
                    </label>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {registeredWhatsAppLink.renderedMessage}
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <button
                        type="button"
                        onClick={() => window.open(registeredWhatsAppLink.url, '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Send on WhatsApp</span>
                      </button>

                      <div className="text-[11px] text-slate-600 leading-snug">
                        <p className="font-semibold text-slate-800">
                          Opens WhatsApp. Review the message and press Send.
                        </p>
                        <p className="text-slate-500 text-[10px]">
                          The sender is the WhatsApp account logged in on the device.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-950">
                        {registeredWhatsAppLink?.reason === 'DISABLED'
                          ? 'WhatsApp Click-to-Chat Disabled'
                          : registeredWhatsAppLink?.reason === 'ENDPOINT_UNAVAILABLE'
                          ? 'WhatsApp Endpoint Unavailable'
                          : registeredWhatsAppLink?.reason === 'UNAUTHORIZED'
                          ? 'Authentication Required'
                          : registeredWhatsAppLink?.reason === 'SETTINGS_ERROR'
                          ? 'Settings Load Issue'
                          : registeredWhatsAppLink?.reason === 'INVALID_PHONE'
                          ? 'Invalid Customer Phone'
                          : 'WhatsApp Service Notice'}
                      </p>
                      <p className="text-xs text-amber-800 mt-0.5 font-medium">
                        {registeredWhatsAppLink?.reason === 'DISABLED'
                          ? 'Enable WhatsApp click-to-chat in Account Settings.'
                          : registeredWhatsAppLink?.reason === 'ENDPOINT_UNAVAILABLE'
                          ? 'The WhatsApp click-to-chat route is unavailable. Please verify backend routes and restart the backend server.'
                          : registeredWhatsAppLink?.reason === 'UNAUTHORIZED'
                          ? 'Session expired. Please log in again.'
                          : registeredWhatsAppLink?.reason === 'INVALID_PHONE'
                          ? (registeredWhatsAppLink?.error || 'Enter a valid customer WhatsApp number with country code.')
                          : (registeredWhatsAppLink?.error || 'Could not load WhatsApp settings. Please retry.')}
                      </p>
                    </div>
                  </div>

                  {/* If disabled, provide quick link to settings */}
                  {registeredWhatsAppLink?.reason === 'DISABLED' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => navigate('/settings')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-semibold transition"
                      >
                        Open Account Settings
                      </button>
                    </div>
                  )}

                  {/* If settings or endpoint error, provide retry button */}
                  {(registeredWhatsAppLink?.reason === 'SETTINGS_ERROR' ||
                    registeredWhatsAppLink?.reason === 'ENDPOINT_UNAVAILABLE') && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleRetryModalLink}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-semibold transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry Loading Link
                      </button>
                    </div>
                  )}

                  {/* If invalid phone, provide inline correction right in modal */}
                  {registeredWhatsAppLink?.reason === 'INVALID_PHONE' && (
                    <div className="pt-2 border-t border-amber-200/80 space-y-2">
                      <span className="block text-[11px] font-semibold text-amber-950">
                        Correct customer WhatsApp phone number:
                      </span>
                      <div className="flex gap-2">
                        <select
                          value={modalCountryCode}
                          onChange={(e) => setModalCountryCode(e.target.value)}
                          className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-slate-800"
                          aria-label="Country Code"
                        >
                          {SUPPORTED_COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          value={modalPhone}
                          onChange={(e) => {
                            setModalPhone(e.target.value);
                            setPhoneUpdateError('');
                          }}
                          placeholder="e.g. 9876543210"
                          className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-800"
                        />
                        <button
                          type="button"
                          disabled={isUpdatingPhone || !modalPhone.trim()}
                          onClick={handleUpdateModalPhone}
                          className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0 transition"
                        >
                          {isUpdatingPhone ? 'Saving...' : 'Update & Generate'}
                        </button>
                      </div>
                      {phoneUpdateError && (
                        <p className="text-[11px] text-rose-700 font-semibold">{phoneUpdateError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                Register Another Complaint
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/complaints')}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  All Complaints
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/complaints/${registeredComplaint._id}`)}
                  className="w-full sm:w-auto px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
