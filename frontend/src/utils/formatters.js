/**
 * Formats date into Asia/Kolkata timezone with date and time.
 */
export function formatKolkataDateTime(dateInput) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Formats date only in Asia/Kolkata timezone.
 */
export function formatKolkataDate(dateInput) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats amount into Indian Rupees.
 */
export function formatCurrencyINR(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Returns Tailwind CSS badge classes for Complaint Status.
 */
export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Registered':
      return 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20';
    case 'Assigned':
      return 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20';
    case 'In Progress':
      return 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/20';
    case 'On Hold':
      return 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20';
    case 'Resolved':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20';
    case 'Closed':
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-500/20';
    case 'Cancelled':
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20';
    default:
      return 'bg-slate-50 text-slate-700 ring-1 ring-slate-600/20';
  }
}

/**
 * Returns Tailwind CSS badge classes for Priority.
 */
export function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'urgent':
      return 'bg-red-50 text-red-700 font-semibold ring-1 ring-red-600/30';
    case 'high':
      return 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20';
    case 'medium':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
    case 'low':
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-600/20';
    default:
      return 'bg-slate-50 text-slate-600 ring-1 ring-slate-600/20';
  }
}

export const COMPLETED_STATUSES = Object.freeze(['Resolved', 'Closed']);
export const ACTIVE_STATUSES = Object.freeze(['Registered', 'Assigned', 'In Progress', 'On Hold', 'Cancelled']);

export function isCompletedStatus(status) {
  return COMPLETED_STATUSES.includes(status);
}

/**
 * Returns human-readable label for Complaint Status.
 * Reuses status 'Resolved' to display 'Completed'.
 */
export function getStatusDisplayLabel(status) {
  if (status === 'Resolved') return 'Completed';
  return status || '-';
}

