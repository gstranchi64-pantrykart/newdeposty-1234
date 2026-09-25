import React, { useState, useEffect } from 'react';
import { AuditLog, UserRole } from '../../types';
import { api } from '../../services/api';
import {
  Activity,
  Search,
  Filter,
  Clock,
  User,
  Phone,
  ShieldAlert,
  RefreshCw,
  Calendar,
  CheckCircle2,
  FileText,
  Truck,
  ClipboardCheck,
  CreditCard,
  UserCheck,
  Lock,
} from 'lucide-react';

export const MasterActivityMonitor: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
      const now = new Date();
      setLastRefreshed(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    // Role filter
    if (roleFilter !== 'ALL' && log.role !== roleFilter) {
      return false;
    }
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchWho = (log.who || log.userName || '').toLowerCase().includes(q);
      const matchMobile = (log.userMobile || '').toLowerCase().includes(q);
      const matchAction = (log.action || '').toLowerCase().includes(q);
      const matchEntity = (log.entityId || log.entity || '').toLowerCase().includes(q);
      const matchDetails = (log.details || log.newValue || '').toLowerCase().includes(q);
      return matchWho || matchMobile || matchAction || matchEntity || matchDetails;
    }
    return true;
  });

  const countByRole = (role: UserRole) => logs.filter((l) => l.role === role).length;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'CUSTOMER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <User className="w-3 h-3" /> Customer
          </span>
        );
      case 'DELIVERY_BOY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Truck className="w-3 h-3" /> Delivery Boy
          </span>
        );
      case 'AUDITOR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <ClipboardCheck className="w-3 h-3" /> Auditor
          </span>
        );
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3 h-3" /> Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {role}
          </span>
        );
    }
  };

  const formatActionName = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
            <h1 className="text-xl font-extrabold tracking-tight">Master System Activity &amp; Audit Monitor</h1>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Real-time timestamped audit logs for Customer, Auditor, Delivery Boy, and Admin activities with mobile verification &amp; permission records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-300 flex items-center gap-1 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> Refreshed: {lastRefreshed}
            </span>
          )}
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>
        </div>
      </div>

      {/* Role Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setRoleFilter('ALL')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            roleFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-semibold opacity-80">All Activity Logs</div>
          <div className="text-2xl font-black mt-1">{logs.length}</div>
          <div className="text-[11px] opacity-70 mt-0.5">Total System Traces</div>
        </button>

        <button
          onClick={() => setRoleFilter('CUSTOMER')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            roleFilter === 'CUSTOMER'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="text-xs font-semibold opacity-80 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-emerald-500" /> Customer Actions
          </div>
          <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
            {countByRole('CUSTOMER')}
          </div>
          <div className="text-[11px] opacity-70 mt-0.5">Orders &amp; Permissions</div>
        </button>

        <button
          onClick={() => setRoleFilter('DELIVERY_BOY')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            roleFilter === 'DELIVERY_BOY'
              ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="text-xs font-semibold opacity-80 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 text-blue-500" /> Delivery Boy Actions
          </div>
          <div className="text-2xl font-black mt-1 text-blue-600 dark:text-blue-400">
            {countByRole('DELIVERY_BOY')}
          </div>
          <div className="text-[11px] opacity-70 mt-0.5">Shipments &amp; Dropoffs</div>
        </button>

        <button
          onClick={() => setRoleFilter('AUDITOR')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            roleFilter === 'AUDITOR'
              ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:border-purple-300'
          }`}
        >
          <div className="text-xs font-semibold opacity-80 flex items-center gap-1">
            <ClipboardCheck className="w-3.5 h-3.5 text-purple-500" /> Auditor Actions
          </div>
          <div className="text-2xl font-black mt-1 text-purple-600 dark:text-purple-400">
            {countByRole('AUDITOR')}
          </div>
          <div className="text-[11px] opacity-70 mt-0.5">Reviews &amp; Bills</div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, mobile, action, order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 shrink-0">Filter Role:</span>
          {['ALL', 'CUSTOMER', 'DELIVERY_BOY', 'AUDITOR', 'ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                roleFilter === r
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-xs font-semibold">Loading master system activity logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No activity logs found</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting search filters or role selection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date &amp; Exact Timestamp</th>
                  <th className="py-3.5 px-4">User Name &amp; Mobile</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Action Performed</th>
                  <th className="py-3.5 px-4">Reference / Entity ID</th>
                  <th className="py-3.5 px-4 max-w-xs">Activity Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900">
                        {log.timestamp || `${log.date || ''} ${log.time || ''}`}
                      </div>
                      {log.date && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" /> {log.date}
                        </div>
                      )}
                    </td>

                    {/* User info */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{log.who || log.userName || 'System User'}</span>
                      </div>
                      {log.userMobile ? (
                        <div className="text-[11px] font-mono text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-emerald-600" /> {log.userMobile}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-mono">Mobile Verified</div>
                      )}
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4 whitespace-nowrap">{getRoleBadge(log.role)}</td>

                    {/* Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {formatActionName(log.action)}
                      </span>
                    </td>

                    {/* Entity ID */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-700 font-bold">
                      {log.entityId || log.entity || '-'}
                    </td>

                    {/* Details */}
                    <td className="py-3.5 px-4 text-slate-600 font-medium max-w-sm leading-relaxed">
                      {log.details || log.newValue || log.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
