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
  Palette,
  Phone,
} from 'lucide-react';
import { UserRole, hasPantryAccess, Auditor } from '../../types';
import { api } from '../../services/api';
import { AdminNotificationCenter } from '../admin/AdminNotificationCenter';
import { useTheme } from '../../context/ThemeContext';

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
  const { currentTheme } = useTheme();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState<string | null>('stock');
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [showAuditorModal, setShowAuditorModal] = useState(false);

  useEffect(() => {
    api.getAuditors().then((res) => {
      if (Array.isArray(res)) setAuditors(res);
    }).catch(() => {});
  }, []);

  const primaryAuditor = Array.isArray(auditors) && auditors.length > 0
    ? (auditors.find((a) => a.status === 'ACTIVE') || auditors[0])
    : null;

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
    <header
      style={{
        backgroundColor: currentTheme.headerBg,
        borderBottom: `1px solid ${currentTheme.headerBorder}`,
        borderTop: `3.5px solid ${currentTheme.primary}`,
        color: currentTheme.headerText,
      }}
      className="sticky top-0 z-50 shadow-lg w-full transition-colors duration-200"
      ref={navRef}
    >
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
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform"
                style={{
                  background: currentTheme.gradient,
                  color: currentTheme.textOnPrimary,
                }}
              >
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  <span>PantryMaster ERP</span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold border"
                    style={{
                      backgroundColor: currentTheme.badgeBg,
                      color: currentTheme.badgeText,
                      borderColor: currentTheme.badgeBorder,
                    }}
                  >
                    v2.5
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 -mt-0.5 font-medium">
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
                style={{
                  backgroundColor: active === 'admin-dashboard' ? currentTheme.navActiveBg : undefined,
                  color: active === 'admin-dashboard' ? currentTheme.navActiveText : '#e2e8f0',
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  active === 'admin-dashboard'
                    ? 'shadow-md font-bold'
                    : 'hover:opacity-90'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" style={{ color: active === 'admin-dashboard' ? currentTheme.navActiveText : currentTheme.primary }} />
                <span>Dashboard</span>
              </button>

              {/* 2. Stock & Batch Master Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'stock' ? null : 'stock')}
                  style={{
                    backgroundColor: isStockActive || activeDropdown === 'stock' ? currentTheme.menuBg : undefined,
                    borderColor: isStockActive || activeDropdown === 'stock' ? currentTheme.primary : 'transparent',
                    color: isStockActive || activeDropdown === 'stock' ? currentTheme.menuItemText : '#e2e8f0',
                  }}
                  className="px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border hover:opacity-90 font-semibold"
                >
                  <Boxes className="w-4 h-4" style={{ color: currentTheme.primary }} />
                  <span>Stock &amp; Batch Master</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'stock' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'stock' && (
                  <div
                    style={{
                      backgroundColor: currentTheme.menuBg,
                      borderColor: currentTheme.menuBorder,
                    }}
                    className="absolute left-0 mt-2 w-72 rounded-xl shadow-2xl border p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div
                      style={{
                        borderColor: currentTheme.menuBorder,
                        color: currentTheme.primary,
                      }}
                      className="px-3 py-1.5 border-b mb-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <Package className="w-3 h-3" />
                      Inventory &amp; Warehousing
                    </div>

                    <button
                      onClick={() => handleNav('admin-inventory')}
                      style={{
                        backgroundColor: active === 'admin-inventory' ? currentTheme.menuHover : undefined,
                        borderColor: active === 'admin-inventory' ? currentTheme.primary : 'transparent',
                      }}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition theme-menu-hover text-slate-200 border"
                    >
                      <Boxes className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Batch Inventory Master</div>
                        <div className="text-[10px] text-slate-300">View live batch stock, expiry alerts, low stock</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-stockin')}
                      style={{
                        backgroundColor: active === 'admin-stockin' ? currentTheme.menuHover : undefined,
                        borderColor: active === 'admin-stockin' ? currentTheme.primary : 'transparent',
                      }}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition theme-menu-hover text-slate-200 border"
                    >
                      <Package className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Stock In &amp; New Batch Entry</div>
                        <div className="text-[10px] text-slate-300">Purchase inward, batch no, cost &amp; selling price</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-catalog')}
                      style={{
                        backgroundColor: active === 'admin-catalog' ? currentTheme.menuHover : undefined,
                        borderColor: active === 'admin-catalog' ? currentTheme.primary : 'transparent',
                      }}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition theme-menu-hover text-slate-200 border"
                    >
                      <Layers className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Master Product Catalog</div>
                        <div className="text-[10px] text-slate-300">Manage products, 4-image sliders, barcode IDs</div>
                      </div>
                    </button>

                    <div
                      style={{ borderColor: currentTheme.menuBorder }}
                      className="border-t mt-1 pt-1.5 px-2 flex items-center justify-between text-[11px] text-slate-300"
                    >
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
                  style={{
                    backgroundColor: isOrdersActive || activeDropdown === 'orders' ? currentTheme.menuBg : undefined,
                    borderColor: isOrdersActive || activeDropdown === 'orders' ? currentTheme.primary : 'transparent',
                    color: isOrdersActive || activeDropdown === 'orders' ? currentTheme.menuItemText : '#e2e8f0',
                  }}
                  className="px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border hover:opacity-90 font-semibold"
                >
                  <ShoppingCart className="w-4 h-4" style={{ color: currentTheme.primary }} />
                  <span>Orders &amp; Dispatch</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'orders' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'orders' && (
                  <div
                    style={{
                      backgroundColor: currentTheme.menuBg,
                      borderColor: currentTheme.menuBorder,
                    }}
                    className="absolute left-0 mt-2 w-72 rounded-xl shadow-2xl border p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div
                      style={{
                        borderColor: currentTheme.menuBorder,
                        color: currentTheme.primary,
                      }}
                      className="px-3 py-1.5 border-b mb-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <Truck className="w-3 h-3" />
                      Fulfillment &amp; Packing Operations
                    </div>

                    <button
                      onClick={() => handleNav('admin-orders', 'orders')}
                      style={{
                        backgroundColor: active === 'admin-orders' ? currentTheme.menuHover : undefined,
                        borderColor: active === 'admin-orders' ? currentTheme.primary : 'transparent',
                      }}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition theme-menu-hover text-slate-200 border"
                    >
                      <ShoppingCart className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">All Orders &amp; COD Processing</div>
                        <div className="text-[10px] text-slate-300">Order approval, packing status, delivery assign</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-orders', 'packing')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Warehouse Packing Slips</div>
                        <div className="text-[10px] text-slate-300">Batch-wise item picking slip &amp; barcodes</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-delivery-staff', 'delivery')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <Truck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Delivery Boy Management</div>
                        <div className="text-[10px] text-slate-300">Assign delivery boys, COD cash reconciliation</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Pantry & Financials Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'pantry' ? null : 'pantry')}
                  style={{
                    backgroundColor: isPantryActive || activeDropdown === 'pantry' ? currentTheme.menuBg : undefined,
                    borderColor: isPantryActive || activeDropdown === 'pantry' ? currentTheme.primary : 'transparent',
                    color: isPantryActive || activeDropdown === 'pantry' ? currentTheme.menuItemText : '#e2e8f0',
                  }}
                  className="px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border hover:opacity-90 font-semibold"
                >
                  <CreditCard className="w-4 h-4" style={{ color: currentTheme.primary }} />
                  <span>Pantry &amp; Finance</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'pantry' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'pantry' && (
                  <div
                    style={{
                      backgroundColor: currentTheme.menuBg,
                      borderColor: currentTheme.menuBorder,
                    }}
                    className="absolute left-0 mt-2 w-72 rounded-xl shadow-2xl border p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div
                      style={{
                        borderColor: currentTheme.menuBorder,
                        color: currentTheme.primary,
                      }}
                      className="px-3 py-1.5 border-b mb-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <CreditCard className="w-3 h-3" />
                      Pantry Credit &amp; Customer Ledger
                    </div>

                    <button
                      onClick={() => handleNav('admin-pantry-payments')}
                      style={{
                        backgroundColor: active === 'admin-pantry-payments' ? currentTheme.menuHover : undefined,
                        borderColor: active === 'admin-pantry-payments' ? currentTheme.primary : 'transparent',
                      }}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition theme-menu-hover text-slate-200 border"
                    >
                      <Receipt className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Pantry Pay &amp; Bills Admin</div>
                        <div className="text-[10px] text-slate-300">Approve payments, verify auditor collections</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-customers')}
                      style={{
                        backgroundColor: active === 'admin-customers' ? currentTheme.menuHover : undefined,
                        borderColor: active === 'admin-customers' ? currentTheme.primary : 'transparent',
                      }}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition theme-menu-hover text-slate-200 border"
                    >
                      <Users className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Customers 360° Management</div>
                        <div className="text-[10px] text-slate-300">Credit limits, pantry card activation &amp; details</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-customers', 'holdings')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <Wallet className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Customer Live Pantry Holdings</div>
                        <div className="text-[10px] text-slate-300">Monitor live items stock in customer pantries</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Auditor & Verification Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'auditor' ? null : 'auditor')}
                  style={{
                    backgroundColor: isAuditorActive || activeDropdown === 'auditor' ? currentTheme.menuBg : undefined,
                    borderColor: isAuditorActive || activeDropdown === 'auditor' ? currentTheme.primary : 'transparent',
                    color: isAuditorActive || activeDropdown === 'auditor' ? currentTheme.menuItemText : '#e2e8f0',
                  }}
                  className="px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border hover:opacity-90 font-semibold"
                >
                  <ClipboardCheck className="w-4 h-4" style={{ color: currentTheme.primary }} />
                  <span>Auditor &amp; Verification</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'auditor' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'auditor' && (
                  <div
                    style={{
                      backgroundColor: currentTheme.menuBg,
                      borderColor: currentTheme.menuBorder,
                    }}
                    className="absolute left-0 mt-2 w-72 rounded-xl shadow-2xl border p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div
                      style={{
                        borderColor: currentTheme.menuBorder,
                        color: currentTheme.primary,
                      }}
                      className="px-3 py-1.5 border-b mb-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      Auditor Field Operations &amp; Verification
                    </div>

                    <button
                      onClick={() => handleNav('admin-auditor-returns')}
                      style={{
                        backgroundColor: active === 'admin-auditor-returns' ? currentTheme.menuHover : undefined,
                        borderColor: active === 'admin-auditor-returns' ? currentTheme.primary : 'transparent',
                      }}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer transition theme-menu-hover text-slate-200 border"
                    >
                      <RotateCcw className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Auditor Return Claims Admin</div>
                        <div className="text-[10px] text-slate-300">Review &amp; approve auditor return requests</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-delivery-staff', 'auditors')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <UserCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Auditor Staff Management</div>
                        <div className="text-[10px] text-slate-300">Manage field auditors &amp; assigned routes</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNav('admin-reports', 'audits')}
                      className="w-full p-2.5 rounded-lg text-left flex items-start gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <FileCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: currentTheme.primary }} />
                      <div>
                        <div className="font-semibold text-xs text-white">Physical Pantry Audit Logs</div>
                        <div className="text-[10px] text-slate-300">Field visit reports, discrepancies &amp; proofs</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 6. Reports & Logs */}
              <button
                onClick={() => handleNav('admin-reports')}
                style={{
                  backgroundColor: active === 'admin-reports' ? currentTheme.menuBg : undefined,
                  borderColor: active === 'admin-reports' ? currentTheme.primary : 'transparent',
                  color: active === 'admin-reports' ? currentTheme.menuItemText : '#e2e8f0',
                }}
                className="px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border hover:opacity-90 font-semibold"
              >
                <BarChart3 className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                <span>Reports &amp; Logs</span>
              </button>

              {/* 7. Themes & Settings */}
              <button
                onClick={() => setShowThemeModal(true)}
                style={{
                  backgroundColor: currentTheme.menuBg,
                  borderColor: currentTheme.menuBorder,
                  color: currentTheme.menuItemText,
                }}
                className="px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border hover:opacity-90 shadow-xs"
                title="10 Ready-made ERP Themes & Colors"
              >
                <Palette className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                <span>Themes</span>
                <span
                  className="w-2 h-2 rounded-full shadow-3xs"
                  style={{ backgroundColor: currentTheme.primary }}
                />
              </button>

            </div>
          )}

          {/* CUSTOMER Navigation */}
          {role === 'CUSTOMER' && (
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
              <button
                onClick={() => handleNav('customer-store')}
                style={{
                  backgroundColor: active === 'customer-store' ? currentTheme.navActiveBg : currentTheme.menuBg,
                  color: active === 'customer-store' ? currentTheme.navActiveText : '#ffffff',
                  borderColor: currentTheme.menuBorder,
                }}
                className="px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm font-bold"
              >
                <ShoppingBag className="w-4 h-4" style={{ color: active === 'customer-store' ? currentTheme.navActiveText : currentTheme.primary }} />
                <span>Shop Fresh Groceries</span>
              </button>

              {/* My Profile All Sections Dropdown on PC */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'customerProfile' ? null : 'customerProfile')}
                  style={{
                    backgroundColor: activeDropdown === 'customerProfile' ? currentTheme.menuBg : currentTheme.headerBg,
                    borderColor: activeDropdown === 'customerProfile' ? currentTheme.primary : currentTheme.menuBorder,
                    color: activeDropdown === 'customerProfile' ? currentTheme.menuItemText : '#e2e8f0',
                  }}
                  className="px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border font-bold"
                >
                  <UserIcon className="w-4 h-4" style={{ color: currentTheme.primary }} />
                  <span>My Profile &amp; Passbook All Menu</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'customerProfile' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'customerProfile' && (
                  <div
                    style={{
                      backgroundColor: currentTheme.menuBg,
                      borderColor: currentTheme.menuBorder,
                    }}
                    className="absolute left-0 mt-2 w-72 rounded-xl shadow-2xl border p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div
                      style={{
                        borderColor: currentTheme.menuBorder,
                        color: currentTheme.primary,
                      }}
                      className="px-3 py-1.5 border-b mb-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <UserIcon className="w-3 h-3" />
                      Customer Account Sections
                    </div>

                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        if (onOpenProfile) onOpenProfile('profile');
                      }}
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <UserIcon className="w-4 h-4 shrink-0" style={{ color: currentTheme.primary }} />
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
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <Wallet className="w-4 h-4 shrink-0" style={{ color: currentTheme.primary }} />
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
                        className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                      >
                        <CreditCard className="w-4 h-4 shrink-0" style={{ color: currentTheme.primary }} />
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
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: currentTheme.primary }} />
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
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <MapPin className="w-4 h-4 shrink-0" style={{ color: currentTheme.primary }} />
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
                        className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                      >
                        <Boxes className="w-4 h-4 shrink-0" style={{ color: currentTheme.primary }} />
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
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <ShoppingBag className="w-4 h-4 shrink-0" style={{ color: currentTheme.primary }} />
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
                        className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                      >
                        <CreditCard className="w-4 h-4 shrink-0" style={{ color: currentTheme.primary }} />
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
                      className="w-full p-2 rounded-lg text-left flex items-center gap-2.5 cursor-pointer theme-menu-hover text-slate-200 transition"
                    >
                      <Truck className="w-4 h-4 shrink-0" style={{ color: currentTheme.primary }} />
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
                  style={{
                    backgroundColor: currentTheme.menuBg,
                    borderColor: currentTheme.menuBorder,
                    color: currentTheme.menuItemText,
                  }}
                  className="relative p-2 rounded-xl border transition cursor-pointer flex items-center gap-1 shadow-xs theme-menu-hover"
                  title="ERP Notification Center"
                >
                  <Bell className="w-4 h-4" style={{ color: currentTheme.primary }} />
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
                <div
                  style={{
                    backgroundColor: currentTheme.menuBg,
                    borderColor: currentTheme.menuBorder,
                  }}
                  className="absolute right-0 mt-2 w-64 rounded-xl shadow-2xl border py-2 z-50 animate-in fade-in duration-150"
                >
                  <div
                    style={{
                      borderColor: currentTheme.menuBorder,
                      color: currentTheme.menuItemSubtext,
                    }}
                    className="px-3 py-1.5 border-b text-[11px]"
                  >
                    Active User: <strong className="text-white font-semibold">{user?.name}</strong>
                    <div className="text-[10px] opacity-80 font-mono mt-0.5">+91 {user?.mobile}</div>
                  </div>

                  {role === 'CUSTOMER' && (
                    <div
                      style={{
                        backgroundColor: currentTheme.surfaceDark,
                        borderColor: currentTheme.menuBorder,
                      }}
                      className="border-b py-2 px-2"
                    >
                      <div className="px-1.5 py-1 text-[10px] uppercase font-bold" style={{ color: currentTheme.primary }}>
                        Customer Quick Links
                      </div>
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          if (onOpenProfile) onOpenProfile('profile');
                        }}
                        style={{ color: currentTheme.menuItemText }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold hover:opacity-90 flex items-center gap-2 cursor-pointer transition theme-menu-hover"
                      >
                        <UserIcon className="w-4 h-4" style={{ color: currentTheme.primary }} />
                        <span>Edit Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          if (onOpenProfile) onOpenProfile('wallet');
                        }}
                        style={{ color: currentTheme.menuItemText }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold hover:opacity-90 flex items-center gap-2 cursor-pointer transition theme-menu-hover"
                      >
                        <Wallet className="w-4 h-4" style={{ color: currentTheme.primary }} />
                        <span>Wallet &amp; Passbook</span>
                      </button>
                      {hasPantryAccess(customer) && (
                        <button
                          onClick={() => {
                            setShowRoleMenu(false);
                            if (onOpenProfile) onOpenProfile('ledger');
                          }}
                          style={{ color: currentTheme.menuItemText }}
                          className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold hover:opacity-90 flex items-center gap-2 cursor-pointer transition theme-menu-hover"
                        >
                          <CreditCard className="w-4 h-4" style={{ color: currentTheme.primary }} />
                          <span>Pantry Card Ledger</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div
                    style={{ color: currentTheme.menuItemSubtext }}
                    className="px-3 py-1 text-[10px] uppercase font-bold mt-1"
                  >
                    Quick Role Switcher
                  </div>

                  {/* ADMIN Option */}
                  <button
                    onClick={() => {
                      quickLoginAsRole('ADMIN');
                      setShowRoleMenu(false);
                      handleNav('admin-dashboard');
                    }}
                    style={{ color: currentTheme.menuItemText }}
                    className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer transition theme-menu-hover"
                  >
                    <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">ADMIN Dashboard</div>
                      <div className="text-[10px] opacity-80">Full ERP &amp; stock management</div>
                    </div>
                  </button>

                  {/* CUSTOMER Option */}
                  <button
                    onClick={() => {
                      quickLoginAsRole('CUSTOMER');
                      setShowRoleMenu(false);
                      handleNav('customer-store');
                    }}
                    style={{ color: currentTheme.menuItemText }}
                    className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer transition theme-menu-hover"
                  >
                    <ShoppingBag className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">CUSTOMER Portal</div>
                      <div className="text-[10px] opacity-80">Pantry Card, Quick COD</div>
                    </div>
                  </button>

                  {/* DELIVERY BOY Option */}
                  <button
                    onClick={() => {
                      quickLoginAsRole('DELIVERY_BOY');
                      setShowRoleMenu(false);
                      handleNav('delivery-portal');
                    }}
                    style={{ color: currentTheme.menuItemText }}
                    className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer transition theme-menu-hover"
                  >
                    <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">DELIVERY BOY</div>
                      <div className="text-[10px] opacity-80">Dispatches &amp; COD collection</div>
                    </div>
                  </button>

                  {/* AUDITOR Option */}
                  <button
                    onClick={() => {
                      quickLoginAsRole('AUDITOR');
                      setShowRoleMenu(false);
                      handleNav('auditor-portal');
                    }}
                    style={{ color: currentTheme.menuItemText }}
                    className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer transition theme-menu-hover"
                  >
                    <ClipboardCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">AUDITOR Portal</div>
                      <div className="text-[10px] opacity-80">Field visit &amp; pantry audits</div>
                    </div>
                  </button>

                  <div
                    style={{ borderColor: currentTheme.menuBorder }}
                    className="border-t mt-2 pt-1 px-2"
                  >
                    <button
                      onClick={handleResetSeeds}
                      disabled={resetting}
                      className="w-full text-left px-2 py-1.5 rounded text-[11px] text-amber-300 hover:opacity-90 flex items-center gap-1.5 cursor-pointer transition theme-menu-hover"
                    >
                      <RotateCcw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
                      Reset Test Seeds Data
                    </button>
                    <button
                      onClick={() => {
                        setShowRoleMenu(false);
                        logout();
                      }}
                      className="w-full text-left px-2 py-1.5 rounded text-[11px] text-rose-300 hover:opacity-90 flex items-center gap-1.5 cursor-pointer transition theme-menu-hover"
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
              style={{
                backgroundColor: currentTheme.menuBg,
                borderColor: currentTheme.menuBorder,
                color: currentTheme.menuItemText,
              }}
              className="lg:hidden p-2 rounded-xl border transition cursor-pointer theme-menu-hover"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: currentTheme.headerBg,
            borderBottom: `2px solid ${currentTheme.headerBorder}`,
          }}
          className="lg:hidden px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200"
        >
          {role === 'ADMIN' && (
            <div className="space-y-2 text-sm">
              <button
                onClick={() => handleNav('admin-dashboard')}
                style={{
                  backgroundColor: active === 'admin-dashboard' ? currentTheme.navActiveBg : currentTheme.menuBg,
                  color: active === 'admin-dashboard' ? currentTheme.navActiveText : currentTheme.menuItemText,
                  borderColor: currentTheme.menuBorder,
                }}
                className="w-full p-2.5 rounded-xl text-left font-bold flex items-center gap-2 border shadow-sm transition theme-menu-hover cursor-pointer"
              >
                <TrendingUp className="w-4 h-4" style={{ color: active === 'admin-dashboard' ? currentTheme.navActiveText : currentTheme.primary }} />
                <span>Executive Dashboard</span>
              </button>

              {/* Stock Accordion */}
              <div
                style={{
                  backgroundColor: currentTheme.menuBg,
                  borderColor: currentTheme.menuBorder,
                }}
                className="rounded-xl border overflow-hidden"
              >
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'stock' ? null : 'stock')}
                  style={{ color: currentTheme.menuItemText }}
                  className="w-full p-3 font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Boxes className="w-4 h-4" style={{ color: currentTheme.primary }} />
                    Stock &amp; Batch Master
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpandedSection === 'stock' ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpandedSection === 'stock' && (
                  <div
                    style={{
                      backgroundColor: currentTheme.surfaceDark,
                      borderColor: currentTheme.menuBorder,
                    }}
                    className="p-2 space-y-1 border-t text-xs"
                  >
                    <button
                      onClick={() => handleNav('admin-inventory')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <Boxes className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Batch Inventory Master</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-stockin')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <Package className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Stock In &amp; Batch Registration</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-catalog')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <Layers className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Master Product Catalog</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Orders Accordion */}
              <div
                style={{
                  backgroundColor: currentTheme.menuBg,
                  borderColor: currentTheme.menuBorder,
                }}
                className="rounded-xl border overflow-hidden"
              >
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'orders' ? null : 'orders')}
                  style={{ color: currentTheme.menuItemText }}
                  className="w-full p-3 font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" style={{ color: currentTheme.primary }} />
                    Orders &amp; Dispatch
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpandedSection === 'orders' ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpandedSection === 'orders' && (
                  <div
                    style={{
                      backgroundColor: currentTheme.surfaceDark,
                      borderColor: currentTheme.menuBorder,
                    }}
                    className="p-2 space-y-1 border-t text-xs"
                  >
                    <button
                      onClick={() => handleNav('admin-orders', 'orders')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>All Orders &amp; Dispatch</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-orders', 'packing')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <FileText className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Packing Slips &amp; Barcodes</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-delivery-staff', 'delivery')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <Truck className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Delivery Boys &amp; Staff</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Pantry & Financials Accordion */}
              <div
                style={{
                  backgroundColor: currentTheme.menuBg,
                  borderColor: currentTheme.menuBorder,
                }}
                className="rounded-xl border overflow-hidden"
              >
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'pantry' ? null : 'pantry')}
                  style={{ color: currentTheme.menuItemText }}
                  className="w-full p-3 font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" style={{ color: currentTheme.primary }} />
                    Pantry &amp; Finance
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpandedSection === 'pantry' ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpandedSection === 'pantry' && (
                  <div
                    style={{
                      backgroundColor: currentTheme.surfaceDark,
                      borderColor: currentTheme.menuBorder,
                    }}
                    className="p-2 space-y-1 border-t text-xs"
                  >
                    <button
                      onClick={() => handleNav('admin-pantry-payments')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <Receipt className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Pantry Pay Payments Admin</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-customers')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <Users className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Customer Management 360°</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-customers', 'holdings')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <Wallet className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Live Customer Pantry Holdings</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Auditor Accordion */}
              <div
                style={{
                  backgroundColor: currentTheme.menuBg,
                  borderColor: currentTheme.menuBorder,
                }}
                className="rounded-xl border overflow-hidden"
              >
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'auditor' ? null : 'auditor')}
                  style={{ color: currentTheme.menuItemText }}
                  className="w-full p-3 font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" style={{ color: currentTheme.primary }} />
                    Auditor &amp; Verification
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpandedSection === 'auditor' ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpandedSection === 'auditor' && (
                  <div
                    style={{
                      backgroundColor: currentTheme.surfaceDark,
                      borderColor: currentTheme.menuBorder,
                    }}
                    className="p-2 space-y-1 border-t text-xs"
                  >
                    <button
                      onClick={() => handleNav('admin-auditor-returns')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Auditor Return Claims</span>
                    </button>
                    <button
                      onClick={() => handleNav('admin-delivery-staff', 'auditors')}
                      style={{ color: currentTheme.menuItemText }}
                      className="w-full text-left p-2 rounded flex items-center gap-2 theme-menu-hover cursor-pointer transition"
                    >
                      <UserCheck className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                      <span>Auditor Staff Management</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleNav('admin-reports')}
                style={{
                  backgroundColor: currentTheme.menuBg,
                  borderColor: currentTheme.menuBorder,
                  color: currentTheme.menuItemText,
                }}
                className="w-full p-2.5 rounded-xl font-semibold text-left flex items-center gap-2 border theme-menu-hover cursor-pointer transition"
              >
                <BarChart3 className="w-4 h-4" style={{ color: currentTheme.primary }} />
                <span>Reports &amp; Logs Admin</span>
              </button>
            </div>
          )}

          {role === 'CUSTOMER' && (
            <div className="space-y-2">
              <button
                onClick={() => handleNav('customer-store')}
                style={{
                  backgroundColor: currentTheme.primary,
                  color: currentTheme.textOnPrimary,
                }}
                className="w-full p-3 rounded-xl font-bold flex items-center gap-2 shadow-md cursor-pointer transition hover:opacity-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Shop Fresh Groceries</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenProfile) onOpenProfile('profile');
                }}
                style={{
                  backgroundColor: currentTheme.menuBg,
                  borderColor: currentTheme.menuBorder,
                  color: currentTheme.menuItemText,
                }}
                className="w-full p-3 rounded-xl font-semibold flex items-center gap-2 border theme-menu-hover cursor-pointer transition"
              >
                <UserIcon className="w-4 h-4" style={{ color: currentTheme.primary }} />
                <span>My Profile &amp; Passbook</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
