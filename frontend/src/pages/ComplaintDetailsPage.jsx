import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  Paperclip,
  History,
  Archive,
  RotateCcw,
  Edit3,
  UserCheck,
  Check,
  Tag,
  Folder,
  MessageSquare,
  RefreshCw,
  Send,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Modal, ConfirmModal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ServiceComplaintModal } from '../components/ServiceComplaintModal';
import { ServiceDetailsModal } from '../components/ServiceDetailsModal';
import {
  validateAndFormatCustomerPhone,
  cleanDuplicateCountryCode,
  SUPPORTED_COUNTRY_CODES,
} from '../utils/whatsapp';
import {
  formatKolkataDateTime,
  formatKolkataDate,
  formatCurrencyINR,
  getStatusBadgeClass,
  getPriorityBadgeClass,
  getStatusDisplayLabel,
} from '../utils/formatters';

export function ComplaintDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [complaint, setComplaint] = useState(null);
  const [servicers, setServicers] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRetryingWhatsApp, setIsRetryingWhatsApp] = useState(false);
  const [whatsAppLinkData, setWhatsAppLinkData] = useState(null);
  const [isLoadingWhatsAppLink, setIsLoadingWhatsAppLink] = useState(false);
  const [phoneEditOpen, setPhoneEditOpen] = useState(false);
  const [editCountryCode, setEditCountryCode] = useState('+91');
  const [editPhoneValue, setEditPhoneValue] = useState('');
  const [isUpdatingCustomerPhone, setIsUpdatingCustomerPhone] = useState(false);
  const [updateCustomerPhoneError, setUpdateCustomerPhoneError] = useState('');

  // Modals state
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceDetailsModalOpen, setServiceDetailsModalOpen] = useState(false);
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editDetailsModalOpen, setEditDetailsModalOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [deleteAttachmentId, setDeleteAttachmentId] = useState(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // Status Modal form
  const [statusForm, setStatusForm] = useState({
    status: '',
    assignedServicer: '',
    resolutionNotes: '',
    workPerformed: '',
    partsReplaced: '',
    serviceCharge: 0,
    completedDate: '',
  });

  // Assign Modal form
  const [assignForm, setAssignForm] = useState({
    assignedServicer: '',
    scheduledServiceDate: '',
  });

  // Edit Details form
  const [editForm, setEditForm] = useState({});

  // Service Note form
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Attachment upload
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Fetch complaint details
  const fetchComplaint = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/complaints/${id}`);
      if (res.data?.success) {
        const data = res.data.data;
        setComplaint(data);
        setEditCountryCode(data.countryCode || '+91');
        setEditPhoneValue(data.customerPhone || '');
        setStatusForm({
          status: data.status,
          assignedServicer: data.assignedServicer?._id || '',
          resolutionNotes: data.resolution?.resolutionNotes || '',
          workPerformed: data.resolution?.workPerformed || '',
          partsReplaced: data.resolution?.partsReplaced || '',
          serviceCharge: data.resolution?.serviceCharge || 0,
          completedDate: data.resolution?.completedDate ? new Date(data.resolution.completedDate).toISOString().slice(0, 16) : '',
        });
        setAssignForm({
          assignedServicer: data.assignedServicer?._id || '',
          scheduledServiceDate: data.scheduledServiceDate ? new Date(data.scheduledServiceDate).toISOString().slice(0, 16) : '',
        });
        setEditForm({
          shopName: data.shopName || '',
          representative: data.representative?._id || data.representative || '',
          brand: data.brand?._id || data.brand || '',
          category: data.category?._id || data.category || '',
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          alternatePhone: data.alternatePhone || '',
          customerEmail: data.customerEmail || '',
          customerAddress: data.customerAddress,
          area: data.area,
          productName: data.productName,
          modelNumber: data.modelNumber || '',
          serialNumber: data.serialNumber || '',
          warrantyStatus: data.warrantyStatus,
          subject: data.subject,
          description: data.description,
          priority: data.priority,
          internalNotes: data.internalNotes || '',
        });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load complaint details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchWhatsAppLink = useCallback(async () => {
    setIsLoadingWhatsAppLink(true);
    try {
      const res = await api.get(`/complaints/${id}/whatsapp-link`);
      if (res.data?.success && res.data?.data) {
        setWhatsAppLinkData(res.data.data);
      }
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error?.message;

      if (status === 404) {
        if (errorMsg && errorMsg.includes('Endpoint')) {
          setWhatsAppLinkData({
            url: '',
            isValid: false,
            reason: 'ENDPOINT_UNAVAILABLE',
            error: 'WhatsApp click-to-chat endpoint is unavailable on the server. Please verify backend routes and restart the backend server.',
          });
        } else {
          setWhatsAppLinkData({
            url: '',
            isValid: false,
            reason: 'COMPLAINT_NOT_FOUND',
            error: errorMsg || 'Complaint not found.',
          });
        }
      } else if (status === 401) {
        setWhatsAppLinkData({
          url: '',
          isValid: false,
          reason: 'UNAUTHORIZED',
          error: 'Session expired or unauthenticated. Please log in again.',
        });
      } else if (!err.response) {
        setWhatsAppLinkData({
          url: '',
          isValid: false,
          reason: 'NETWORK_ERROR',
          error: 'Network connection error. Unable to reach backend server.',
        });
      } else {
        setWhatsAppLinkData({
          url: '',
          isValid: false,
          reason: 'SERVER_ERROR',
          error: errorMsg || 'Could not load WhatsApp link due to a server error.',
        });
      }
    } finally {
      setIsLoadingWhatsAppLink(false);
    }
  }, [id]);

  const handleSaveCustomerPhone = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!complaint) return;
    setUpdateCustomerPhoneError('');

    const validation = validateAndFormatCustomerPhone(editPhoneValue, editCountryCode);
    if (!validation.isValid) {
      setUpdateCustomerPhoneError(validation.error || 'Enter a valid customer WhatsApp number with country code.');
      return;
    }

    const cleanedNumber = cleanDuplicateCountryCode(editPhoneValue.trim(), editCountryCode);

    setIsUpdatingCustomerPhone(true);
    try {
      const res = await api.patch(`/complaints/${id}`, {
        customerPhone: cleanedNumber,
        countryCode: editCountryCode,
        version: complaint.version,
      });
      if (res.data?.success) {
        toast.success('Customer phone updated successfully');
        setComplaint(res.data.data);
        setPhoneEditOpen(false);
        await fetchWhatsAppLink();
      }
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Record was modified concurrently. Refreshing latest data...');
        fetchComplaint();
      } else {
        setUpdateCustomerPhoneError(err.response?.data?.error?.message || 'Failed to update phone number');
      }
    } finally {
      setIsUpdatingCustomerPhone(false);
    }
  };

  useEffect(() => {
    fetchComplaint();
    fetchWhatsAppLink();
    // Load active servicers for selection
    api.get('/servicers', { params: { activeOnly: 'true' } })
      .then(res => {
        if (res.data?.success) setServicers(res.data.data);
      })
      .catch(() => {});

    api.get('/representatives')
      .then(res => {
        if (res.data?.success) setRepresentatives(res.data.data);
      })
      .catch(() => {});

    // Load active brands and categories for edit modal
    api.get('/brands')
      .then(res => {
        if (res.data?.success) setBrands(res.data.data);
      })
      .catch(() => {});

    api.get('/categories')
      .then(res => {
        if (res.data?.success) setCategories(res.data.data);
      })
      .catch(() => {});
  }, [fetchComplaint]);

  // Handle Status Update
  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    setIsSubmittingModal(true);
    try {
      const payload = {
        ...statusForm,
        version: complaint.version,
      };
      const res = await api.patch(`/complaints/${id}/status`, payload);
      if (res.data?.success) {
        toast.success(`Status updated to ${res.data.data.status}`);
        setComplaint(res.data.data);
        setStatusModalOpen(false);
        window.dispatchEvent(new CustomEvent('complaint-status-changed', { detail: res.data.data }));
      }
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Record was modified concurrently. Refreshing latest data...');
        fetchComplaint();
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to update status');
      }
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Reopen completed complaint and return it to active register
  const handleReopenTicket = async () => {
    setIsSubmittingModal(true);
    try {
      const payload = {
        status: 'In Progress',
        assignedServicer: complaint.assignedServicer?._id || complaint.assignedServicer || undefined,
        resolutionNotes: complaint.resolution?.resolutionNotes || 'Ticket reopened for further service.',
        version: complaint.version,
      };
      const res = await api.patch(`/complaints/${id}/status`, payload);
      if (res.data?.success) {
        toast.success('Ticket reopened successfully. Returned to active complaints register.');
        setComplaint(res.data.data);
        setReopenConfirmOpen(false);
        window.dispatchEvent(new CustomEvent('complaint-status-changed', { detail: res.data.data }));
      }
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Record was modified concurrently. Refreshing latest data...');
        fetchComplaint();
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to reopen ticket');
      }
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Handle Assignment Update
  const handleUpdateAssignment = async (e) => {
    e.preventDefault();
    setIsSubmittingModal(true);
    try {
      const payload = {
        assignedServicer: assignForm.assignedServicer,
        scheduledServiceDate: assignForm.scheduledServiceDate || undefined,
        version: complaint.version,
      };
      const res = await api.patch(`/complaints/${id}/assignment`, payload);
      if (res.data?.success) {
        toast.success(res.data.message || 'Servicer assigned successfully');
        setComplaint(res.data.data);
        setAssignModalOpen(false);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Record was modified concurrently. Refreshing latest data...');
        fetchComplaint();
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to assign servicer');
      }
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Handle Edit Complaint Details
  const handleSaveDetails = async (e) => {
    e.preventDefault();
    setIsSubmittingModal(true);
    try {
      const payload = {
        ...editForm,
        version: complaint.version,
      };
      const res = await api.patch(`/complaints/${id}`, payload);
      if (res.data?.success) {
        toast.success('Complaint details updated');
        setComplaint(res.data.data);
        setEditDetailsModalOpen(false);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Record was modified concurrently. Refreshing latest data...');
        fetchComplaint();
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to update details');
      }
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Add Service Note
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    try {
      const res = await api.post(`/complaints/${id}/notes`, { note: newNote });
      if (res.data?.success) {
        toast.success('Service note recorded');
        setComplaint(res.data.data);
        setNewNote('');
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to add note');
    } finally {
      setIsAddingNote(false);
    }
  };

  // Retry WhatsApp Notification
  const handleRetryWhatsApp = async () => {
    setIsRetryingWhatsApp(true);
    try {
      const res = await api.post(`/complaints/${id}/notifications/whatsapp/retry`);
      if (res.data?.success) {
        toast.success('WhatsApp notification re-queued successfully');
        await fetchComplaint();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to re-queue WhatsApp notification');
    } finally {
      setIsRetryingWhatsApp(false);
    }
  };

  // Upload Attachments
  const handleUploadFiles = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploadingFiles(true);
    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach((f) => formData.append('attachments', f));

      const res = await api.post(`/complaints/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        toast.success('Attachments uploaded successfully');
        setComplaint(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to upload attachments');
    } finally {
      setIsUploadingFiles(false);
      e.target.value = '';
    }
  };

  // Delete Attachment
  const handleDeleteAttachment = async () => {
    if (!deleteAttachmentId) return;
    setIsSubmittingModal(true);
    try {
      const res = await api.delete(`/complaints/${id}/attachments/${deleteAttachmentId}`);
      if (res.data?.success) {
        toast.success('Attachment removed');
        setComplaint(res.data.data);
        setDeleteAttachmentId(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to remove attachment');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Download Attachment
  const handleDownloadAttachment = async (attachmentId, filename) => {
    try {
      const res = await api.get(`/complaints/${id}/attachments/${attachmentId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download attachment');
    }
  };

  // Download Individual PDF
  const handleDownloadPdf = async () => {
    try {
      toast.info('Preparing PDF document...');
      const res = await api.get(`/complaints/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const safeId = String(complaint.complaintNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `sifon-service-complaint-${safeId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to download complaint PDF');
    }
  };

  // Archive or Restore
  const handleToggleArchive = async () => {
    setIsSubmittingModal(true);
    try {
      const endpoint = complaint.isArchived ? `/complaints/${id}/restore` : `/complaints/${id}/archive`;
      const res = await api.patch(endpoint);
      if (res.data?.success) {
        toast.success(complaint.isArchived ? 'Complaint restored' : 'Complaint archived');
        setComplaint(res.data.data);
        setConfirmArchiveOpen(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update archive status');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading complaint details..." />;
  }

  if (error || !complaint) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-8">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800 mb-1">Complaint Not Found</h2>
        <p className="text-sm text-slate-500 mb-4">{error || 'This record could not be loaded.'}</p>
        <Link
          to="/complaints"
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition"
        >
          Back to Register
        </Link>
      </div>
    );
  }

  const wa = complaint.whatsappNotification;

  const getWhatsAppBadgeClass = (st) => {
    switch (st) {
      case 'Delivered':
      case 'Read':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20';
      case 'Accepted by provider':
        return 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-600/20';
      case 'Processing':
        return 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20';
      case 'Queued':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
      case 'Failed':
        return 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20';
      case 'Unknown':
        return 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20';
      default:
        return 'bg-slate-100 text-slate-500 ring-1 ring-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            to="/complaints"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            title="Back to complaints"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {complaint.complaintNumber}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(complaint.status)}`}>
                {getStatusDisplayLabel(complaint.status)}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPriorityBadgeClass(complaint.priority)}`}>
                {complaint.priority}
              </span>
              {complaint.isArchived && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                  Archived
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Registered on {formatKolkataDateTime(complaint.complaintDate)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!complaint.isArchived && complaint.status !== 'Cancelled' && (
            ['Resolved', 'Closed'].includes(complaint.status) ? (
              <>
                <button
                  type="button"
                  onClick={() => setServiceDetailsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>View Service Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReopenConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-xl transition shadow-sm"
                  title="Reopen ticket and return to active complaints register"
                >
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  <span>Reopen Ticket</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setServiceModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
              >
                <Wrench className="w-4 h-4" />
                <span>Service Complaint</span>
              </button>
            )
          )}

          <button
            onClick={() => setStatusModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition shadow-sm"
          >
            <Check className="w-4 h-4 text-teal-600" />
            <span>Update Status</span>
          </button>

          <button
            onClick={() => setAssignModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition shadow-sm"
          >
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span>Assign Servicer</span>
          </button>

          <button
            onClick={() => setEditDetailsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition shadow-sm"
          >
            <Edit3 className="w-4 h-4 text-slate-500" />
            <span>Edit Details</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-teal-50 hover:text-teal-700 text-slate-700 text-xs font-semibold rounded-xl transition shadow-sm"
            title="Download formatted A4 PDF"
          >
            <Download className="w-4 h-4" />
            <span>Download Complaint PDF</span>
          </button>

          <button
            onClick={() => setConfirmArchiveOpen(true)}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
            title={complaint.isArchived ? 'Restore Complaint' : 'Archive Complaint'}
          >
            {complaint.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Grid: Details Left, Sidebar Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Overview Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Complaint Subject
            </h2>
            <p className="text-base font-bold text-slate-900">{complaint.subject}</p>
            <div className="pt-2 border-t border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Detailed Description
              </h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {complaint.description}
              </p>
            </div>
            {complaint.internalNotes && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/60">
                <span className="text-xs font-bold text-amber-900 block mb-0.5">Administrative Note</span>
                <p className="text-xs text-amber-800 whitespace-pre-wrap">{complaint.internalNotes}</p>
              </div>
            )}
          </div>

          {/* WhatsApp Direct Click-to-Chat Action Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Send on WhatsApp
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Direct Click-to-Chat messaging for customer ticket updates
                  </p>
                </div>
              </div>
              {whatsAppLinkData?.isValid ? (
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  Ready
                </span>
              ) : (
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                  Click-to-Chat
                </span>
              )}
            </div>

            {isLoadingWhatsAppLink ? (
              <div className="py-6 flex items-center justify-center text-xs text-slate-400 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                <span>Loading WhatsApp link...</span>
              </div>
            ) : whatsAppLinkData?.isValid ? (
              <div className="space-y-3.5 text-xs">
                {/* Recipient Number & Link Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Customer WhatsApp Number:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      +{whatsAppLinkData.internationalDigits}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 sm:text-right font-mono truncate max-w-xs">
                    https://wa.me/{whatsAppLinkData.internationalDigits}
                  </div>
                </div>

                {/* Prefilled Message Preview */}
                <div className="space-y-1">
                  <span className="text-slate-600 font-semibold block text-[11px]">
                    Prefilled Message Preview:
                  </span>
                  <div className="p-3.5 bg-emerald-950/5 rounded-xl border border-emerald-900/10 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                    {whatsAppLinkData.renderedMessage}
                  </div>
                </div>

                {/* Primary Button & Required Explanations */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (whatsAppLinkData?.url) {
                        window.open(whatsAppLinkData.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send on WhatsApp</span>
                  </button>

                  <div className="text-[11px] text-slate-600 leading-snug space-y-0.5">
                    <p className="font-semibold text-slate-800">
                      Opens WhatsApp. Review the message and press Send.
                    </p>
                    <p className="text-slate-500 text-[10px]">
                      The sender is the WhatsApp account logged in on the device.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-950 block">
                      {whatsAppLinkData?.reason === 'DISABLED'
                        ? 'WhatsApp Click-to-Chat Disabled'
                        : whatsAppLinkData?.reason === 'ENDPOINT_UNAVAILABLE'
                        ? 'WhatsApp Endpoint Unavailable'
                        : whatsAppLinkData?.reason === 'COMPLAINT_NOT_FOUND'
                        ? 'Complaint Not Found'
                        : whatsAppLinkData?.reason === 'UNAUTHORIZED'
                        ? 'Authentication Required'
                        : whatsAppLinkData?.reason === 'SETTINGS_ERROR'
                        ? 'Settings Load Issue'
                        : whatsAppLinkData?.reason === 'SERVER_ERROR'
                        ? 'Server Error'
                        : whatsAppLinkData?.reason === 'NETWORK_ERROR'
                        ? 'Network Error'
                        : whatsAppLinkData?.reason === 'INVALID_PHONE'
                        ? 'Invalid Customer Phone'
                        : 'WhatsApp Service Notice'}
                    </span>
                    <p className="text-xs text-amber-800 mt-0.5 font-medium">
                      {whatsAppLinkData?.reason === 'DISABLED'
                        ? 'Enable WhatsApp click-to-chat in Account Settings.'
                        : whatsAppLinkData?.reason === 'ENDPOINT_UNAVAILABLE'
                        ? 'The WhatsApp click-to-chat route is unavailable. Please check that backend changes are deployed and restart the backend server.'
                        : whatsAppLinkData?.reason === 'COMPLAINT_NOT_FOUND'
                        ? 'The complaint record could not be found.'
                        : whatsAppLinkData?.reason === 'UNAUTHORIZED'
                        ? 'Please log in to generate WhatsApp links.'
                        : whatsAppLinkData?.reason === 'INVALID_PHONE'
                        ? (whatsAppLinkData?.error || 'Enter a valid customer WhatsApp number with country code.')
                        : (whatsAppLinkData?.error || 'Could not load WhatsApp link. Please retry.')}
                    </p>
                  </div>
                </div>

                {whatsAppLinkData?.reason === 'DISABLED' && (
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

                {whatsAppLinkData?.reason === 'COMPLAINT_NOT_FOUND' && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => navigate('/complaints')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-semibold transition"
                    >
                      Back to Complaints
                    </button>
                  </div>
                )}

                {whatsAppLinkData?.reason === 'UNAUTHORIZED' && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-semibold transition"
                    >
                      Log In
                    </button>
                  </div>
                )}

                {(whatsAppLinkData?.reason === 'SETTINGS_ERROR' ||
                  whatsAppLinkData?.reason === 'SERVER_ERROR' ||
                  whatsAppLinkData?.reason === 'NETWORK_ERROR' ||
                  whatsAppLinkData?.reason === 'ENDPOINT_UNAVAILABLE') && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={fetchWhatsAppLink}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-semibold transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Loading Link
                    </button>
                  </div>
                )}

                {whatsAppLinkData?.reason === 'INVALID_PHONE' && (
                  <div className="pt-2 border-t border-amber-200/80 space-y-2">
                    <span className="block text-[11px] font-semibold text-amber-950">
                      Update customer WhatsApp number directly:
                    </span>
                    <form onSubmit={handleSaveCustomerPhone} className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={editCountryCode}
                        onChange={(e) => setEditCountryCode(e.target.value)}
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
                        value={editPhoneValue}
                        onChange={(e) => {
                          setEditPhoneValue(e.target.value);
                          setUpdateCustomerPhoneError('');
                        }}
                        placeholder="e.g. 9876543210"
                        className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-800"
                      />
                      <button
                        type="submit"
                        disabled={isUpdatingCustomerPhone || !editPhoneValue.trim()}
                        className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0 transition"
                      >
                        {isUpdatingCustomerPhone ? 'Saving...' : 'Update & Generate'}
                      </button>
                    </form>
                    {updateCustomerPhoneError && (
                      <p className="text-[11px] text-rose-700 font-semibold">{updateCustomerPhoneError}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Preserved Legacy History if present */}
            {wa && wa.status && wa.status !== 'None' && (
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-slate-500">
                    Legacy Outbox Log
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getWhatsAppBadgeClass(wa.status)}`}>
                    {wa.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Outbox Recipient:</span>
                    <span className="font-mono">{wa.destinationPhone || complaint.customerPhone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Last Attempted:</span>
                    <span>{wa.lastUpdated ? formatKolkataDateTime(wa.lastUpdated) : '-'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Service Completion Details Card */}
          {(complaint.resolution?.resolutionNotes || complaint.resolution?.workPerformed || complaint.resolution?.completedDate || ['Resolved', 'Closed'].includes(complaint.status)) && (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Service Completion Details
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    Completed
                  </span>
                  <button
                    onClick={() => setStatusModalOpen(true)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    Edit Resolution
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-slate-500 block mb-0.5">Serviced By:</span>
                  <span className="text-sm font-bold text-slate-900">
                    {complaint.assignedServicer?.name || complaint.servicerNameSnapshot || 'Not recorded'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block mb-0.5">Completion Date:</span>
                  <span className="text-sm text-slate-800">
                    {complaint.resolution?.completedDate
                      ? formatKolkataDateTime(complaint.resolution.completedDate)
                      : 'Not recorded'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-semibold text-slate-500 block mb-0.5">Work Performed:</span>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {complaint.resolution?.workPerformed || 'Not recorded'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-semibold text-slate-500 block mb-0.5">Resolution Notes:</span>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {complaint.resolution?.resolutionNotes || 'Not recorded'}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block mb-0.5">Parts Replaced:</span>
                  <span className="text-sm font-medium text-slate-800">{complaint.resolution?.partsReplaced || 'None'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block mb-0.5">Service Charge:</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">{formatCurrencyINR(complaint.resolution?.serviceCharge || 0)}</span>
                </div>
                {complaint.resolution?.additionalNotes && (
                  <div className="sm:col-span-2">
                    <span className="font-semibold text-slate-500 block mb-0.5">Additional Notes:</span>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{complaint.resolution.additionalNotes}</p>
                  </div>
                )}
                {complaint.resolution?.completedByName && (
                  <div>
                    <span className="font-semibold text-slate-500 block mb-0.5">Recorded By:</span>
                    <span className="text-sm text-slate-700">{complaint.resolution.completedByName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-teal-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Attachments ({complaint.attachments?.length || 0})
                </h2>
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold rounded-xl cursor-pointer transition">
                <Plus className="w-3.5 h-3.5" />
                <span>{isUploadingFiles ? 'Uploading...' : 'Upload Files'}</span>
                <input
                  type="file"
                  multiple
                  disabled={isUploadingFiles}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleUploadFiles}
                  className="hidden"
                />
              </label>
            </div>

            {complaint.attachments?.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No attachments uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {complaint.attachments.map((att) => {
                  const isImage = att.mimeType.startsWith('image/');
                  return (
                    <div
                      key={att._id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                          {isImage ? <FileText className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={att.originalName}>
                            {att.originalName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {(att.fileSize / 1024).toFixed(1)} KB &bull; {formatKolkataDate(att.uploadedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleDownloadAttachment(att._id, att.originalName)}
                          className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg hover:bg-white transition"
                          title="Download attachment"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteAttachmentId(att._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition"
                          title="Delete attachment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Internal Service Notes & Conversation Thread */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
              Internal Service Notes ({complaint.serviceNotes?.length || 0})
            </h2>

            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={2}
                required
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log internal note, phone call log, or servicer update..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAddingNote || !newNote.trim()}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition"
                >
                  {isAddingNote ? 'Saving...' : 'Add Note'}
                </button>
              </div>
            </form>

            <div className="space-y-3 pt-2">
              {complaint.serviceNotes?.map((note) => (
                <div key={note._id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700">{note.createdByName || 'Administrator'}</span>
                    <span className="text-slate-400">{formatKolkataDateTime(note.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap">{note.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <History className="w-4 h-4 text-teal-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Activity Audit Timeline
              </h2>
            </div>

            <div className="relative pl-6 space-y-4 border-l-2 border-slate-100 ml-2">
              {complaint.timeline?.map((item, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-teal-600 border-2 border-white shadow-sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{item.action}</span>
                      <span className="text-[10px] text-slate-400">&bull; {formatKolkataDateTime(item.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{item.details}</p>
                    <p className="text-[10px] text-slate-400">By: {item.actor || 'Admin'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar: REP, Brand/Category, Servicer, Customer, Product Metadata */}
        <div className="space-y-6">
          {/* Representative (REP) Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Registered By (REP)
              </h2>
              <button
                onClick={() => setEditDetailsModalOpen(true)}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                Change
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Representative</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {complaint.representative?.name || complaint.representativeNameSnapshot || 'Not assigned'}
                  </span>
                </div>
              </div>

              {complaint.representative?.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{complaint.representative.phone}</span>
                </div>
              )}

              {complaint.representative?.email && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{complaint.representative.email}</span>
                </div>
              )}

              {complaint.shopName && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Shop Name</span>
                  <span className="font-semibold text-slate-800 text-xs">{complaint.shopName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Classification: Brand & Category Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Classification
              </h2>
              <button
                onClick={() => setEditDetailsModalOpen(true)}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                Change
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Brand</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {complaint.brand?.name || complaint.brandNameSnapshot || 'Not assigned'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
                <Folder className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Category</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {complaint.category?.name || complaint.categoryNameSnapshot || 'Not assigned'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Servicer Assignment Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Assigned Servicer
              </h2>
              <button
                onClick={() => setAssignModalOpen(true)}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                {complaint.assignedServicer ? 'Reassign' : 'Assign'}
              </button>
            </div>

            {complaint.assignedServicer ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 font-bold flex items-center justify-center">
                    {complaint.assignedServicer.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{complaint.assignedServicer.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{complaint.assignedServicer.phone}</p>
                  </div>
                </div>

                {complaint.assignedServicer.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{complaint.assignedServicer.email}</span>
                  </div>
                )}

                {complaint.assignedServicer.serviceArea && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{complaint.assignedServicer.serviceArea}</span>
                  </div>
                )}

                {complaint.scheduledServiceDate && (
                  <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100 text-xs">
                    <span className="font-semibold text-teal-900 block mb-0.5">Scheduled Date:</span>
                    <span className="text-teal-700 font-medium">
                      {formatKolkataDateTime(complaint.scheduledServiceDate)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <UserCheck className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold text-amber-800">Currently Unassigned</p>
                <p className="text-[11px] text-slate-500 mt-1 mb-3">
                  Assign a field servicer before proceeding to In Progress.
                </p>
                <button
                  onClick={() => setAssignModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Assign Servicer
                </button>
              </div>
            )}
          </div>

          {/* Customer Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              Customer Contact & Address
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 text-sm block">{complaint.customerName}</span>
                  <span className="text-slate-400">Area: {complaint.area}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-mono text-slate-700">{complaint.customerPhone}</span>
              </div>

              {complaint.alternatePhone && (
                <div className="flex items-center gap-2.5 text-slate-500 pl-6">
                  <span>Alt: {complaint.alternatePhone}</span>
                </div>
              )}

              {complaint.customerEmail && (
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-700 truncate">{complaint.customerEmail}</span>
                </div>
              )}

              <div className="flex items-start gap-2.5 pt-1 border-t border-slate-100">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-slate-700 whitespace-pre-wrap">{complaint.customerAddress}</span>
              </div>
            </div>
          </div>

          {/* Product Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              Product Information
            </h2>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block">Product:</span>
                <span className="font-semibold text-slate-800 text-sm">{complaint.productName}</span>
              </div>

              {complaint.modelNumber && (
                <div>
                  <span className="text-slate-400 block">Model Number:</span>
                  <span className="font-medium text-slate-700">{complaint.modelNumber}</span>
                </div>
              )}

              {complaint.serialNumber && (
                <div>
                  <span className="text-slate-400 block">Serial Number:</span>
                  <span className="font-mono text-slate-700">{complaint.serialNumber}</span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block">Warranty Status:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {complaint.warrantyStatus.replace('_', ' ')}
                </span>
              </div>

              {complaint.purchaseDate && (
                <div>
                  <span className="text-slate-400 block">Purchase Date:</span>
                  <span className="text-slate-700">{formatKolkataDate(complaint.purchaseDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL: Update Status --- */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update Complaint Status"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select New Status <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={statusForm.status}
              onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
            >
              <option value="Registered">Registered</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* If transitioning to Assigned or In Progress and not currently assigned */}
          {['Assigned', 'In Progress'].includes(statusForm.status) && !complaint.assignedServicer && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assign Servicer <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={statusForm.assignedServicer}
                onChange={(e) => setStatusForm({ ...statusForm, assignedServicer: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="">-- Choose Active Servicer --</option>
                {servicers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Resolution fields if Resolved or Closed */}
          {['Resolved', 'Closed'].includes(statusForm.status) && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Resolution Data (Required)
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={statusForm.resolutionNotes}
                  onChange={(e) => setStatusForm({ ...statusForm, resolutionNotes: e.target.value })}
                  placeholder="Detail how the issue was fixed and tested..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Performed
                </label>
                <textarea
                  rows={2}
                  value={statusForm.workPerformed}
                  onChange={(e) => setStatusForm({ ...statusForm, workPerformed: e.target.value })}
                  placeholder="Specific technical tasks executed..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Parts Replaced
                  </label>
                  <input
                    type="text"
                    value={statusForm.partsReplaced}
                    onChange={(e) => setStatusForm({ ...statusForm, partsReplaced: e.target.value })}
                    placeholder="e.g. Pump, Valve"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Service Charge (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={statusForm.serviceCharge}
                    onChange={(e) => setStatusForm({ ...statusForm, serviceCharge: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStatusModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingModal}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {isSubmittingModal ? 'Saving...' : 'Update Status'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL: Assign Servicer --- */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Field Servicer"
      >
        <form onSubmit={handleUpdateAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Field Servicer <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={assignForm.assignedServicer}
              onChange={(e) => setAssignForm({ ...assignForm, assignedServicer: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="">-- Choose Servicer --</option>
              {servicers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.phone}) {s.serviceArea ? `- ${s.serviceArea}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Scheduled Visit Date & Time
            </label>
            <input
              type="datetime-local"
              value={assignForm.scheduledServiceDate}
              onChange={(e) => setAssignForm({ ...assignForm, scheduledServiceDate: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAssignModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingModal}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {isSubmittingModal ? 'Saving...' : 'Save Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL: Edit Details --- */}
      <Modal
        isOpen={editDetailsModalOpen}
        onClose={() => setEditDetailsModalOpen(false)}
        title="Edit Complaint Information"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveDetails} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Read-only Complaint ID */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Complaint ID (Read-only)</label>
              <input
                type="text"
                disabled
                value={complaint.complaintNumber}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={editForm.customerName || ''}
                onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Shop Name</label>
              <input
                type="text"
                value={editForm.shopName || ''}
                onChange={(e) => setEditForm({ ...editForm, shopName: e.target.value })}
                placeholder="e.g. Modern Electronics / Dealer"
                maxLength={150}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Registered by (REP)</label>
              <select
                value={editForm.representative || ''}
                onChange={(e) => setEditForm({ ...editForm, representative: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              >
                <option value="">-- Not assigned --</option>
                {complaint.representative && !representatives.some(r => r._id === (complaint.representative._id || complaint.representative)) && (
                  <option value={complaint.representative._id || complaint.representative}>
                    {complaint.representative.name || complaint.representativeNameSnapshot} {!complaint.representative.isActive ? '(Inactive)' : ''}
                  </option>
                )}
                {representatives.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name} {!r.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand</label>
              <select
                value={editForm.brand || ''}
                onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              >
                <option value="">-- No Brand --</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} {!b.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={editForm.category || ''}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              >
                <option value="">-- No Category --</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {!c.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Phone</label>
              <input
                type="text"
                value={editForm.customerPhone || ''}
                onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alternate Phone</label>
              <input
                type="text"
                value={editForm.alternatePhone || ''}
                onChange={(e) => setEditForm({ ...editForm, alternatePhone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Email</label>
              <input
                type="email"
                value={editForm.customerEmail || ''}
                onChange={(e) => setEditForm({ ...editForm, customerEmail: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={editForm.priority || 'medium'}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Area / Location</label>
              <input
                type="text"
                value={editForm.area || ''}
                onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Address</label>
              <textarea
                rows={2}
                value={editForm.customerAddress || ''}
                onChange={(e) => setEditForm({ ...editForm, customerAddress: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Product Name</label>
              <input
                type="text"
                value={editForm.productName || ''}
                onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Warranty Status</label>
              <select
                value={editForm.warrantyStatus || 'unknown'}
                onChange={(e) => setEditForm({ ...editForm, warrantyStatus: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              >
                <option value="unknown">Unknown</option>
                <option value="in_warranty">In Warranty</option>
                <option value="out_of_warranty">Out of Warranty</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={editForm.subject || ''}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Detailed Description</label>
              <textarea
                rows={3}
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditDetailsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingModal}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {isSubmittingModal ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Attachment Confirmation */}
      <ConfirmModal
        isOpen={!!deleteAttachmentId}
        onClose={() => setDeleteAttachmentId(null)}
        onConfirm={handleDeleteAttachment}
        title="Remove Attachment"
        message="Are you sure you want to permanently delete this attachment file from storage?"
        confirmLabel="Delete File"
        isDestructive={true}
        isLoading={isSubmittingModal}
      />

      {/* Archive / Restore Confirmation */}
      <ConfirmModal
        isOpen={confirmArchiveOpen}
        onClose={() => setConfirmArchiveOpen(false)}
        onConfirm={handleToggleArchive}
        title={complaint.isArchived ? 'Restore Complaint' : 'Archive Complaint'}
        message={
          complaint.isArchived
            ? 'Restore this complaint record back to the active complaint register?'
            : 'Archive this complaint record? It will be hidden from active lists and standard PDF reports.'
        }
        confirmLabel={complaint.isArchived ? 'Restore' : 'Archive'}
        isDestructive={!complaint.isArchived}
        isLoading={isSubmittingModal}
      />

      {/* Reopen Complaint Confirmation */}
      <ConfirmModal
        isOpen={reopenConfirmOpen}
        onClose={() => setReopenConfirmOpen(false)}
        onConfirm={handleReopenTicket}
        title="Reopen Complaint Ticket"
        message={`Are you sure you want to reopen complaint ${complaint.complaintNumber}? It will be returned to the active complaints register in 'In Progress' status, and its service completion history will remain intact.`}
        confirmLabel="Reopen Ticket"
        isDestructive={false}
        isLoading={isSubmittingModal}
      />

      {/* Service Complaint Modal */}
      <ServiceComplaintModal
        isOpen={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        complaint={complaint}
        availableServicers={servicers}
        onSuccess={(updated) => {
          setComplaint(updated);
          fetchComplaint();
        }}
      />

      {/* Service Details Modal */}
      <ServiceDetailsModal
        isOpen={serviceDetailsModalOpen}
        onClose={() => setServiceDetailsModalOpen(false)}
        complaint={complaint}
        onDownloadPdf={handleDownloadPdf}
      />
    </div>
  );
}
