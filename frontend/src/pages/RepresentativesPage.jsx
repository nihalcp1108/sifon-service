import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Search,
  Plus,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Edit2,
  AlertCircle,
  Inbox,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function RepresentativesPage() {
  const toast = useToast();
  const [representatives, setRepresentatives] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRep, setEditingRep] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [repToDelete, setRepToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const fetchRepresentatives = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/representatives', {
        params: { search: search.trim() || undefined },
      });
      if (res.data?.success) {
        setRepresentatives(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch representatives');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRepresentatives();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchRepresentatives]);

  const openAddModal = () => {
    setEditingRep(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (rep) => {
    setEditingRep(rep);
    setFormData({
      name: rep.name || '',
      phone: rep.phone || '',
      email: rep.email || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});

    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
    };

    try {
      if (editingRep) {
        const res = await api.patch(`/representatives/${editingRep._id}`, payload);
        if (res.data?.success) {
          toast.success('Representative updated successfully');
          setModalOpen(false);
          fetchRepresentatives();
        }
      } else {
        const res = await api.post('/representatives', payload);
        if (res.data?.success) {
          toast.success('Representative added successfully');
          setModalOpen(false);
          fetchRepresentatives();
        }
      }
    } catch (err) {
      const respData = err.response?.data?.error;
      if (respData?.details && Array.isArray(respData.details)) {
        const mapped = {};
        respData.details.forEach((d) => {
          if (d.path?.[0]) mapped[d.path[0]] = d.message;
        });
        setFormErrors(mapped);
      }
      toast.error(respData?.message || 'Failed to save representative');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (rep) => {
    try {
      const nextStatus = !rep.isActive;
      const res = await api.patch(`/representatives/${rep._id}/status`, { isActive: nextStatus });
      if (res.data?.success) {
        toast.success(`Representative ${nextStatus ? 'activated' : 'deactivated'}`);
        fetchRepresentatives();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to change status');
    }
  };

  const confirmDelete = (rep) => {
    setRepToDelete(rep);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!repToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/representatives/${repToDelete._id}`);
      if (res.data?.success) {
        toast.success('Representative deleted successfully');
        setDeleteModalOpen(false);
        setRepToDelete(null);
        fetchRepresentatives();
      }
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || 'Failed to delete representative';
      toast.error(errMsg);
      setDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Representatives (REP)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage representatives who brought in or registered customer complaints.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add New REP</span>
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
            placeholder="Search representatives by name, phone, email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchRepresentatives} className="font-semibold underline hover:text-rose-950">
            Retry
          </button>
        </div>
      )}

      {/* List / Table */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12">
          <LoadingSpinner size="md" message="Loading representatives list..." />
        </div>
      ) : representatives.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No representatives found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {search
              ? 'No representatives match your search criteria.'
              : 'Add representatives who bring in complaints so they can be attributed during registration.'}
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Representative</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Representative</th>
                  <th className="py-3.5 px-4">Contact Details</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Active Complaints</th>
                  <th className="py-3.5 px-4 text-center">Completed Complaints</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {representatives.map((rep) => {
                  const activeCount = rep.activeComplaintsCount || 0;
                  const completedCount = rep.completedComplaintsCount || 0;

                  return (
                    <tr
                      key={rep._id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !rep.isActive ? 'bg-slate-50/40 text-slate-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                              rep.isActive
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {rep.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{rep.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {rep._id.slice(-6)}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {rep.phone ? (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{rep.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No phone</span>
                          )}
                          {rep.email ? (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{rep.email}</span>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            rep.isActive
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                              : 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20'
                          }`}
                        >
                          {rep.isActive ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-400" />
                              <span>Inactive</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Link
                          to={`/complaints?representative=${rep._id}`}
                          title={`View ${activeCount} active complaints for ${rep.name}`}
                          className={`inline-flex items-center gap-1 font-semibold px-2.5 py-1 rounded-lg text-xs transition ${
                            activeCount > 0
                              ? 'bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          <span>{activeCount}</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Link
                          to={`/complaints/completed?representative=${rep._id}`}
                          title={`View ${completedCount} completed complaints for ${rep.name}`}
                          className={`inline-flex items-center gap-1 font-semibold px-2.5 py-1 rounded-lg text-xs transition ${
                            completedCount > 0
                              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          <span>{completedCount}</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(rep)}
                            className="p-1.5 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                            title="Edit Representative"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(rep)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                              rep.isActive
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                            title={rep.isActive ? 'Deactivate REP' : 'Activate REP'}
                          >
                            {rep.isActive ? 'Deactivate' : 'Activate'}
                          </button>

                          <button
                            onClick={() => confirmDelete(rep)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Representative"
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
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !isSubmitting && setModalOpen(false)}
        title={editingRep ? 'Edit Representative' : 'Add New Representative'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Representative Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Rahul Sharma"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 ${
                formErrors.name ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-teal-500'
              }`}
            />
            {formErrors.name && (
              <p className="text-rose-500 text-[11px] mt-1">{formErrors.name}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Representatives with the same name are supported and distinguished by contact details and system IDs.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. +91 9876543210"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 ${
                formErrors.phone ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-teal-500'
              }`}
            />
            {formErrors.phone && (
              <p className="text-rose-500 text-[11px] mt-1">{formErrors.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. rahul@example.com"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 ${
                formErrors.email ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-teal-500'
              }`}
            />
            {formErrors.email && (
              <p className="text-rose-500 text-[11px] mt-1">{formErrors.email}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition shadow-sm flex items-center gap-2"
            >
              {isSubmitting && <LoadingSpinner size="sm" />}
              <span>{editingRep ? 'Save Changes' : 'Create Representative'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !isDeleting && setDeleteModalOpen(false)}
        title="Delete Representative"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to delete representative{' '}
            <strong className="text-slate-900">{repToDelete?.name}</strong>?
          </p>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
            <strong>Note:</strong> Representatives referenced by any complaints cannot be deleted. If this representative has historical records, deactivate them instead to preserve reporting integrity.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition shadow-sm flex items-center gap-2"
            >
              {isDeleting && <LoadingSpinner size="sm" />}
              <span>Delete REP</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default RepresentativesPage;

