import React, { useState, useEffect } from 'react';
import { DashboardSummary } from '../../types';
import { api } from '../../services/api';
import {
  Users,
  Package,
  Boxes,
  AlertTriangle,
  Clock,
  Ban,
  ShoppingBag,
  Truck,
  RotateCcw,
  RefreshCw,
  CreditCard,
  Banknote,
  ClipboardCheck,
  ShieldCheck,
  PlusCircle,
  TrendingUp,
  Bell,
  Palette,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface AdminDashboardProps {
  summary?: DashboardSummary | null;
  onNavigate: (view: string, subTab?: string, filter?: string) => void;
  onRefresh?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  summary: propSummary,
  onNavigate,
  onRefresh,
}) => {
  const { currentTheme } = useTheme();
  const [localSummary, setLocalSummary] = useState<DashboardSummary | null>(propSummary || null);
  const [loading, setLoading] = useState(!propSummary);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await api.getDashboardSummary();
      setLocalSummary(data);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!propSummary) {
      fetchSummary();
    } else {
      setLocalSummary(propSummary);
    }
  }, [propSummary]);

  const summary = localSummary;

  if (loading || !summary) {
    return (
      <div className="p-12 flex flex-col justify-center items-center min-h-[400px] bg-white rounded-2xl border border-slate-200">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Loading live ERP dashboard metrics...</p>
        <p className="text-xs text-slate-400 mt-1">Fetching real-time batch inventory, credit limits, and orders</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Admin Central Control Center</span>
            <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 font-semibold">
              Live Database
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time batch-wise inventory, Pantry credit tracking, quick orders, and auditor logs.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onNavigate('admin-stockin')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Purchase / Stock In
          </button>
          <button
            onClick={() => onNavigate('admin-catalog')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Package className="w-4 h-4" />
            New Product Master
          </button>
          <button
            onClick={() => onNavigate('admin-customers')}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Users className="w-4 h-4" />
            Register Customer
          </button>
          <button
            onClick={() => onNavigate('admin-pantry-payments')}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            Pantry Payments
          </button>
          <button
            onClick={() => onNavigate('admin-notifications')}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            Action Center
          </button>
          <button
            onClick={() => onNavigate('admin-delivery-staff')}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            Delivery &amp; Auditor
          </button>
          <button
            onClick={() => onNavigate('admin-reports', 'settings')}
            style={{
              backgroundColor: currentTheme.primary,
              color: currentTheme.textOnPrimary,
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer hover:opacity-95"
            title="10 Ready-Made ERP Themes (Yellow, Blue, Green, Parrot)"
          >
            <Palette className="w-4 h-4" />
            <span>Theme: {currentTheme.name.split('(')[0]}</span>
          </button>
          <button
            onClick={fetchSummary}
            className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs transition cursor-pointer"
            title="Refresh Real-time Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards Grid (All Clickable) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {/* Total Customers */}
        <div
          onClick={() => onNavigate('admin-customers')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Customers</span>
            <Users className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.totalCustomers}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 font-semibold">{summary.activeCustomers} Active</span>
            <span>• {summary.childCustomers} Child</span>
          </div>
        </div>

        {/* Pantry Customers */}
        <div
          onClick={() => onNavigate('admin-customers')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-purple-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Pantry Accounts</span>
            <CreditCard className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-purple-900">{summary.pantryCustomers}</div>
          <div className="text-[11px] text-purple-600 mt-1 font-medium">
            Credit Limit Enabled
          </div>
        </div>

        {/* Total Stock */}
        <div
          onClick={() => onNavigate('admin-inventory')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Available Stock</span>
            <Boxes className="w-4 h-4 text-blue-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {summary.totalAvailableStock} <span className="text-xs font-normal text-slate-500">units</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {summary.totalProducts} products
          </div>
        </div>

        {/* Low Stock Alert */}
        <div
          onClick={() => onNavigate('admin-inventory', undefined, 'low-stock')}
          className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-xs hover:border-amber-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-medium">Low Stock Batches</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-amber-900">{summary.lowStockBatches}</div>
          <div className="text-[11px] text-amber-700 mt-1">
            Threshold ≤ 5 units
          </div>
        </div>

        {/* Near Expiry Alert */}
        <div
          onClick={() => onNavigate('admin-inventory', undefined, 'near-expiry')}
          className="bg-white p-4 rounded-xl border border-orange-200 bg-orange-50/40 shadow-xs hover:border-orange-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-orange-700 mb-2">
            <span className="text-xs font-medium">Near Expiry Stock</span>
            <Clock className="w-4 h-4 text-orange-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-orange-900">{summary.nearExpiryBatches}</div>
          <div className="text-[11px] text-orange-700 mt-1">
            Expiring in ≤ 30 days
          </div>
        </div>

        {/* Expired Stock */}
        <div
          onClick={() => onNavigate('admin-inventory', undefined, 'expired')}
          className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/40 shadow-xs hover:border-rose-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-xs font-medium">Expired Stock</span>
            <Ban className="w-4 h-4 text-rose-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-rose-900">{summary.expiredBatches}</div>
          <div className="text-[11px] text-rose-700 mt-1">
            Blocked from sale
          </div>
        </div>

        {/* Pantry Orders */}
        <div
          onClick={() => onNavigate('admin-orders', 'pantry')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-purple-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Pantry Orders</span>
            <CreditCard className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.pantryOrdersCount}</div>
          <div className="text-[11px] text-purple-700 mt-1 font-medium">
            Credit-Based Orders
          </div>
        </div>

        {/* Quick Orders (COD) */}
        <div
          onClick={() => onNavigate('admin-orders', 'quick')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-amber-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Quick Orders (COD)</span>
            <ShoppingBag className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.quickOrdersCount}</div>
          <div className="text-[11px] text-amber-700 mt-1 font-medium">
            Cash On Delivery
          </div>
        </div>

        {/* Pending Deliveries */}
        <div
          onClick={() => onNavigate('admin-orders', 'deliveries')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Pending Deliveries</span>
            <Truck className="w-4 h-4 text-blue-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.pendingDeliveriesCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {summary.deliveredOrdersCount} Delivered
          </div>
        </div>

        {/* Pending Returns */}
        <div
          onClick={() => onNavigate('admin-auditor-returns')}
          className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs hover:border-purple-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-purple-700 mb-2">
            <span className="text-xs font-bold">Auditor Return Orders</span>
            <RotateCcw className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-black text-purple-900">{summary.pendingReturnsCount}</div>
          <div className="text-[11px] text-purple-700 mt-1 font-semibold">
            Approval &amp; Delivery Pickup
          </div>
        </div>

        {/* Replacement Due */}
        <div
          onClick={() => onNavigate('admin-orders', 'replacements')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-cyan-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Replacements Due</span>
            <RefreshCw className="w-4 h-4 text-cyan-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-cyan-900">{summary.replacementDueCount}</div>
          <div className="text-[11px] text-cyan-600 mt-1">
            Action required
          </div>
        </div>

        {/* COD Cash Collected */}
        <div
          onClick={() => onNavigate('admin-reports', 'cod')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">COD Collection</span>
            <Banknote className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-emerald-900">
            ₹{summary.quickCodCollectionAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-medium">
            Cash In Hand / Settled
          </div>
        </div>

        {/* Customer Pantry Payments Hub */}
        <div
          onClick={() => onNavigate('admin-pantry-payments')}
          className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/30 shadow-xs hover:border-purple-600 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-purple-800 mb-2">
            <span className="text-xs font-bold">Pantry Pay Settlements</span>
            <CreditCard className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-black text-purple-950">
            UPI &amp; Bank Ledger
          </div>
          <div className="text-[11px] text-purple-700 mt-1 font-semibold">
            All Customer Payments Hub →
          </div>
        </div>

        {/* ERP Notifications & Action Hub */}
        <div
          onClick={() => onNavigate('admin-notifications')}
          className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 shadow-xs hover:border-indigo-600 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-indigo-800 mb-2">
            <span className="text-xs font-bold">ERP Action Hub</span>
            <Bell className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-black text-indigo-950">
            Live Feeds
          </div>
          <div className="text-[11px] text-indigo-700 mt-1 font-semibold">
            Orders • Returns • Audits →
          </div>
        </div>
      </div>

      {/* Core Rules Verification Banner */}
      <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Core Business Architecture Active
              </div>
              <p className="text-xs text-slate-300">
                Stock is strictly managed by <strong>Batch Number</strong> + <strong>Product</strong>. Shopkeeper source is recorded for every purchase entry.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('admin-inventory')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              View Batch Stock
            </button>
            <button
              onClick={() => onNavigate('admin-reports', 'logs')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              Audit Trail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
