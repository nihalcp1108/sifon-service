import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Tag,
  Search,
  Plus,
  Download,
  Eye,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Inbox,
  FileDown,
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function BrandsPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brandForm, setBrandForm] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');

  const fetchBrands = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/brands', {
        params: { search: search.trim() || undefined },
      });
      if (res.data?.success) {
        setBrands(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch brands');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBrands();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchBrands]);

  const openCreateModal = () => {
    setEditingBrand(null);
    setBrandForm({ name: '', description: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (b) => {
    setEditingBrand(b);
    setBrandForm({ name: b.name, description: b.description || '' });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      if (editingBrand) {
        const res = await api.patch(`/brands/${editingBrand._id}`, brandForm);
        if (res.data?.success) {
          toast.success('Brand updated successfully');
          setModalOpen(false);
          fetchBrands();
        }
      } else {
        const res = await api.post('/brands', brandForm);
        if (res.data?.success) {
          toast.success('Brand created successfully');
          setModalOpen(false);
          fetchBrands();
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.error?.message || 'Failed to save brand');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (brand) => {
    try {
      const res = await api.patch(`/brands/${brand._id}/status`);
      if (res.data?.success) {
        toast.success(res.data.message);
        fetchBrands();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update brand status');
    }
  };

  const handleDownloadBrandPdf = async (brand) => {
    try {
      toast.info(`Preparing PDF report for brand ${brand.name}...`);
      const res = await api.get(`/brands/${brand._id}/complaints/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = brand.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `sifon-service-brand-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Brand PDF downloaded');
    } catch (err) {
      toast.error('Failed to download brand PDF report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Brand Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain authorized customer brands and view associated service complaint tickets.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Brand</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands by name or description..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchBrands} className="font-semibold underline hover:text-rose-950">
            Retry
          </button>
        </div>
      )}

      {/* Main Table */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12">
          <LoadingSpinner size="md" message="Loading brands..." />
        </div>
      ) : brands.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No brands registered</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {search ? 'No brands match your search.' : 'Create your first brand to start tagging customer complaints.'}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Brand</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Brand Name</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Complaints Count</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brands.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{b.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {b.description || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20'
                        }`}
                      >
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800">{b.complaintsCount}</span>
                      <span className="text-slate-400 text-[11px] ml-1">tickets</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View Complaints Button */}
                        <Link
                          to={`/complaints?brand=${b._id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                          title="View complaints for this brand"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Complaints</span>
                        </Link>

                        {/* Download PDF Button */}
                        <button
                          onClick={() => handleDownloadBrandPdf(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-lg text-xs font-semibold transition"
                          title="Download Brand Complaints PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(b)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                          title="Edit Brand"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Activate / Deactivate Toggle */}
                        <button
                          onClick={() => handleToggleStatus(b)}
                          className={`p-1.5 rounded-lg transition ${
                            b.isActive
                              ? 'text-rose-500 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={b.isActive ? 'Deactivate Brand' : 'Activate Brand'}
                        >
                          {b.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBrand ? 'Edit Brand' : 'Add New Brand'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
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
              value={brandForm.name}
              onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
              placeholder="e.g. Aquafresh, Kent, Pureit"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={brandForm.description}
              onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
              placeholder="Optional notes or manufacturer details..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !brandForm.name.trim()}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingBrand ? 'Save Changes' : 'Create Brand'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

