import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Wrench,
  CheckCircle,
  XCircle,
  Edit2,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function ServicersPage() {
  const toast = useToast();
  const [servicers, setServicers] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServicer, setEditingServicer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    serviceArea: '',
    specialization: '',
  });

  const fetchServicers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/servicers', {
        params: { search: search.trim() || undefined },
      });
      if (res.data?.success) {
        setServicers(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch servicers');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchServicers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchServicers]);

  const openAddModal = () => {
    setEditingServicer(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      serviceArea: '',
      specialization: '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (servicer) => {
    setEditingServicer(servicer);
    setFormData({
      name: servicer.name,
      phone: servicer.phone,
      email: servicer.email || '',
      serviceArea: servicer.serviceArea || '',
      specialization: servicer.specialization || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});

    try {
      if (editingServicer) {
        const res = await api.patch(`/servicers/${editingServicer._id}`, formData);
        if (res.data?.success) {
          toast.success('Servicer updated successfully');
          setModalOpen(false);
          fetchServicers();
        }
      } else {
        const res = await api.post('/servicers', formData);
        if (res.data?.success) {
          toast.success('Servicer added successfully');
          setModalOpen(false);
          fetchServicers();
        }
      }
    } catch (err) {
      const respData = err.response?.data?.error;
      if (respData?.details && typeof respData.details === 'object') {
        const mapped = {};
        if (Array.isArray(respData.details)) {
          respData.details.forEach(d => {
            if (d.path?.[0]) mapped[d.path[0]] = d.message;
          });
        }
        setFormErrors(mapped);
      }
      toast.error(respData?.message || 'Failed to save servicer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (servicer) => {
    try {
      const nextStatus = !servicer.isActive;
      const res = await api.patch(`/servicers/${servicer._id}/status`, { isActive: nextStatus });
      if (res.data?.success) {
        toast.success(`Servicer ${nextStatus ? 'activated' : 'deactivated'}`);
        fetchServicers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to change status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Field Servicers</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage service technicians, zone coverage, and active ticket allocations.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Servicer</span>
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
            placeholder="Search servicers by name, phone, area, specialty..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
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
          <button onClick={fetchServicers} className="font-semibold underline hover:text-rose-950">
            Retry
          </button>
        </div>
      )}

      {/* Servicer Grid */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12">
          <LoadingSpinner size="md" message="Loading servicers list..." />
        </div>
      ) : servicers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No servicers found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {search ? 'No servicers match your search term.' : 'No servicers added yet. Add technicians to handle assigned complaints.'}
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Servicer</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {servicers.map((s) => (
            <div
              key={s._id}
              className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 flex flex-col justify-between transition hover:shadow-md ${
                s.isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 font-bold flex items-center justify-center text-base">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-sm">{s.name}</h2>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          s.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20'
                        }`}
                      >
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-extrabold text-teal-600 block">
                      {s.activeComplaintsCount || 0}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">active tickets</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{s.phone}</span>
                  </div>

                  {s.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </div>
                  )}

                  {s.serviceArea && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{s.serviceArea}</span>
                    </div>
                  )}

                  {s.specialization && (
                    <div className="flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="italic">{s.specialization}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(s)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => handleToggleStatus(s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    s.isActive
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {s.isActive ? (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Deactivate</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Activate</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Servicer Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingServicer ? 'Edit Servicer' : 'Add New Servicer'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs transition ${
                formErrors.name ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
              }`}
            />
            {formErrors.name && <p className="text-[11px] text-rose-600 mt-1">{formErrors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. 9876543210"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs transition ${
                formErrors.phone ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
              }`}
            />
            {formErrors.phone && <p className="text-[11px] text-rose-600 mt-1">{formErrors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address (Optional)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="servicer@example.com"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Service Area / Zone (Optional)
            </label>
            <input
              type="text"
              value={formData.serviceArea}
              onChange={(e) => setFormData({ ...formData, serviceArea: e.target.value })}
              placeholder="e.g. South Bangalore, Indiranagar"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Specialization / Skills (Optional)
            </label>
            <input
              type="text"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="e.g. Commercial RO, Electrical"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingServicer ? 'Update Servicer' : 'Create Servicer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

