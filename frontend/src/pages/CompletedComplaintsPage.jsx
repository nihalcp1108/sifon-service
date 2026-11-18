import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Search,
  Filter,
  Download,
  Eye,
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
  FileDown,
  Wrench,
  Trash2,
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ServiceDetailsModal } from '../components/ServiceDetailsModal';
import {
  formatKolkataDate,
  formatKolkataDateTime,
  formatCurrencyINR,
  getStatusBadgeClass,
  getStatusDisplayLabel,
} from '../utils/formatters';

export function CompletedComplaintsPage() {
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

  // Filters State
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [servicer, setServicer] = useState(searchParams.get('servicer') || 'all');
  const [representative, setRepresentative] = useState(searchParams.get('representative') || 'all');
  const [brand, setBrand] = useState(searchParams.get('brand') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [completedStartDate, setCompletedStartDate] = useState(searchParams.get('completedStartDate') || '');
  const [completedEndDate, setCompletedEndDate] = useState(searchParams.get('completedEndDate') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'resolution.completedDate');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  // Modals & Export
  const [selectedServiceComplaint, setSelectedServiceComplaint] = useState(null);
  const [deleteComplaintData, setDeleteComplaintData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch filter dropdown options
  useEffect(() => {
    api.get('/servicers')
      .then((res) => {
        if (res.data?.success) setServicers(res.data.data);
      })
      .catch(() => { });

    api.get('/representatives')
      .then((res) => {
        if (res.data?.success) setRepresentatives(res.data.data);
      })
      .catch(() => { });

    api.get('/brands')
      .then((res) => {
        if (res.data?.success) setBrands(res.data.data);
      })
      .catch(() => { });

    api.get('/categories')
      .then((res) => {
        if (res.data?.success) setCategories(res.data.data);
      })
      .catch(() => { });
  }, []);

  // Update query params in URL
  const updateUrlParams = useCallback((newParams) => {
    const params = new URLSearchParams();
    if (newParams.search) params.set('search', newParams.search);
    if (newParams.servicer && newParams.servicer !== 'all') params.set('servicer', newParams.servicer);
    if (newParams.representative && newParams.representative !== 'all') params.set('representative', newParams.representative);
    if (newParams.brand && newParams.brand !== 'all') params.set('brand', newParams.brand);
    if (newParams.category && newParams.category !== 'all') params.set('category', newParams.category);
    if (newParams.completedStartDate) params.set('completedStartDate', newParams.completedStartDate);
    if (newParams.completedEndDate) params.set('completedEndDate', newParams.completedEndDate);
    if (newParams.sortBy) params.set('sortBy', newParams.sortBy);
    if (newParams.sortOrder) params.set('sortOrder', newParams.sortOrder);
    if (newParams.page && newParams.page > 1) params.set('page', String(newParams.page));
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Fetch completed complaints list
  const fetchCompletedComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        completedOnly: 'true',
        page,
        limit: 10,
        sortBy,
        sortOrder,
      };

      if (search.trim()) params.search = search.trim();
      if (servicer !== 'all') params.servicer = servicer;
      if (representative !== 'all') params.representative = representative;
      if (brand !== 'all') params.brand = brand;
      if (category !== 'all') params.category = category;
      if (completedStartDate) params.completedStartDate = completedStartDate;
      if (completedEndDate) params.completedEndDate = completedEndDate;

      const res = await api.get('/complaints', { params });
      if (res.data?.success) {
        setComplaints(res.data.data.complaints || []);
        setPagination(res.data.data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load completed complaints records');
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortOrder, search, servicer, representative, brand, category, completedStartDate, completedEndDate]);

  useEffect(() => {
    fetchCompletedComplaints();
  }, [fetchCompletedComplaints]);

  // Synchronize immediately when service is completed or reopened elsewhere
  useEffect(() => {
    const handleStatusChanged = () => {
      fetchCompletedComplaints();
    };
    window.addEventListener('complaint-status-changed', handleStatusChanged);
    return () => window.removeEventListener('complaint-status-changed', handleStatusChanged);
  }, [fetchCompletedComplaints]);

  // Handle Search Submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    updateUrlParams({
      search,
      servicer,
      representative,
      brand,
      category,
      completedStartDate,
      completedEndDate,
      sortBy,
      sortOrder,
      page: 1,
    });
  };

  // Handle Clear Filters
  const handleClearFilters = () => {
    setSearch('');
    setServicer('all');
    setRepresentative('all');
    setBrand('all');
    setCategory('all');
    setCompletedStartDate('');
    setCompletedEndDate('');
    setSortBy('resolution.completedDate');
    setSortOrder('desc');
    setPage(1);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // Download Single Complaint PDF
  const handleDownloadSinglePdf = async (complaintId, complaintNumber) => {
    try {
      const res = await api.get(`/complaints/${complaintId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `sifon-service-complaint-${complaintNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`PDF downloaded for complaint ${complaintNumber}`);
    } catch {
      toast.error('Failed to download complaint PDF');
    }
  };

  // Delete complaint
  const handleDelete = async () => {
    if (!deleteComplaintData) return;
    try {
      setIsDeleting(true);
      const res = await api.delete(`/complaints/${deleteComplaintData.id}`);
      if (res.data?.success) {
        toast.success(`Complaint ${deleteComplaintData.complaintNumber} deleted successfully`);
        setDeleteComplaintData(null);
        fetchComplaints();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete complaint');
    } finally {
      setIsDeleting(false);
    }
  };

  // Download Completed Complaints PDF (Filtered or All)
  const handleExportPdf = async (exportAll = false) => {
    setIsExporting(true);
    try {
      const params = {
        completedOnly: 'true',
      };

      if (exportAll) {
        params.exportAll = 'true';
      } else {
        if (search.trim()) params.search = search.trim();
        if (servicer !== 'all') params.servicer = servicer;
        if (representative !== 'all') params.representative = representative;
        if (brand !== 'all') params.brand = brand;
        if (category !== 'all') params.category = category;
        if (completedStartDate) params.completedStartDate = completedStartDate;
        if (completedEndDate) params.completedEndDate = completedEndDate;
      }

      const res = await api.get('/complaints/export/pdf', {
        params,
        responseType: 'blob',
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = exportAll
        ? `sifon-service-all-completed-complaints-${dateStr}.pdf`
        : `sifon-service-filtered-completed-complaints-${dateStr}.pdf`;

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(exportAll ? 'All completed complaints PDF downloaded' : 'Filtered completed complaints PDF downloaded');
    } catch {
      toast.error('Failed to export completed complaints PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const hasActiveFilters = Boolean(
    search ||
    servicer !== 'all' ||
    representative !== 'all' ||
    brand !== 'all' ||
    category !== 'all' ||
    completedStartDate ||
    completedEndDate
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Completed Complaints
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {pagination.total} Records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Historical log of all resolved service tickets, servicer completion reports, and charges.
          </p>
        </div>

        {/* PDF Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportPdf(true)}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
            title="Download PDF report of all completed complaints"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Download All Completed PDF</span>
          </button>

          <button
            onClick={() => handleExportPdf(false)}
            disabled={isExporting || pagination.total === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
            title="Download PDF report matching current filters"
          >
            <FileDown className="w-4 h-4" />
            <span>Download Filtered Completed PDF</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by REG NO, customer name, phone, or servicer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition shadow-sm shrink-0"
          >
            Search
          </button>
        </form>

        {/* Filter Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Servicer filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Serviced By
            </label>
            <select
              value={servicer}
              onChange={(e) => {
                setServicer(e.target.value);
                setPage(1);
                updateUrlParams({
                  search,
                  servicer: e.target.value,
                  representative,
                  brand,
                  category,
                  completedStartDate,
                  completedEndDate,
                  sortBy,
                  sortOrder,
                  page: 1,
                });
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium"
            >
              <option value="all">All Servicers</option>
              {servicers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Representative filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Registered By (REP)
            </label>
            <select
              value={representative}
              onChange={(e) => {
                setRepresentative(e.target.value);
                setPage(1);
                updateUrlParams({
                  search,
                  servicer,
                  representative: e.target.value,
                  brand,
                  category,
                  completedStartDate,
                  completedEndDate,
                  sortBy,
                  sortOrder,
                  page: 1,
                });
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium"
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

          {/* Brand filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Brand
            </label>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setPage(1);
                updateUrlParams({
                  search,
                  servicer,
                  representative,
                  brand: e.target.value,
                  category,
                  completedStartDate,
                  completedEndDate,
                  sortBy,
                  sortOrder,
                  page: 1,
                });
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
                updateUrlParams({
                  search,
                  servicer,
                  representative,
                  brand,
                  category: e.target.value,
                  completedStartDate,
                  completedEndDate,
                  sortBy,
                  sortOrder,
                  page: 1,
                });
              }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Completed Date Range */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Completed Date Range
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={completedStartDate}
                onChange={(e) => {
                  setCompletedStartDate(e.target.value);
                  setPage(1);
                  updateUrlParams({
                    search,
                    servicer,
                    representative,
                    brand,
                    category,
                    completedStartDate: e.target.value,
                    completedEndDate,
                    sortBy,
                    sortOrder,
                    page: 1,
                  });
                }}
                className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700"
                title="Start date"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="date"
                value={completedEndDate}
                onChange={(e) => {
                  setCompletedEndDate(e.target.value);
                  setPage(1);
                  updateUrlParams({
                    search,
                    servicer,
                    representative,
                    brand,
                    category,
                    completedStartDate,
                    completedEndDate: e.target.value,
                    sortBy,
                    sortOrder,
                    page: 1,
                  });
                }}
                className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700"
                title="End date"
              />
            </div>
          </div>
        </div>

        {/* Active Filters Clear Row */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 text-[11px]">
              Showing filtered completed records
            </span>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchCompletedComplaints}
            className="font-semibold underline hover:text-rose-950"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table Content */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12">
          <LoadingSpinner size="md" message="Loading completed complaints..." />
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">
            No completed complaints found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {hasActiveFilters
              ? 'No completed records match your search and filter criteria.'
              : 'There are currently no completed service complaints in the register.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">REG NO</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Brand / Cat</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">REP</th>
                  <th className="py-3 px-4">Serviced By</th>
                  <th className="py-3 px-4">Reg Date</th>
                  <th className="py-3 px-4">Completed Date</th>
                  <th className="py-3 px-4">Charge</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((c) => {
                  const brandDisplay = c.brand?.name || c.brandNameSnapshot || '-';
                  const categoryDisplay = c.category?.name || c.categoryNameSnapshot || '-';
                  const repDisplay = c.representative?.name || c.representativeNameSnapshot || 'Not assigned';
                  const servicerDisplay = c.assignedServicer?.name || c.servicerNameSnapshot || 'Not recorded';
                  const compDateFormatted = c.resolution?.completedDate
                    ? formatKolkataDate(c.resolution.completedDate)
                    : 'Not recorded';

                  return (
                    <tr key={c._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <Link
                          to={`/complaints/${c._id}`}
                          className="hover:text-teal-600 hover:underline"
                        >
                          {c.complaintNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-medium whitespace-nowrap">
                        {c.customerName}
                      </td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap text-slate-700">
                        <span>{c.customerPhone}</span>
                        {c.alternatePhone && (
                          <span className="text-slate-400 text-xs ml-1.5 font-normal">
                            / {c.alternatePhone}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <span className="font-medium text-slate-700">{brandDisplay}</span>
                        <span className="text-slate-400"> / {categoryDisplay}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-[130px] truncate" title={c.productName}>
                        {c.productName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {c.representative?.name || c.representativeNameSnapshot ? (
                          <span className="font-medium text-slate-800">{repDisplay}</span>
                        ) : (
                          <span className="text-slate-400 italic">Not assigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="font-medium">{servicerDisplay}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {formatKolkataDate(c.complaintDate)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-medium whitespace-nowrap">
                        {compDateFormatted}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-800 whitespace-nowrap">
                        {formatCurrencyINR(c.resolution?.serviceCharge || 0)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass('Resolved')}`}>
                          Completed
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedServiceComplaint(c)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="View Service Details"
                          >
                            <Wrench className="w-4 h-4" />
                          </button>
                          <Link
                            to={`/complaints/${c._id}`}
                            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDownloadSinglePdf(c._id, c.complaintNumber)}
                            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition"
                            title="Download Complaint PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteComplaintData({ id: c._id, complaintNumber: c.complaintNumber })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Complaint"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              of <span className="font-semibold text-slate-700">{pagination.total}</span> completed records
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  const newPage = page - 1;
                  setPage(newPage);
                  updateUrlParams({
                    search,
                    servicer,
                    brand,
                    category,
                    completedStartDate,
                    completedEndDate,
                    sortBy,
                    sortOrder,
                    page: newPage,
                  });
                }}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-medium text-slate-700">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  updateUrlParams({
                    search,
                    servicer,
                    brand,
                    category,
                    completedStartDate,
                    completedEndDate,
                    sortBy,
                    sortOrder,
                    page: newPage,
                  });
                }}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Details Modal */}
      <ServiceDetailsModal
        isOpen={Boolean(selectedServiceComplaint)}
        onClose={() => setSelectedServiceComplaint(null)}
        complaint={selectedServiceComplaint}
        onDownloadPdf={handleDownloadSinglePdf}
      />

      {/* Confirmation Modal for Deleting */}
      <ConfirmModal
        isOpen={!!deleteComplaintData}
        onClose={() => setDeleteComplaintData(null)}
        onConfirm={handleDelete}
        title="Delete Complaint"
        message={`Are you sure you want to permanently delete complaint ${deleteComplaintData?.complaintNumber}? This action cannot be undone.`}
        confirmLabel="Delete Record"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
}

export default CompletedComplaintsPage;

