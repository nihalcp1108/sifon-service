import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Users,
  ArrowRight,
  TrendingUp,
  Inbox,
  AlertCircle,
  PauseCircle,
  CheckSquare,
  Wrench,
  Eye,
} from 'lucide-react';
import { api } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  formatKolkataDateTime,
  formatKolkataDate,
  formatCurrencyINR,
  getStatusBadgeClass,
  getPriorityBadgeClass,
  getStatusDisplayLabel,
} from '../utils/formatters';

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const handleStatusChanged = () => {
      fetchStats();
    };
    window.addEventListener('complaint-status-changed', handleStatusChanged);
    return () => window.removeEventListener('complaint-status-changed', handleStatusChanged);
  }, []);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading dashboard analytics..." />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-8">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800 mb-1">Failed to load statistics</h2>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  const {
    totalActive = 0,
    statusCounts = {},
    recentComplaints = [],
    recentCompletedComplaints = [],
    complaintsByServicer = [],
    unassignedCount = 0,
    completedCount = 0,
  } = stats || {};

  const totalCompleted = completedCount !== undefined
    ? completedCount
    : (statusCounts['Resolved'] || 0) + (statusCounts['Closed'] || 0);

  const statusCards = [
    { label: 'Total Active', count: totalActive, path: '/complaints', color: 'bg-teal-600 text-white', icon: FileText },
    { label: 'Registered', count: statusCounts['Registered'] || 0, path: '/complaints?status=Registered', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: Inbox },
    { label: 'Assigned', count: statusCounts['Assigned'] || 0, path: '/complaints?status=Assigned', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Users },
    { label: 'In Progress', count: statusCounts['In Progress'] || 0, path: '/complaints?status=In%20Progress', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: Clock },
    { label: 'On Hold', count: statusCounts['On Hold'] || 0, path: '/complaints?status=On%20Hold', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: PauseCircle },
    { label: 'Completed', count: totalCompleted, path: '/complaints/completed', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
    { label: 'Cancelled', count: statusCounts['Cancelled'] || 0, path: '/complaints?status=Cancelled', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: CheckSquare },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Operations Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time status of service tickets and field servicer assignments.</p>
        </div>
        <button
          onClick={fetchStats}
          className="self-start sm:self-auto text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
        >
          Refresh Data
        </button>
      </div>

      {/* Unassigned Warning Alert if any */}
      {unassignedCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {unassignedCount} Active Complaint{unassignedCount > 1 ? 's' : ''} Awaiting Servicer Assignment
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Assign qualified servicers to keep turnaround times within SLA standards.
              </p>
            </div>
          </div>
          <Link
            to="/complaints?servicer=unassigned"
            className="text-xs font-semibold px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shrink-0"
          >
            Assign Now
          </Link>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {statusCards.map((card) => {
          const Icon = card.icon;
          const isTotal = card.label === 'Total Active';
          return (
            <div
              key={card.label}
              onClick={() => navigate(card.path)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between ${
                isTotal
                  ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20'
                  : `bg-white ${card.color}`
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isTotal ? 'text-teal-100' : 'text-slate-500'}`}>
                  {card.label}
                </span>
                <Icon className={`w-4 h-4 ${isTotal ? 'text-white' : ''}`} />
              </div>
              <div>
                <span className="text-3xl font-extrabold tracking-tight">{card.count}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Grid: Recent Complaints & Servicer Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Complaints Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Complaints</h2>
                <p className="text-xs text-slate-500">Latest active registrations</p>
              </div>
              <Link
                to="/complaints"
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentComplaints.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No complaints registered yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                      <th className="pb-3">Ticket</th>
                      <th className="pb-3">Customer</th>
                      <th className="pb-3">Product</th>
                      <th className="pb-3">Servicer</th>
                      <th className="pb-3">Priority</th>
                      <th className="pb-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentComplaints.map((c) => (
                      <tr
                        key={c._id}
                        onClick={() => navigate(`/complaints/${c._id}`)}
                        className="hover:bg-slate-50/80 cursor-pointer transition"
                      >
                        <td className="py-3 font-semibold text-teal-600">
                          {c.complaintNumber}
                        </td>
                        <td className="py-3 font-medium text-slate-800">
                          {c.customerName}
                        </td>
                        <td className="py-3 text-slate-500 truncate max-w-[140px]">
                          {c.productName}
                        </td>
                        <td className="py-3 text-slate-600">
                          {c.assignedServicer?.name || c.servicerNameSnapshot || (
                            <span className="text-amber-600 font-medium">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${getPriorityBadgeClass(c.priority)}`}>
                            {c.priority}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(c.status)}`}>
                            {getStatusDisplayLabel(c.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Servicer Workloads */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Servicer Assignments</h2>
              <p className="text-xs text-slate-500">Active assigned complaints</p>
            </div>
            <Link
              to="/servicers"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {complaintsByServicer.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No servicers currently assigned.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {complaintsByServicer.map((item) => (
                <div
                  key={item.servicerId}
                  onClick={() => navigate(`/complaints?servicer=${item.servicerId}`)}
                  className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/70 cursor-pointer transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 font-bold flex items-center justify-center text-sm">
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400">Field Servicer</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-teal-600">{item.count}</span>
                    <span className="text-xs text-slate-400 block">active</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Completed Complaints Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Completed Complaints</h2>
              <p className="text-xs text-slate-500">Latest resolved customer issues and servicer completion records</p>
            </div>
          </div>
          <Link
            to="/complaints/completed"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition"
          >
            <span>View all completed</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentCompletedComplaints.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No completed complaints recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-3">Ticket ID</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Serviced By</th>
                  <th className="pb-3">Completed Date</th>
                  <th className="pb-3">Service Charge</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCompletedComplaints.map((c) => {
                  const servicerName = c.assignedServicer?.name || c.servicerNameSnapshot || 'Not recorded';
                  const compDate = c.resolution?.completedDate
                    ? formatKolkataDate(c.resolution.completedDate)
                    : '-';
                  const charge = formatCurrencyINR(c.resolution?.serviceCharge || 0);

                  return (
                    <tr key={c._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 font-mono font-bold text-slate-900">
                        <Link to={`/complaints/${c._id}`} className="hover:text-teal-600 hover:underline">
                          {c.complaintNumber}
                        </Link>
                      </td>
                      <td className="py-3 font-medium text-slate-800">
                        {c.customerName}
                      </td>
                      <td className="py-3 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-teal-600" />
                          <span>{servicerName}</span>
                        </div>
                      </td>
                      <td className="py-3 text-slate-600 text-xs">
                        {compDate}
                      </td>
                      <td className="py-3 font-mono font-semibold text-emerald-800">
                        {charge}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to={`/complaints/${c._id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded-lg text-xs font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;

