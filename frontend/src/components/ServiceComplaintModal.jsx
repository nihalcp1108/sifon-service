import React, { useState, useEffect } from 'react';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Calendar,
  IndianRupee,
  Layers,
  Phone,
  User,
  PlusCircle,
  X,
  Search,
  FileText,
} from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { useToast } from './Toast';

export function ServiceComplaintModal({
  isOpen,
  onClose,
  complaint,
  onSuccess,
  availableServicers = [],
}) {
  const toast = useToast();

  const [servicersList, setServicersList] = useState(availableServicers);
  const [servicerSearch, setServicerSearch] = useState('');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPhone, setQuickAddPhone] = useState('');
  const [isCreatingServicer, setIsCreatingServicer] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  // Service Completion Form State (retained on validation/server error)
  const [form, setForm] = useState({
    assignedServicer: '',
    completedDate: new Date().toISOString().slice(0, 10),
    workPerformed: '',
    resolutionNotes: '',
    partsReplaced: '',
    serviceCharge: 0,
    additionalNotes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Synchronize available servicers or fetch if empty
  useEffect(() => {
    if (availableServicers && availableServicers.length > 0) {
      setServicersList(availableServicers);
    } else if (isOpen) {
      api.get('/servicers')
        .then((res) => {
          if (res.data?.success) {
            setServicersList(res.data.data || []);
          }
        })
        .catch(() => {});
    }
  }, [availableServicers, isOpen]);

  // Preselect assigned servicer when opening modal
  useEffect(() => {
    if (isOpen && complaint) {
      const currentServicerId =
        complaint.assignedServicer?._id ||
        (typeof complaint.assignedServicer === 'string' ? complaint.assignedServicer : '');

      setForm((prev) => ({
        ...prev,
        assignedServicer: currentServicerId || prev.assignedServicer,
        completedDate: prev.completedDate || new Date().toISOString().slice(0, 10),
      }));
      setServerError('');
      setQuickAddError('');
      setIsQuickAddOpen(false);
    }
  }, [isOpen, complaint]);

  if (!isOpen || !complaint) return null;

  const activeServicers = servicersList.filter((s) => s.isActive !== false);

  const filteredServicers = activeServicers.filter((s) =>
    (s.name || '').toLowerCase().includes(servicerSearch.toLowerCase()) ||
    (s.phone || '').includes(servicerSearch)
  );

  const handleQuickAddServicer = async (e) => {
    e.preventDefault();
    if (!quickAddName.trim() || !quickAddPhone.trim()) {
      setQuickAddError('Name and phone are required');
      return;
    }

    setIsCreatingServicer(true);
    setQuickAddError('');
    try {
      const res = await api.post('/servicers', {
        name: quickAddName.trim(),
        phone: quickAddPhone.trim(),
        isActive: true,
      });

      if (res.data?.success) {
        const newServicer = res.data.data;
        toast.success(`Servicer "${newServicer.name}" created successfully`);
        setServicersList((prev) => [...prev, newServicer]);
        setForm((prev) => ({ ...prev, assignedServicer: newServicer._id }));
        setQuickAddName('');
        setQuickAddPhone('');
        setIsQuickAddOpen(false);
      }
    } catch (err) {
      setQuickAddError(err.response?.data?.error?.message || 'Failed to create servicer');
    } finally {
      setIsCreatingServicer(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!form.assignedServicer) {
      setServerError('Please select an active servicer for this completion');
      return;
    }
    if (!form.completedDate) {
      setServerError('Completion date is required');
      return;
    }
    if (!form.workPerformed.trim() || form.workPerformed.trim().length < 3) {
      setServerError('Servicing details / work performed is required (min 3 characters)');
      return;
    }
    if (!form.resolutionNotes.trim() || form.resolutionNotes.trim().length < 3) {
      setServerError('Resolution notes are required (min 3 characters)');
      return;
    }
    if (form.serviceCharge < 0) {
      setServerError('Service charge cannot be negative');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        assignedServicer: form.assignedServicer,
        completedDate: form.completedDate,
        workPerformed: form.workPerformed.trim(),
        resolutionNotes: form.resolutionNotes.trim(),
        partsReplaced: form.partsReplaced.trim() || '',
        serviceCharge: Number(form.serviceCharge) || 0,
        additionalNotes: form.additionalNotes.trim() || '',
        version: complaint.version,
      };

      const res = await api.post(`/complaints/${complaint._id}/complete-service`, payload);

      if (res.data?.success) {
        toast.success('Service completed successfully.');
        window.dispatchEvent(new CustomEvent('complaint-status-changed', { detail: res.data.data }));
        if (onSuccess) {
          onSuccess(res.data.data);
        }
        onClose();
      }
    } catch (err) {
      const errData = err.response?.data?.error;
      const msg = errData?.message || 'Failed to complete complaint service';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const brandName = complaint.brand?.name || complaint.brandNameSnapshot || 'Not assigned';
  const categoryName = complaint.category?.name || complaint.categoryNameSnapshot || 'Not assigned';
  const repName = complaint.representative?.name || complaint.representativeNameSnapshot || 'Not assigned';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete Complaint Service" maxWidth="max-w-3xl">
      <div className="space-y-6">
        {/* Read-Only Complaint Summary Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Complaint Reference:
              </span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {complaint.complaintNumber}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Registered:{' '}
              {complaint.complaintDate
                ? new Date(complaint.complaintDate).toLocaleDateString('en-IN')
                : '-'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Customer:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {complaint.customerName}
              </span>
              <span className="text-slate-600 font-mono block mt-0.5">
                {complaint.customerPhone}
                {complaint.alternatePhone && (
                  <span className="text-[11px] text-slate-400 block font-sans">
                    Alt: {complaint.alternatePhone}
                  </span>
                )}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Product / Brand:</span>
              <span className="font-bold text-slate-800 block truncate" title={complaint.productName}>
                {complaint.productName}
              </span>
              <span className="text-slate-500 block truncate mt-0.5">
                {brandName} &bull; {categoryName}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Registered by (REP):</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                {repName}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Service Area / Status:</span>
              <span className="font-bold text-slate-800 block">{complaint.area || '-'}</span>
              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                Current: {complaint.status}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80">
            <span className="text-slate-400 text-xs block mb-0.5 font-medium">
              Complaint Description:
            </span>
            <p className="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200 line-clamp-3">
              {complaint.description}
            </p>
          </div>
        </div>

        {/* Server / Validation Error Alert */}
        {serverError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{serverError}</div>
          </div>
        )}

        {/* Service Completion Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Servicer Selection Row */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Assigned Servicer *</span>
              </label>
              {!isQuickAddOpen && (
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(true)}
                  className="text-xs text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Quick Add Servicer</span>
                </button>
              )}
            </div>

            {/* Quick Add Servicer Inline Sub-card */}
            {isQuickAddOpen && (
              <div className="mb-3 p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900">Add New Servicer</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickAddOpen(false);
                      setQuickAddError('');
                    }}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {quickAddError && (
                  <p className="text-[11px] text-rose-700 font-semibold">{quickAddError}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Servicer Name *"
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-xs text-slate-800"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number *"
                    value={quickAddPhone}
                    onChange={(e) => setQuickAddPhone(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickAddOpen(false)}
                    className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickAddServicer}
                    disabled={isCreatingServicer || !quickAddName.trim() || !quickAddPhone.trim()}
                    className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    {isCreatingServicer ? 'Saving...' : 'Save & Select'}
                  </button>
                </div>
              </div>
            )}

            {activeServicers.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-semibold">No active servicers found in the system.</p>
                <p>
                  Click <strong>+ Quick Add Servicer</strong> above or create one under the Servicers menu to complete this complaint. Your entered work details will be preserved.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeServicers.length > 5 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search servicer by name or phone..."
                      value={servicerSearch}
                      onChange={(e) => setServicerSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                    />
                  </div>
                )}
                <select
                  required
                  value={form.assignedServicer}
                  onChange={(e) => setForm((prev) => ({ ...prev, assignedServicer: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">-- Choose Servicer who performed the work --</option>
                  {filteredServicers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.phone}){s.serviceArea ? ` - ${s.serviceArea}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Completion Date & Service Charge */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>Completion Date *</span>
              </label>
              <input
                type="date"
                required
                value={form.completedDate}
                onChange={(e) => setForm((prev) => ({ ...prev, completedDate: e.target.value }))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-teal-600" />
                <span>Service Charge (INR)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.serviceCharge}
                onChange={(e) => setForm((prev) => ({ ...prev, serviceCharge: e.target.value }))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Servicing Details / Work Performed */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Servicing Details / Work Performed *
            </label>
            <textarea
              required
              rows={3}
              value={form.workPerformed}
              onChange={(e) => setForm((prev) => ({ ...prev, workPerformed: e.target.value }))}
              placeholder="Describe diagnostic checks, repair steps, motor cleaning, chemical service, or testing performed..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y"
            />
          </div>

          {/* Resolution Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Resolution Notes *
            </label>
            <textarea
              required
              rows={2}
              value={form.resolutionNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, resolutionNotes: e.target.value }))}
              placeholder="e.g. Unit tested in customer presence. Cooling verified at 18C. Customer signed service slip."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y"
            />
          </div>

          {/* Parts Replaced (Optional) */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Parts Replaced (Optional)
            </label>
            <input
              type="text"
              value={form.partsReplaced}
              onChange={(e) => setForm((prev) => ({ ...prev, partsReplaced: e.target.value }))}
              placeholder="e.g. 36uF Capacitor, Brass Flare Nut, Thermostat Sensor"
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Additional Notes (Optional) */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Additional Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={form.additionalNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, additionalNotes: e.target.value }))}
              placeholder="Warranty advice, customer feedback, or future follow-up recommendations..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <p className="text-[11px] text-slate-500">
              Marks ticket as <strong>Completed</strong> and records administrative timeline.
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Completing Service...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Service</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default ServiceComplaintModal;

