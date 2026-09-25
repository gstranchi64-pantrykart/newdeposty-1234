import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingBag,
  ShieldCheck,
  Truck,
  ClipboardCheck,
  LogOut,
  CreditCard,
  ShoppingCart,
  User as UserIcon,
  ChevronDown,
  RotateCcw,
  MapPin,
  Wallet,
  Bell,
  Package,
  Layers,
  FileText,
  Boxes,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
  Settings,
  Menu,
  X,
  FileCheck,
  UserCheck,
  Receipt,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { UserRole, hasPantryAccess } from '../../types';
import { api } from '../../services/api';
import { AdminNotificationCenter } from '../admin/AdminNotificationCenter';

export interface NavbarProps {
  currentTab?: string;
  activeView?: string;
  onTabChange?: (tab: string) => void;
  onNavigate?: (view: string, subTab?: string, filter?: string) => void;
  quickCartCount?: number;
  pantryCartCount?: number;
  onOpenQuickCart?: () => void;
  onOpenPantryCart?: () => void;
  onOpenProfile?: (
    tab?: 'profile' | 'address' | 'history' | 'pantry' | 'pantryPay' | 'tracking' | 'wallet' | 'ledger' | 'audits' | 'stock'
  ) => void;
  onDataRefresh?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  activeView,
  onTabChange,
  onNavigate,
  quickCartCount = 0,
  pantryCartCount = 0,
  onOpenQuickCart,
  onOpenPantryCart,
  onOpenProfile,
  onDataRefresh,
}) => {
  const { user, customer, role, logout, quickLoginAsRole } = useAuth();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState<string | null>('stock');

  const navRef = useRef<HTMLDivElement>(null);

  const active = activeView || currentTab || 'admin-dashboard';

  const handleNav = (target: string, subTab?: string, filter?: string) => {
    if (onNavigate) onNavigate(target, subTab, filter);
    if (onTabChange) onTabChange(target);
    setActiveDropdown(null);
    setMobileMenuOpen(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
        setShowRoleMenu(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll for unread notification count when in ADMIN mode
  useEffect(() => {
    if (role !== 'ADMIN') return;
    const fetchUnreadCount = async () => {
      try {
        const [orders, returns, payments, reps, batches] = await Promise.all([
          api.getOrders().catch(() => []),
          api.getAuditorReturnOrders().catch(() => []),
          api.getAllPantryPayments().catch(() => []),
          api.getReplacements().catch(() => []),
          api.getBatches().catch(() => []),
        ]);

        let readSet = new Set<string>();
        try {
          const saved = localStorage.getItem('pantrymaster_admin_read_notifications');
          if (saved) readSet = new Set(JSON.parse(saved));
        } catch {}

        let count = 0;
        const now = new Date();
        orders.filter((o) => o.orderStatus === 'PENDING' || o.orderStatus === 'CONFIRMED' || o.orderStatus === 'READY_TO_SHIP').forEach((o) => {
          if (!readSet.has(`notif-order-${o.id}`)) count++;
        });
        returns.filter((r) => r.status === 'PENDING').forEach((r) => {
          if (!readSet.has(`notif-return-${r.id}`)) count++;
        });
        payments.filter((p) => p.auditorConfirmationStatus === 'PENDING').forEach((p) => {
          if (!readSet.has(`notif-pay-${p.id}`)) count++;
        });
        reps.filter((r) => r.status === 'PENDING').forEach((r) => {
          if (!readSet.has(`notif-rep-${r.id}`)) count++;
        });
        batches.filter((b) => b.availableQuantity <= 5 || (b.expiryDate && new Date(b.expiryDate) < now)).slice(0, 5).forEach((b) => {
          if (!readSet.has(`notif-batch-${b.id}`)) count++;
        });

        setUnreadNotificationCount(count);
      } catch {}
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 12000);
    return () => clearInterval(interval);
  }, [role, activeView]);

  const handleResetSeeds = async () => {
    if (
      !window.confirm(
        'Reset database to clean initial test seeds? This will restore all sample products, batches, and records.'
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await api.resetSeeds();
      if (onDataRefresh) onDataRefresh();
      alert('Database restored with fresh test seeds successfully!');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResetting(false);
    }
  };

  const getRoleIcon = (r: UserRole | null) => {
    switch (r) {
      case 'ADMIN':
        return <ShieldCheck className="w-4 h-4 text-purple-400" />;
      case 'CUSTOMER':
        return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
      case 'DELIVERY_BOY':
        return <Truck className="w-4 h-4 text-amber-400" />;
      case 'AUDITOR':
        return <ClipboardCheck className="w-4 h-4 text-cyan-400" />;
      default:
        return <UserIcon className="w-4 h-4" />;
    }
  };

  const getRoleBadgeStyle = (r: UserRole | null) => {
    switch (r) {
      case 'ADMIN':
        return 'bg-purple-900/50 text-purple-200 border-purple-600/50 hover:bg-purple-900/70';
      case 'CUSTOMER':
        return 'bg-emerald-900/50 text-emerald-200 border-emerald-600/50 hover:bg-emerald-900/70';
      case 'DELIVERY_BOY':
        return 'bg-amber-900/50 text-amber-200 border-amber-600/50 hover:bg-amber-900/70';
      case 'AUDITOR':
        return 'bg-cyan-900/50 text-cyan-200 border-cyan-600/50 hover:bg-cyan-900/70';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Helpers to detect active dropdown categories
  const isStockActive = ['admin-inventory', 'admin-stockin', 'admin-catalog'].includes(active);
  const isOrdersActive = ['admin-orders'].includes(active);
  const isPantryActive = ['admin-customers', 'admin-pantry-payments'].includes(active);
  const isAuditorActive = ['admin-auditor-returns', 'admin-delivery-staff'].includes(active);
  const isAnalyticsActive = ['admin-dashboard', 'admin-reports', 'admin-notifications'].includes(active);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-lg w-full" ref={navRef}>
      <div className="w-full px-3 sm:px-5 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() =>
                handleNav(
                  role === 'CUSTOMER'
                    ? 'customer-store'
                    : role === 'DELIVERY_BOY'
                    ? 'delivery-portal'
                    : role === 'AUDITOR'
                    ? 'auditor-portal'
                    : 'admin-dashboard'
                )
              }
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  <span>PantryMaster ERP</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold">
                    v2.5
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 -mt-0.5 font-medium">
                  Batch Master • Pantry Card • Auditor Platform
                </div>
              </div>
            </button>
          </div>

          {/* Structured Categorized Menus for ADMIN */}
          {role === 'ADMIN' && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold">
              
              {/* 1. Dashboard Quick Link */}
              <button
                onClick={() => handleNav('admin-dashboard')}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  active === 'admin-dashboard'
                    ? 'bg-emerald-600 text-white shadow-md font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dashboard</span>
              </button>

              {/* 2. Stock & Batch Master Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'stock' ? null : 'stock')}
                  className={`px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    isStockActive || activeDropdown === 'stock'
                      ? 'bg-slate-800 text-emerald-300 border border-emerald-500/30 shadow-xs font-bold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Boxes className="w-4 h-4 text-emerald-400" />
                  <span>Stock &amp; Batch Master</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'stock' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'stock' && (
                  <div className="absolute left-0 mt-2 w-72 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-700/60 mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Inventory &amp; Warehousing
                    </div>

                    <button
                      onClick={() => handleNav('admin-inventory')}
                      className={`w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition ${
                        active === 'admin-inventory' ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-200' : 'hover:bg-slate-700/70 text-slate-200'
                      }`}
                    >
                      <Boxes className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Batch Inventory Master</div>
                        <div className="text-[10px] text-slate-400">View live batch stock, expiry alerts, low stock</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-stockin')}
                      className={`w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition ${
                        active === 'admin-stockin' ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-200' : 'hover:bg-slate-700/70 text-slate-200'
                      }`}
                    >
                      <Package className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Stock In &amp; New Batch Entry</div>
                        <div className="text-[10px] text-slate-400">Purchase inward, batch no, cost &amp; selling price</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-catalog')}
                      className={`w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition ${
                        active === 'admin-catalog' ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-200' : 'hover:bg-slate-700/70 text-slate-200'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Master Product Catalog</div>
                        <div className="text-[10px] text-slate-400">Manage products, 4-image sliders, barcode IDs</div>
                      </div>
                    </button>

                    <div className="border-t border-slate-700/60 mt-1 pt-1.5 px-2 flex items-center justify-between text-[11px] text-slate-400">
                      <button
                        onClick={() => handleNav('admin-inventory', undefined, 'LOW_STOCK')}
                        className="hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>Low Stock Alert</span>
                      </button>
                      <button
                        onClick={() => handleNav('admin-inventory', undefined, 'EXPIRING_SOON')}
                        className="hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      >
                        <History className="w-3 h-3 text-rose-400" />
                        <span>Near Expiry</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Orders & Operations Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'orders' ? null : 'orders')}
                  className={`px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    isOrdersActive || activeDropdown === 'orders'
                      ? 'bg-slate-800 text-amber-300 border border-amber-500/30 shadow-xs font-bold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4 text-amber-400" />
                  <span>Orders &amp; Dispatch</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'orders' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'orders' && (
                  <div className="absolute left-0 mt-2 w-72 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-700/60 mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      Fulfillment &amp; Packing Operations
                    </div>

                    <button
                      onClick={() => handleNav('admin-orders', 'orders')}
                      className={`w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition ${
                        active === 'admin-orders' ? 'bg-amber-950/60 border border-amber-700/50 text-amber-200' : 'hover:bg-slate-700/70 text-slate-200'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">All Orders &amp; COD Processing</div>
                        <div className="text-[10px] text-slate-400">Order approval, packing status, delivery assign</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-orders', 'packing')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer hover:bg-slate-700/70 text-slate-200 transition"
                    >
                      <FileText className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Warehouse Packing Slips</div>
                        <div className="text-[10px] text-slate-400">Batch-wise item picking slip &amp; barcodes</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-delivery-staff', 'delivery')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer hover:bg-slate-700/70 text-slate-200 transition"
                    >
                      <Truck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Delivery Boy Management</div>
                        <div className="text-[10px] text-slate-400">Assign delivery boys, COD cash reconciliation</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Pantry & Financials Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'pantry' ? null : 'pantry')}
                  className={`px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    isPantryActive || activeDropdown === 'pantry'
                      ? 'bg-slate-800 text-purple-300 border border-purple-500/30 shadow-xs font-bold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <span>Pantry &amp; Finance</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'pantry' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'pantry' && (
                  <div className="absolute left-0 mt-2 w-72 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-700/60 mb-1 text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      Pantry Credit &amp; Customer Ledger
                    </div>

                    <button
                      onClick={() => handleNav('admin-pantry-payments')}
                      className={`w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition ${
                        active === 'admin-pantry-payments' ? 'bg-purple-950/60 border border-purple-700/50 text-purple-200' : 'hover:bg-slate-700/70 text-slate-200'
                      }`}
                    >
                      <Receipt className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Pantry Pay &amp; Bills Admin</div>
                        <div className="text-[10px] text-slate-400">Approve payments, verify auditor collections</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-customers')}
                      className={`w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition ${
                        active === 'admin-customers' ? 'bg-purple-950/60 border border-purple-700/50 text-purple-200' : 'hover:bg-slate-700/70 text-slate-200'
                      }`}
                    >
                      <Users className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Customers 360° Management</div>
                        <div className="text-[10px] text-slate-400">Credit limits, pantry card activation &amp; details</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-customers', 'holdings')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer hover:bg-slate-700/70 text-slate-200 transition"
                    >
                      <Wallet className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Customer Live Pantry Holdings</div>
                        <div className="text-[10px] text-slate-400">Monitor live items stock in customer pantries</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Auditor & Verification Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'auditor' ? null : 'auditor')}
                  className={`px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    isAuditorActive || activeDropdown === 'auditor'
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30 shadow-xs font-bold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                  <span>Auditor &amp; Verification</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'auditor' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'auditor' && (
                  <div className="absolute left-0 mt-2 w-72 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-700/60 mb-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Auditor Field Operations &amp; Verification
                    </div>

                    <button
                      onClick={() => handleNav('admin-auditor-returns')}
                      className={`w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition ${
                        active === 'admin-auditor-returns' ? 'bg-cyan-950/60 border border-cyan-700/50 text-cyan-200' : 'hover:bg-slate-700/70 text-slate-200'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Auditor Return Claims Admin</div>
                        <div className="text-[10px] text-slate-400">Review &amp; approve auditor return requests</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-delivery-staff', 'auditors')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer hover:bg-slate-700/70 text-slate-200 transition"
                    >
                      <UserCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Auditor Staff Management</div>
                        <div className="text-[10px] text-slate-400">Manage field auditors &amp; assigned routes</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-reports', 'audits')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer hover:bg-slate-700/70 text-slate-200 transition"
                    >
                      <FileCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-white">Physical Pantry Audit Logs</div>
                        <div className="text-[10px] text-slate-400">Field visit reports, discrepancies &amp; proofs</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 6. Reports & Logs */}
              <button
                onClick={() => handleNav('admin-reports')}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  active === 'admin-reports'
                    ? 'bg-slate-800 text-white shadow-xs font-bold border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                <span>Reports &amp; Logs</span>
              </button>

            </div>
          )}

          {/* CUSTOMER Navigation */}
          {role === 'CUSTOMER' && (
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
              <button
                onClick={() => handleNav('customer-store')}
                className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  active === 'customer-store'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <span>Shop Fresh Groceries</span>
              </button>

              {/* My Profile All Sections Dropdown on PC */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'customerProfile' ? null : 'customerProfile')}
                  className={`px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeDropdown === 'customerProfile'
                      ? 'bg-slate-800 text-emerald-300 border border-emerald-500/40 font-bold'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/80'
                  }`}
                >
                  <UserIcon className="w-4 h-4 text-emerald-400" />
                  <span>My Profile &amp; Passbook All Menu</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'customerProfile' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'customerProfile' && (
                  <div className="absolute left-0 mt-2 w-72 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-700/60 mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <UserIcon className="w-3 h-3" />
                      Customer Account Sections
                    </div>

                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onOpenProfile) onOpenProfile('profile');
                      }}
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer hover:bg-slate-700 text-slate-200 transition"
                    >
                      <UserIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs text-white">Profile &amp; Personal Info</div>
                        <div className="text-[10px] text-slate-400">Name, photo, mobile &amp; alternate contacts</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onOpenProfile) onOpenProfile('wallet');
                      }}
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer hover:bg-slate-700 text-slate-200 transition"
                    >
                      <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs text-white">Wallet History &amp; Passbook</div>
                        <div className="text-[10px] text-slate-400">View closing balances, recharges &amp; debits</div>
                      </div>
                    </button>

                    {hasPantryAccess(customer) && (
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          if (onOpenProfile) onOpenProfile('ledger');
                        }}
                        className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer hover:bg-slate-700 text-slate-200 transition"
                      >
                        <CreditCard className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-xs text-white">Pantry Limit &amp; Credit Ledger</div>
                          <div className="text-[10px] text-slate-400">Available limit, bill pay &amp; adjustments</div>
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onOpenProfile) onOpenProfile('audits');
                      }}
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer hover:bg-slate-700 text-slate-200 transition"
                    >
                      <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs text-white">Audits &amp; Verification Permissions</div>
                        <div className="text-[10px] text-slate-400">Approve field visits &amp; lock audit bills</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onOpenProfile) onOpenProfile('address');
                      }}
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer hover:bg-slate-700 text-slate-200 transition"
                    >
                      <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs text-white">Delivery Address</div>
                        <div className="text-[10px] text-slate-400">House address, landmark &amp; pin code</div>
                      </div>
                    </button>

                    {hasPantryAccess(customer) && (
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          if (onOpenProfile) onOpenProfile('stock');
                        }}
                        className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer hover:bg-slate-700 text-slate-200 transition"
                      >
                        <Boxes className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-xs text-white">Live Pantry Stock</div>
                          <div className="text-[10px] text-slate-400">Items inside your home pantry &amp; used history</div>
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onOpenProfile) onOpenProfile('history');
                      }}
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer hover:bg-slate-700 text-slate-200 transition"
                    >
                      <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs text-white">COD Order History</div>
                        <div className="text-[10px] text-slate-400">View cash-on-delivery order receipts</div>
                      </div>
                    </button>

                    {hasPantryAccess(customer) && (
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          if (onOpenProfile) onOpenProfile('pantry');
                        }}
                        className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer hover:bg-slate-700 text-slate-200 transition"
                      >
                        <CreditCard className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-xs text-white">Pantry Orders History</div>
                          <div className="text-[10px] text-slate-400">View pantry credit delivery orders</div>
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onOpenProfile) onOpenProfile('tracking');
                      }}
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer hover:bg-slate-700 text-slate-200 transition"
                    >
                      <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs text-white">Live Order Tracking</div>
                        <div className="text-[10px] text-slate-400">Delivery status, step lock &amp; ETA</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DELIVERY BOY Navigation */}
          {role === 'DELIVERY_BOY' && (
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => handleNav('delivery-portal')}
                className="px-3.5 py-1.5 rounded-lg bg-amber-900/50 text-amber-200 border border-amber-700/60 font-bold text-xs flex items-center gap-2"
              >
                <Truck className="w-4 h-4 text-amber-400" />
                <span>Delivery Run &amp; COD Cash Portal</span>
              </button>
            </div>
          )}

          {/* AUDITOR Navigation */}
          {role === 'AUDITOR' && (
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => handleNav('auditor-portal')}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-900/50 text-cyan-200 border border-cyan-700/60 font-bold text-xs flex items-center gap-2"
              >
                <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                <span>Field Verification &amp; Customer Audit Portal</span>
              </button>
            </div>
          )}

          {/* Right Action Tools & Switchers */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Customer Cart Triggers */}
            {role === 'CUSTOMER' && (
              <div className="flex items-center gap-1.5">
                {hasPantryAccess(customer) && (
                  <button
                    onClick={onOpenPantryCart}
                    className="relative px-2.5 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-900/70 border border-purple-700/60 text-purple-200 transition text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Pantry Credit Cart (0 COD)"
                  >
                    <CreditCard className="w-4 h-4 text-purple-300" />
                    <span className="hidden sm:inline font-semibold">Pantry Cart</span>
                    {pantryCartCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-purple-500 text-white text-[10px] font-black rounded-full">
                        {pantryCartCount}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={onOpenQuickCart}
                  className="relative px-2.5 py-1.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-700/60 text-amber-200 transition text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Quick COD Cart"
                >
                  <ShoppingCart className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline font-semibold">Quick COD</span>
                  {quickCartCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full">
                      {quickCartCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Admin Notification Center Bell */}
            {role === 'ADMIN' && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowRoleMenu(false);
                    setActiveDropdown(null);
                  }}
                  className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition cursor-pointer flex items-center gap-1 shadow-xs"
                  title="ERP Notification Center"
                >
                  <Bell className="w-4 h-4 text-purple-400" />
                  {unreadNotificationCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-black rounded-full animate-pulse shadow-xs">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 z-50 w-80 sm:w-96 shadow-2xl">
                    <AdminNotificationCenter
                      isDropdown
                      onNavigate={(view, subTab, filter) => {
                        handleNav(view, subTab, filter);
                        setShowNotifications(false);
                      }}
                      onClose={() => setShowNotifications(false)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Role Switcher Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowRoleMenu(!showRoleMenu);
                  setShowNotifications(false);
                  setActiveDropdown(null);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-xs ${getRoleBadgeStyle(
                  role
                )}`}
              >
                {getRoleIcon(role)}
                <span className="hidden sm:inline">{role || 'GUEST'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 py-2 z-50 animate-in fade-in duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-700/80 text-[11px] text-slate-400">
                    Active User: <strong className="text-white font-semibold">{user?.name}</strong>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">+91 {user?.mobile}</div>
                  </div>

                  {role === 'CUSTOMER' && (
                    <div className="border-b border-slate-700/80 py-2 px-2 bg-slate-900/40">
                      <div className="px-1.5 py-1 text-[10px] uppercase font-bold text-emerald-400">
                        Customer Quick Links
                      </div>
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          if (onOpenProfile) onOpenProfile('profile');
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-white hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition"
                      >
                        <UserIcon className="w-4 h-4 text-emerald-400" />
                        <span>Edit Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          if (onOpenProfile) onOpenProfile('wallet');
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-white hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition"
                      >
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        <span>Wallet &amp; Passbook</span>
                      </button>
                      {hasPantryAccess(customer) && (
                        <button
                          onClick={() => {
                            setShowRoleMenu(false);
                            if (onOpenProfile) onOpenProfile('ledger');
                          }}
                          className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-white hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition"
                        >
                          <CreditCard className="w-4 h-4 text-purple-400" />
                          <span>Pantry Card Ledger</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 mt-1">
                    Quick Role Switcher
                  </div>

                  {/* ADMIN Option */}
                  <button
                    onClick={() => {
                      quickLoginAsRole('ADMIN');
                      setShowRoleMenu(false);
                      handleNav('admin-dashboard');
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition"
                  >
                    <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">ADMIN Dashboard</div>
                      <div className="text-[10px] text-slate-400">Full ERP &amp; stock management</div>
                    </div>
                  </button>

                  {/* CUSTOMER Option */}
                  <button
                    onClick={() => {
                      quickLoginAsRole('CUSTOMER');
                      setShowRoleMenu(false);
                      handleNav('customer-store');
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition"
                  >
                    <ShoppingBag className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">CUSTOMER Portal</div>
                      <div className="text-[10px] text-slate-400">Pantry Card, Quick COD</div>
                    </div>
                  </button>

                  {/* DELIVERY BOY Option */}
                  <button
                    onClick={() => {
                      quickLoginAsRole('DELIVERY_BOY');
                      setShowRoleMenu(false);
                      handleNav('delivery-portal');
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition"
                  >
                    <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">DELIVERY BOY</div>
                      <div className="text-[10px] text-slate-400">Dispatches &amp; COD collection</div>
                    </div>
                  </button>

                  {/* AUDITOR Option */}
                  <button
                    onClick={() => {
                      quickLoginAsRole('AUDITOR');
                      setShowRoleMenu(false);
                      handleNav('auditor-portal');
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition"
                  >
                    <ClipboardCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">AUDITOR Portal</div>
                      <div className="text-[10px] text-slate-400">Field visit &amp; pantry audits</div>
                    </div>
                  </button>

                  <div className="border-t border-slate-700 mt-2 pt-1 px-2">
                    <button
                      onClick={handleResetSeeds}
                      disabled={resetting}
                      className="w-full text-left px-2 py-1.5 rounded text-[11px] text-amber-300 hover:bg-amber-950/40 flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <RotateCcw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
                      Reset Test Seeds Data
                    </button>
                    <button
                      onClick={() => {
                        setShowRoleMenu(false);
                        logout();
                      }}
                      className="w-full text-left px-2 py-1.5 rounded text-[11px] text-rose-300 hover:bg-rose-950/40 flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <LogOut className="w-3 h-3" />
                      Logout / Change Number
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200">
          {role === 'ADMIN' && (
            <div className="space-y-2 text-sm">
              <button
                onClick={() => handleNav('admin-dashboard')}
                className={`w-full p-2.5 rounded-xl text-left font-bold flex items-center gap-2 ${
                  active === 'admin-dashboard' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-200'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Executive Dashboard</span>
              </button>

              {/* Stock Accordion */}
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'stock' ? null : 'stock')}
                  className="w-full p-3 font-semibold text-emerald-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-emerald-400" />
                    Stock &amp; Batch Master
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpandedSection === 'stock' ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpandedSection === 'stock' && (
                  <div className="bg-slate-900/80 p-2 space-y-1 border-t border-slate-700/60 text-xs">
                    <button
                      onClick={() => handleNav('admin-inventory')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Batch Inventory Master</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-stockin')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Package className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Stock In &amp; Batch Registration</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-catalog')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Master Product Catalog</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Orders Accordion */}
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'orders' ? null : 'orders')}
                  className="w-full p-3 font-semibold text-amber-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-400" />
                    Orders &amp; Dispatch
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpandedSection === 'orders' ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpandedSection === 'orders' && (
                  <div className="bg-slate-900/80 p-2 space-y-1 border-t border-slate-700/60 text-xs">
                    <button
                      onClick={() => handleNav('admin-orders', 'orders')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                      <span>All Orders &amp; Dispatch</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-orders', 'packing')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Packing Slips &amp; Barcodes</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-delivery-staff', 'delivery')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Truck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Delivery Boys &amp; Staff</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Pantry & Financials Accordion */}
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'pantry' ? null : 'pantry')}
                  className="w-full p-3 font-semibold text-purple-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    Pantry &amp; Finance
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpandedSection === 'pantry' ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpandedSection === 'pantry' && (
                  <div className="bg-slate-900/80 p-2 space-y-1 border-t border-slate-700/60 text-xs">
                    <button
                      onClick={() => handleNav('admin-pantry-payments')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Receipt className="w-3.5 h-3.5 text-purple-400" />
                      <span>Pantry Pay Payments Admin</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-customers')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      <span>Customer Management 360°</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-customers', 'holdings')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Wallet className="w-3.5 h-3.5 text-purple-400" />
                      <span>Live Customer Pantry Holdings</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Auditor Accordion */}
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'auditor' ? null : 'auditor')}
                  className="w-full p-3 font-semibold text-cyan-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                    Auditor &amp; Verification
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpandedSection === 'auditor' ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpandedSection === 'auditor' && (
                  <div className="bg-slate-900/80 p-2 space-y-1 border-t border-slate-700/60 text-xs">
                    <button
                      onClick={() => handleNav('admin-auditor-returns')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Auditor Return Claims</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-delivery-staff', 'auditors')}
                      className="w-full text-left p-2 rounded text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Auditor Staff Management</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleNav('admin-reports')}
                className="w-full p-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-left flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span>Reports &amp; Logs Admin</span>
              </button>
            </div>
          )}

          {role === 'CUSTOMER' && (
            <div className="space-y-2">
              <button
                onClick={() => handleNav('customer-store')}
                className="w-full p-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Shop Fresh Groceries</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenProfile) onOpenProfile('profile');
                }}
                className="w-full p-3 rounded-xl bg-slate-800 text-slate-200 font-semibold flex items-center gap-2"
              >
                <UserIcon className="w-4 h-4 text-emerald-400" />
                <span>My Profile &amp; Passbook</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
