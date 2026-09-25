import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  CreditCard,
  Package,
  Truck,
  User,
  ShoppingBag,
  Clock,
  ArrowRight,
  RefreshCw,
  Trash2,
  CheckCheck,
  X,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Search,
  Check,
  AlertCircle,
  TrendingUp,
  Inbox,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export interface AdminNotification {
  id: string;
  category: 'ORDER' | 'RETURN' | 'PAYMENT' | 'CUSTOMER' | 'REPLACEMENT' | 'INVENTORY' | 'AUDIT';
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  targetView: string;
  targetSubTab?: string;
  targetFilter?: string;
  badgeText?: string;
  actionLabel: string;
  amount?: number;
  customerName?: string;
  mobile?: string;
  refNumber?: string;
}

interface AdminNotificationCenterProps {
  onNavigate: (view: string, subTab?: string, filter?: string) => void;
  isDropdown?: boolean;
  onClose?: () => void;
}

const STORAGE_KEY = 'pantrymaster_admin_read_notifications';

export const AdminNotificationCenter: React.FC<AdminNotificationCenterProps> = ({
  onNavigate,
  isDropdown = false,
  onClose,
}) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const fetchAllNotifications = async () => {
    setLoading(true);
    try {
      const [orders, returns, payments, customers, batches, replacements, auditChecks] = await Promise.all([
        api.getOrders().catch(() => []),
        api.getAuditorReturnOrders().catch(() => []),
        api.getAllPantryPayments().catch(() => []),
        api.getCustomers().catch(() => []),
        api.getBatches().catch(() => []),
        api.getReplacements().catch(() => []),
        api.getAuditorChecks().catch(() => []),
      ]);

      const notifs: AdminNotification[] = [];

      // 1. Pending & Fresh Customer Orders (Pantry & Quick COD)
      orders
        .filter((o) => o.orderStatus === 'PENDING' || o.orderStatus === 'CONFIRMED' || o.orderStatus === 'READY_TO_SHIP')
        .forEach((o) => {
          notifs.push({
            id: `notif-order-${o.id}`,
            category: 'ORDER',
            title: `New Order #${o.id} (${o.orderType})`,
            description: `${o.customerName} placed an order of ${o.items?.length || 1} items totaling ₹${o.totalAmount?.toLocaleString('en-IN')}. Awaiting dispatch.`,
            timestamp: o.createdAt || 'Recent',
            isRead: readIds.has(`notif-order-${o.id}`),
            priority: 'HIGH',
            targetView: 'admin-orders',
            targetSubTab: o.orderType === 'PANTRY' ? 'pantry' : 'quick',
            targetFilter: 'PENDING',
            badgeText: `${o.orderType} Order`,
            actionLabel: 'Process Order',
            amount: o.totalAmount,
            customerName: o.customerName,
            refNumber: o.id,
          });
        });

      // 1b. Out for Delivery Orders
      orders
        .filter((o) => o.orderStatus === 'OUT_FOR_DELIVERY')
        .slice(0, 5)
        .forEach((o) => {
          notifs.push({
            id: `notif-order-ofd-${o.id}`,
            category: 'ORDER',
            title: `Order #${o.id} Out for Delivery`,
            description: `${o.customerName}'s order is with delivery agent ${o.assignedDeliveryBoyName || 'Staff'}.`,
            timestamp: o.updatedAt || o.createdAt || 'Recent',
            isRead: readIds.has(`notif-order-ofd-${o.id}`),
            priority: 'MEDIUM',
            targetView: 'admin-orders',
            targetSubTab: o.orderType === 'PANTRY' ? 'pantry' : 'quick',
            targetFilter: 'OUT_FOR_DELIVERY',
            badgeText: 'In Transit',
            actionLabel: 'Track Delivery',
            amount: o.totalAmount,
            customerName: o.customerName,
            refNumber: o.id,
          });
        });

      // 2. Customer Pantry Pay Payments Pending Confirmation
      payments
        .filter((p) => p.auditorConfirmationStatus === 'PENDING')
        .forEach((p) => {
          const isRecharge = p.isWalletRecharge || p.paymentType === 'WALLET_RECHARGE' || p.productId?.startsWith('WALLET-');
          notifs.push({
            id: `notif-pay-${p.id}`,
            category: 'PAYMENT',
            title: `Pantry Pay: ₹${p.amount?.toLocaleString('en-IN')} Received`,
            description: `${p.customerName} (+91 ${p.customerMobile}) paid ₹${p.amount} via ${p.paymentMethod || 'UPI'} for ${isRecharge ? 'Wallet Recharge' : p.productName} (UTR: ${p.transactionRef || 'N/A'}).`,
            timestamp: p.createdAt || 'Recent',
            isRead: readIds.has(`notif-pay-${p.id}`),
            priority: 'HIGH',
            targetView: 'admin-pantry-payments',
            targetFilter: 'PENDING',
            badgeText: isRecharge ? 'Recharge UTR' : 'Item Payment',
            actionLabel: 'Accept & Confirm',
            amount: p.amount,
            customerName: p.customerName,
            mobile: p.customerMobile,
            refNumber: p.transactionRef,
          });
        });

      // 3. Auditor Return Orders Pending Admin Acceptance or Stock Restoration
      returns
        .filter((r) => r.status === 'PENDING' || (!r.stockRestored && r.status !== 'REJECTED'))
        .forEach((r) => {
          const needsAccept = r.status === 'PENDING';
          const needsRestore = !r.stockRestored && (r.status === 'COLLECTED' || r.status === 'ACCEPTED');
          notifs.push({
            id: `notif-return-${r.id}`,
            category: 'RETURN',
            title: `Auditor Return Order #${r.id} (${r.status})`,
            description: `${r.auditorName} returned ${r.returnQuantity}x ${r.productName} for ${r.customerName}. Batch: #${r.batchNumber}. ${needsRestore ? 'Needs warehouse stock restore.' : 'Awaiting approval.'}`,
            timestamp: r.createdAt || r.returnDate || 'Recent',
            isRead: readIds.has(`notif-return-${r.id}`),
            priority: needsAccept ? 'HIGH' : 'MEDIUM',
            targetView: 'admin-auditor-returns',
            targetFilter: r.status,
            badgeText: needsAccept ? 'Accept Needed' : needsRestore ? 'Restore Stock' : r.status,
            actionLabel: needsAccept ? 'Accept Return' : 'Restore Stock',
            customerName: r.customerName,
            refNumber: r.id,
          });
        });

      // 4. Replacement Requests Pending
      replacements
        .filter((rep) => rep.status === 'PENDING')
        .forEach((rep) => {
          notifs.push({
            id: `notif-rep-${rep.id}`,
            category: 'REPLACEMENT',
            title: `Replacement Request #${rep.id}`,
            description: `${rep.quantity}x ${rep.productName} requested for replacement by ${rep.customerName}. Reason: ${rep.reason || 'Not specified'}.`,
            timestamp: rep.createdAt || 'Recent',
            isRead: readIds.has(`notif-rep-${rep.id}`),
            priority: 'HIGH',
            targetView: 'admin-orders',
            targetSubTab: 'replacements',
            badgeText: 'Replacement Due',
            actionLabel: 'Dispatch Replacement',
            customerName: rep.customerName,
            refNumber: rep.id,
          });
        });

      // 5. Auditor Check / Audit Bills Submitted
      if (Array.isArray(auditChecks)) {
        auditChecks.slice(0, 5).forEach((ac: any) => {
          if (ac.hasDiscrepancy || ac.status === 'PENDING_CUSTOMER_CONFIRMATION') {
            notifs.push({
              id: `notif-audit-${ac.id}`,
              category: 'AUDIT',
              title: `Field Audit #${ac.id} (${ac.customerName || 'Customer'})`,
              description: `Audit conducted by ${ac.auditorName || 'Auditor'}. Discrepancy noted in pantry stock.`,
              timestamp: ac.createdAt || ac.checkDate || 'Recent',
              isRead: readIds.has(`notif-audit-${ac.id}`),
              priority: 'MEDIUM',
              targetView: 'admin-reports',
              targetSubTab: 'audits',
              badgeText: 'Audit Discrepancy',
              actionLabel: 'Review Audit',
              customerName: ac.customerName,
              refNumber: ac.id,
            });
          }
        });
      }

      // 6. Low Stock / Expired Batches
      const now = new Date();
      batches
        .filter((b) => {
          const exp = b.expiryDate ? new Date(b.expiryDate) : null;
          const isExpired = exp ? exp < now : false;
          const daysToExpiry = exp ? (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) : 999;
          const isNear = daysToExpiry <= 30 && daysToExpiry > 0;
          return b.availableQuantity <= 5 || isExpired || isNear;
        })
        .slice(0, 8)
        .forEach((b) => {
          const exp = b.expiryDate ? new Date(b.expiryDate) : null;
          const isExpired = exp ? exp < now : false;
          const isLow = b.availableQuantity <= 5;
          notifs.push({
            id: `notif-batch-${b.id}`,
            category: 'INVENTORY',
            title: isExpired ? `Expired Batch Alert: ${b.productName}` : isLow ? `Low Stock Alert: ${b.productName}` : `Near Expiry Alert: ${b.productName}`,
            description: `Batch #${b.batchNumber} has only ${b.availableQuantity} units left. Expiry: ${b.expiryDate}.`,
            timestamp: b.updatedAt || 'Current',
            isRead: readIds.has(`notif-batch-${b.id}`),
            priority: isExpired ? 'HIGH' : 'MEDIUM',
            targetView: 'admin-inventory',
            targetFilter: isLow ? 'LOW_STOCK' : 'NEAR_EXPIRY',
            badgeText: isExpired ? 'Expired' : isLow ? 'Low Stock' : 'Expiry Warning',
            actionLabel: 'View Inventory',
            refNumber: b.batchNumber,
          });
        });

      // 7. Recent Customer Registrations
      const recentCusts = [...customers].sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 6);
      recentCusts.forEach((c) => {
        notifs.push({
          id: `notif-cust-${c.id}`,
          category: 'CUSTOMER',
          title: `New Customer Account: ${c.fullName}`,
          description: `Customer #${c.id} (+91 ${c.mobile}) registered. Credit Limit: ₹${c.availablePantryLimit?.toLocaleString('en-IN') || 0}.`,
          timestamp: c.createdAt || 'Recent',
          isRead: readIds.has(`notif-cust-${c.id}`),
          priority: 'LOW',
          targetView: 'admin-customers',
          badgeText: 'New Customer',
          actionLabel: 'View Customer 360°',
          customerName: c.fullName,
          mobile: c.mobile,
          refNumber: c.id,
        });
      });

      // Sort: Unread first, then HIGH priority, then newest
      notifs.sort((a, b) => {
        if (!a.isRead && b.isRead) return -1;
        if (a.isRead && !b.isRead) return 1;
        if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
        if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
        return 0;
      });

      setNotifications(notifs);
    } catch (err) {
      console.error('Error fetching admin notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllNotifications();
  }, [readIds]);

  const markAsRead = (id: string) => {
    const updated = new Set(readIds);
    updated.add(id);
    setReadIds(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(updated)));
    } catch {}
  };

  const markAllAsRead = () => {
    const updated = new Set(readIds);
    notifications.forEach((n) => updated.add(n.id));
    setReadIds(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(updated)));
    } catch {}
  };

  const clearReadNotifications = () => {
    setNotifications((prev) => prev.filter((n) => !readIds.has(n.id)));
  };

  const handleNotificationClick = (notif: AdminNotification) => {
    markAsRead(notif.id);
    if (onClose) onClose();
    onNavigate(notif.targetView, notif.targetSubTab, notif.targetFilter);
  };

  const filteredNotifs = notifications.filter((n) => {
    // Category filter
    if (activeCategory === 'UNREAD' && n.isRead) return false;
    if (activeCategory !== 'ALL' && activeCategory !== 'UNREAD' && n.category !== activeCategory) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        (n.customerName && n.customerName.toLowerCase().includes(q)) ||
        (n.mobile && n.mobile.toLowerCase().includes(q)) ||
        (n.refNumber && n.refNumber.toLowerCase().includes(q)) ||
        (n.badgeText && n.badgeText.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const categories = [
    { id: 'ALL', label: 'All', count: notifications.length },
    { id: 'UNREAD', label: 'Unread', count: unreadCount },
    { id: 'PAYMENT', label: 'Pantry Pay', count: notifications.filter((n) => n.category === 'PAYMENT').length },
    { id: 'ORDER', label: 'Orders', count: notifications.filter((n) => n.category === 'ORDER').length },
    { id: 'RETURN', label: 'Auditor Returns', count: notifications.filter((n) => n.category === 'RETURN').length },
    { id: 'CUSTOMER', label: 'Customers', count: notifications.filter((n) => n.category === 'CUSTOMER').length },
    { id: 'INVENTORY', label: 'Stock Alerts', count: notifications.filter((n) => n.category === 'INVENTORY').length },
    { id: 'AUDIT', label: 'Audits', count: notifications.filter((n) => n.category === 'AUDIT').length },
    { id: 'REPLACEMENT', label: 'Replacements', count: notifications.filter((n) => n.category === 'REPLACEMENT').length },
  ];

  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const handleStepCategory = (direction: 'prev' | 'next') => {
    const currentIndex = categories.findIndex((c) => c.id === activeCategory);
    let nextIndex = 0;
    if (direction === 'prev') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : categories.length - 1;
    } else {
      nextIndex = currentIndex < categories.length - 1 ? currentIndex + 1 : 0;
    }
    const target = categories[nextIndex];
    if (target) {
      setActiveCategory(target.id);
      if (tabsContainerRef.current) {
        const activeEl = tabsContainerRef.current.children[nextIndex] as HTMLElement;
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }
    }
  };

  const handleScrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      tabsContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ORDER':
        return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
      case 'RETURN':
        return <RotateCcw className="w-4 h-4 text-purple-600" />;
      case 'PAYMENT':
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'CUSTOMER':
        return <User className="w-4 h-4 text-cyan-600" />;
      case 'REPLACEMENT':
        return <RefreshCw className="w-4 h-4 text-amber-600" />;
      case 'INVENTORY':
        return <Package className="w-4 h-4 text-rose-600" />;
      case 'AUDIT':
        return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div
      className={`flex flex-col bg-white ${
        isDropdown
          ? 'w-full max-w-md max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200'
          : 'w-full rounded-2xl border border-slate-200 shadow-xs space-y-4'
      }`}
    >
      {/* Header */}
      <div
        className={`p-4 border-b border-slate-200 flex items-center justify-between ${
          isDropdown ? 'bg-slate-900 text-white rounded-t-2xl' : 'bg-white text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative p-2 rounded-xl bg-purple-100 text-purple-700 font-bold">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full absolute -top-0.5 -right-0.5 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm tracking-tight">Admin Notification &amp; Action Hub</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Live event stream with 1-click navigation to orders, payments, returns, audits &amp; signups.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition cursor-pointer flex items-center gap-1 ${
                isDropdown
                  ? 'border-purple-600 text-purple-300 hover:bg-slate-800'
                  : 'border-slate-200 text-purple-700 bg-purple-50 hover:bg-purple-100'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            onClick={fetchAllNotifications}
            disabled={loading}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isDropdown
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="Refresh Feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 cursor-pointer rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 pt-1 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search notifications by order, customer, UTR, return, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs with Left & Right Navigation Buttons */}
      <div className="px-2 py-1.5 border-b border-slate-200 bg-slate-50/80 flex items-center gap-1">
        {/* Left Nav Button */}
        <button
          onClick={() => handleStepCategory('prev')}
          onDoubleClick={() => handleScrollTabs('left')}
          title="Previous Category (Left) - Click to Select Prev Tab / Scroll"
          className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 text-slate-600 transition shadow-2xs shrink-0 cursor-pointer flex items-center justify-center group"
          aria-label="Previous category"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
        </button>

        {/* Scrollable Tabs List */}
        <div
          ref={tabsContainerRef}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 scroll-smooth"
        >
          {categories.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveCategory(tab.id);
                }}
                className={`px-3 py-1 rounded-full font-bold transition cursor-pointer shrink-0 text-xs flex items-center gap-1.5 select-none ${
                  isActive
                    ? 'bg-purple-700 text-white shadow-xs ring-2 ring-purple-300'
                    : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-purple-700 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                      isActive
                        ? 'bg-purple-900/60 text-purple-100'
                        : tab.count > 0 && (tab.id === 'UNREAD' || tab.id === 'PAYMENT' || tab.id === 'ORDER')
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Nav Button */}
        <button
          onClick={() => handleStepCategory('next')}
          onDoubleClick={() => handleScrollTabs('right')}
          title="Next Category (Right) - Click to Select Next Tab / Scroll"
          className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 text-slate-600 transition shadow-2xs shrink-0 cursor-pointer flex items-center justify-center group"
          aria-label="Next category"
        >
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
        </button>
      </div>

      {/* Notification List Body */}
      <div
        className={`flex-1 overflow-y-auto divide-y divide-slate-100 ${
          isDropdown ? 'max-h-96' : 'min-h-[300px]'
        }`}
      >
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-purple-600" />
            <p className="font-bold text-slate-700">Checking pending ERP activities...</p>
            <p className="text-[11px] text-slate-400">Scanning orders, payments, returns, audits, and customer registrations</p>
          </div>
        ) : filteredNotifs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">No Notifications Found</p>
            <p className="text-[11px] text-slate-400">
              {searchQuery
                ? 'No notifications match your search query.'
                : 'All operational activities are up to date!'}
            </p>
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-4 flex items-start gap-3 transition cursor-pointer hover:bg-purple-50/60 group ${
                !notif.isRead ? 'bg-purple-50/25 border-l-3 border-l-purple-600' : 'bg-white'
              }`}
            >
              {/* Category Icon */}
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 shrink-0 mt-0.5 group-hover:scale-105 transition shadow-2xs">
                {getCategoryIcon(notif.category)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4
                    className={`text-xs truncate ${
                      !notif.isRead ? 'font-black text-slate-900' : 'font-bold text-slate-700'
                    }`}
                  >
                    {notif.title}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!notif.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0 shadow-xs" />
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">{notif.timestamp}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  {notif.description}
                </p>

                {/* Meta details & Direct Action Link */}
                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {notif.badgeText && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                        {notif.badgeText}
                      </span>
                    )}
                    {notif.amount !== undefined && (
                      <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        ₹{notif.amount.toLocaleString('en-IN')}
                      </span>
                    )}
                    {notif.mobile && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        📞 +91 {notif.mobile}
                      </span>
                    )}
                  </div>

                  {/* Direct Link Button */}
                  <span className="text-xs font-black text-purple-700 group-hover:text-purple-900 flex items-center gap-1 bg-purple-50 group-hover:bg-purple-100 px-2.5 py-1 rounded-lg transition shrink-0 shadow-2xs">
                    <span>{notif.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllNotifications}
            className="flex items-center gap-1.5 text-slate-700 hover:text-purple-700 font-bold cursor-pointer text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Live ERP Feeds</span>
          </button>
          {readIds.size > 0 && (
            <button
              onClick={clearReadNotifications}
              className="text-[11px] text-slate-400 hover:text-rose-600 transition cursor-pointer ml-2"
            >
              Clear read from view
            </button>
          )}
        </div>

        <span className="text-[10px] text-slate-400 font-semibold">
          Showing {filteredNotifs.length} items
        </span>
      </div>
    </div>
  );
};
