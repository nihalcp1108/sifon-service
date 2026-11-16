import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Calendar,
  IndianRupee,
  UserCheck,
  Download,
  ExternalLink,
  Wrench,
  FileText,
  User,
  Phone,
  Tag,
} from 'lucide-react';
import { Modal } from './Modal';
import { formatKolkataDateTime, formatCurrencyINR } from '../utils/formatters';

export function ServiceDetailsModal({
  isOpen,
  onClose,
  complaint,
  onDownloadPdf,
}) {
  if (!isOpen || !complaint) return null;

  const resolution = complaint.resolution || {};
  const servicerName =
    complaint.assignedServicer?.name || complaint.servicerNameSnapshot || 'Not recorded';
  const repName =
    complaint.representative?.name || complaint.representativeNameSnapshot || 'Not assigned';
  const brandName = complaint.brand?.name || complaint.brandNameSnapshot || 'Not assigned';
  const categoryName = complaint.category?.name || complaint.categoryNameSnapshot || 'Not assigned';

  const completedDateFormatted = resolution.completedDate
    ? formatKolkataDateTime(resolution.completedDate)
    : 'Not recorded';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Service Completion Details - ${complaint.complaintNumber}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Status & Summary Banner */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-emerald-950">
                  {complaint.complaintNumber}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  Completed
                </span>
              </div>
              <span className="text-xs text-emerald-700">
                Service completed on {completedDateFormatted}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-emerald-600 uppercase font-semibold block">
              Total Charge
            </span>
            <span className="text-base font-extrabold text-emerald-950 font-mono">
              {formatCurrencyINR(resolution.serviceCharge || 0)}
            </span>
          </div>
        </div>

        {/* Customer & Product Quick Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Customer Information:</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {complaint.customerName}
            </span>
            <span className="text-slate-600 font-mono block mt-0.5 flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400" />
              {complaint.customerPhone}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Registered by (REP):</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-teal-600" />
              {repName}
            </span>
            {complaint.representative?.phone && (
              <span className="text-slate-500 font-mono text-[11px] block mt-0.5">
                {complaint.representative.phone}
              </span>
            )}
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Product / Brand:</span>
            <span className="font-semibold text-slate-800 block truncate" title={complaint.productName}>
              {complaint.productName}
            </span>
            <span className="text-slate-500 block truncate mt-0.5">
              {brandName} &bull; {categoryName}
            </span>
          </div>
        </div>

        {/* Service Completion Details Grid */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <span className="text-slate-400 font-medium block mb-1 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                Serviced By
              </span>
              <span className="font-bold text-slate-900 text-sm">{servicerName}</span>
              {complaint.assignedServicer?.phone && (
                <span className="text-slate-500 font-mono text-[11px] block mt-0.5">
                  Phone: {complaint.assignedServicer.phone}
                </span>
              )}
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <span className="text-slate-400 font-medium block mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                Completion Date
              </span>
              <span className="font-bold text-slate-900 text-sm">{completedDateFormatted}</span>
              {resolution.completedByName && (
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Recorded by: {resolution.completedByName}
                </span>
              )}
            </div>
          </div>

          {/* Work Performed */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Servicing Details / Work Performed
            </span>
            <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {resolution.workPerformed || 'Not recorded'}
            </p>
          </div>

          {/* Resolution Notes */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Resolution Notes
            </span>
            <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {resolution.resolutionNotes || 'Not recorded'}
            </p>
          </div>

          {/* Parts Replaced & Additional Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <span className="text-slate-400 font-medium block mb-1">Parts Replaced</span>
              <span className="font-semibold text-slate-800">
                {resolution.partsReplaced || 'None'}
              </span>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <span className="text-slate-400 font-medium block mb-1">Additional Notes</span>
              <span className="text-slate-800 whitespace-pre-wrap">
                {resolution.additionalNotes || 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <Link
            to={`/complaints/${complaint._id}`}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1.5"
          >
            <span>Open Complaint Ticket Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <div className="flex items-center gap-2">
            {onDownloadPdf && (
              <button
                type="button"
                onClick={() => onDownloadPdf(complaint._id, complaint.complaintNumber)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-sm"
              >
                <Download className="w-4 h-4 text-teal-600" />
                <span>Download PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ServiceDetailsModal;

