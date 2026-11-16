import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Download,
  FileDown,
  Archive,
  RotateCcw,
  Eye,
  PlusCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  AlertTriangle,
  Inbox,
  UserCheck,
  Tag,
  Folder,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ServiceComplaintModal } from '../components/ServiceComplaintModal';
import { ServiceDetailsModal } from '../components/ServiceDetailsModal';
import {
  formatKolkataDate,
  getStatusBadgeClass,
  getPriorityBadgeClass,
  getStatusDisplayLabel,
} from '../utils/formatters';

export function ComplaintsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const [complaints, setComplaints] = useState([]);
  const [servicers, setServicers] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals for Service Completion & View Details
  const [serviceModalComplaint, setServiceModalComplaint] = useState(null);
  const [serviceDetailsComplaint, setServiceDetailsComplaint] = useState(null);

  // Filters State from URL search params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [priority, setPriority] = useState(searchParams.get('priority') || 'all');
  const [servicer, setServicer] = useState(searchParams.get('servicer') || 'all');
  const [representative, setRepresentative] = useState(searchParams.get('representative') || 'all');
  const [brand, setBrand] = useState(searchParams.get('brand') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [area, setArea] = useState(searchParams.get('area') || '');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [isArchived, setIsArchived] = useState(searchParams.get('isArchived') === 'true');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'complaintDate');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  // Modals
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch dropdown filter options
  useEffect(() => {
    api.get('/servicers')
      .then((res) => {
        if (res.data?.success) setServicers(res.data.data);
      })
      .catch(() => {});

    api.get('/representatives')
      .then((res) => {
        if (res.data?.success) setRepresentatives(res.data.data);
      })
      .catch(() => {});

    api.get('/brands')
      .then((res) => {
        if (res.data?.success) setBrands(res.data.data);
      })
      .catch(() => {});

    api.get('/categories')
      .then((res) => {
        if (res.data?.success) setCategories(res.data.data);
      })
      .catch(() => {});
  }, []);

  // Update query params in URL
  const updateUrlParams = useCallback((newParams) => {
    const params = new URLSearchParams();
    if (newParams.search) params.set('search', newParams.search);
    if (newParams.status && newParams.status !== 'all') params.set('status', newParams.status);
    if (newParams.priority && newParams.priority !== 'all') params.set('priority', newParams.priority);
    if (newParams.servicer && newParams.servicer !== 'all') params.set('servicer', newParams.servicer);
    if (newParams.representative && newParams.representative !== 'all') params.set('representative', newParams.representative);
    if (newParams.brand && newParams.brand !== 'all') params.set('brand', newParams.brand);
    if (newParams.category && newParams.category !== 'all') params.set('category', newParams.category);
    if (newParams.area) params.set('area', newParams.area);
    if (newParams.startDate) params.set('startDate', newParams.startDate);
    if (newParams.endDate) params.set('endDate', newParams.endDate);
    if (newParams.isArchived) params.set('isArchived', 'true');
    if (newParams.sortBy) params.set('sortBy', newParams.sortBy);
    if (newParams.sortOrder) params.set('sortOrder', newParams.sortOrder);
    if (newParams.page > 1) params.set('page', String(newParams.page));
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Fetch complaints
  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 10,
        search: search.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        priority: priority !== 'all' ? priority : undefined,
        servicer: servicer !== 'all' ? servicer : undefined,
        representative: representative !== 'all' ? representative : undefined,
        brand: brand !== 'all' ? brand : undefined,
        category: category !== 'all' ? category : undefined,
        area: area.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        isArchived: isArchived ? 'true' : 'false',
        sortBy,
        sortOrder,
      };

      const res = await api.get('/complaints', { params });
      if (res.data?.success) {
        setComplaints(res.data.data.complaints);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch complaints');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status, priority, servicer, representative, brand, category, area, startDate, endDate, isArchived, sortBy, sortOrder]);

  useEffect(() => {
    fetchComplaints();
    updateUrlParams({ search, status, priority, servicer, representative, brand, category, area, startDate, endDate, isArchived, sortBy, sortOrder, page });
  }, [fetchComplaints, updateUrlParams, search, status, priority, servicer, representative, brand, category, area, startDate, endDate, isArchived, sortBy, sortOrder, page]);

  // Synchronize immediately when service is completed or status changes without reloading browser
  useEffect(() => {
    const handleStatusChanged = () => {
      fetchComplaints();
    };
    window.addEventListener('complaint-status-changed', handleStatusChanged);
    return () => window.removeEventListener('complaint-status-changed', handleStatusChanged);
  }, [fetchComplaints]);

  // Clear filters
  const handleClearFilters = () => {
    setSearch('');
    setStatus('all');
    setPriority('all');
    setServicer('all');
    setRepresentative('all');
    setBrand('all');
    setCategory('all');
    setArea('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Archive complaint
  const handleArchive = async () => {
    if (!confirmArchiveId) return;
    setIsProcessingAction(true);
    try {
      const res = await api.patch(`/complaints/${confirmArchiveId}/archive`);
      if (res.data?.success) {
        toast.success('Complaint archived');
        setConfirmArchiveId(null);
        fetchComplaints();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to archive complaint');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Restore complaint
  const handleRestore = async (id) => {
    try {
      const res = await api.patch(`/complaints/${id}/restore`);
      if (res.data?.success) {
        toast.success('Complaint restored');
        fetchComplaints();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to restore complaint');
    }
  };

  // Download Individual PDF
  const handleDownloadSinglePdf = async (id, number) => {
    try {
      toast.info(`Preparing PDF for complaint ${number}...`);
      const res = await api.get(`/complaints/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeId = String(number).replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `sifon-service-complaint-${safeId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  // Export PDF Report (All or Filtered)
  const handleExportReport = async (exportAll = false) => {
    setIsExporting(true);
    try {
      toast.info(exportAll ? 'Exporting all active complaints...' : 'Exporting filtered active complaints...');
      const params = exportAll
        ? { exportAll: 'true' }
        : {
            search: search.trim() || undefined,
            status: status !== 'all' ? status : undefined,
            priority: priority !== 'all' ? priority : undefined,
            servicer: servicer !== 'all' ? servicer : undefined,
            representative: representative !== 'all' ? representative : undefined,
            brand: brand !== 'all' ? brand : undefined,
            category: category !== 'all' ? category : undefined,
            area: area.trim() || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            isArchived: isArchived ? 'true' : 'false',
          };

      const res = await api.get('/complaints/export/pdf', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = exportAll
        ? `sifon-service-all-active-complaints-${dateStr}.pdf`
        : `sifon-service-filtered-active-complaints-${dateStr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to export PDF report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isArchived ? 'Archived Complaints' : 'Active Complaints Register'}
            </h1>
            <button
              onClick={() => {
                setIsArchived(!isArchived);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition ${
                isArchived
                  ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isArchived ? '← Back to Active' : 'View Archived'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {pagination.total} matching active complaint{pagination.total !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportReport(false)}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Download Filtered Active PDF</span>
          </button>

          <button
            onClick={() => handleExportReport(true)}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-xl text-xs font-semibold transition shadow-sm disabled:opacity-50"
          >
            <FileDown className="w-4 h-4 text-teal-600" />
            <span>Download All Active PDF</span>
          </button>

          <Link
            to="/complaints/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Complaint</span>
          </Link>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        {/* Row 1: Search, Status, Priority, Servicer, Brand, Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search Bar */}
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search complaint ID, customer, phone, brand..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            >
              <option value="all">All Active Statuses</option>
              <option value="Registered">Registered</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Brand Filter */}
          <div>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} {!b.isActive ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {!c.isActive ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Servicer, Area, Date Range & Clear */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Servicer Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Servicer:</span>
              <select
                value={servicer}
                onChange={(e) => {
                  setServicer(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-teal-500"
              >
                <option value="all">All Servicers</option>
                <option value="unassigned">Unassigned Only</option>
                {servicers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} {!s.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Representative (REP) Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">REP:</span>
              <select
                value={representative}
                onChange={(e) => {
                  setRepresentative(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-teal-500"
              >
                <option value="all">All REPs</option>
                <option value="unassigned">Not assigned</option>
                {representatives.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name} {!r.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Area:</span>
              <input
                type="text"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. Indiranagar"
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-32 focus:bg-white focus:border-teal-500 transition"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-teal-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Toggle */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split(':');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white"
              >
                <option value="complaintDate:desc">Newest First</option>
                <option value="complaintDate:asc">Oldest First</option>
                <option value="complaintNumber:desc">Complaint # (Z-A)</option>
                <option value="complaintNumber:asc">Complaint # (A-Z)</option>
                <option value="customerName:asc">Customer Name (A-Z)</option>
              </select>
            </div>

            {(search || status !== 'all' || priority !== 'all' || servicer !== 'all' || representative !== 'all' || brand !== 'all' || category !== 'all' || area || startDate || endDate) && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition font-medium"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchComplaints}
            className="font-semibold underline hover:text-rose-950"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Complaints Content */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12">
          <LoadingSpinner size="md" message="Loading complaint records..." />
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No complaints found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {search || status !== 'all' || priority !== 'all' || brand !== 'all' || category !== 'all'
              ? 'No complaint records match your current search and filter criteria.'
              : 'The complaint register is currently empty. Register your first customer complaint to begin.'}
          </p>
          {(search || status !== 'all' || priority !== 'all' || servicer !== 'all' || brand !== 'all' || category !== 'all' || area) ? (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Reset Filters
            </button>
          ) : (
            <Link
              to="/complaints/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register Complaint</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Brand / Cat</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4">REP</th>
                  <th className="py-3 px-4">Servicer</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-teal-700 whitespace-nowrap">
                      <Link to={`/complaints/${c._id}`} className="hover:underline">
                        {c.complaintNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {formatKolkataDate(c.complaintDate)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {c.customerName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {c.customerPhone}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                          <Tag className="w-3 h-3 text-teal-600 shrink-0" />
                          <span>{c.brand?.name || c.brandNameSnapshot || 'Not assigned'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <Folder className="w-2.5 h-2.5 shrink-0" />
                          <span>{c.category?.name || c.categoryNameSnapshot || 'Not assigned'}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-[130px] truncate" title={c.productName}>
                      {c.productName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {c.area}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {c.representative?.name || c.representativeNameSnapshot ? (
                        <span className="font-medium text-slate-800">
                          {c.representative?.name || c.representativeNameSnapshot}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not assigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {c.assignedServicer?.name || c.servicerNameSnapshot ? (
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="font-medium">{c.assignedServicer?.name || c.servicerNameSnapshot}</span>
                        </div>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPriorityBadgeClass(c.priority)}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(c.status)}`}>
                        {getStatusDisplayLabel(c.status)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isArchived && c.status !== 'Cancelled' && (
                          ['Resolved', 'Closed'].includes(c.status) ? (
                            <button
                              type="button"
                              onClick={() => setServiceDetailsComplaint(c)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title="View Service Details"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setServiceModalComplaint(c)}
                              className="p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                              title="Service Complaint"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          )
                        )}
                        <Link
                          to={`/complaints/${c._id}`}
                          className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDownloadSinglePdf(c._id, c.complaintNumber)}
                          className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition"
                          title="Download Complaint PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {isArchived ? (
                          <button
                            onClick={() => handleRestore(c._id)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                            title="Restore Complaint"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmArchiveId(c._id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                            title="Archive Complaint"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{(page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-700">
                {Math.min(page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-slate-700">{pagination.total}</span> complaints
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
                Page {page} of {pagination.totalPages}
              </span>

              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Archiving */}
      <ConfirmModal
        isOpen={!!confirmArchiveId}
        onClose={() => setConfirmArchiveId(null)}
        onConfirm={handleArchive}
        title="Archive Complaint"
        message="Are you sure you want to archive this complaint? It will be hidden from the active register and reports, but can be restored at any time."
        confirmLabel="Archive Record"
        isDestructive={true}
        isLoading={isProcessingAction}
      />

      {/* Service Complaint Modal */}
      <ServiceComplaintModal
        isOpen={Boolean(serviceModalComplaint)}
        onClose={() => setServiceModalComplaint(null)}
        complaint={serviceModalComplaint}
        availableServicers={servicers}
        onSuccess={() => {
          fetchComplaints();
        }}
      />

      {/* Service Details Modal */}
      <ServiceDetailsModal
        isOpen={Boolean(serviceDetailsComplaint)}
        onClose={() => setServiceDetailsComplaint(null)}
        complaint={serviceDetailsComplaint}
        onDownloadPdf={handleDownloadSinglePdf}
      />
    </div>
  );
}
