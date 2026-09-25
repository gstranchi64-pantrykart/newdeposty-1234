import React, { useState, useEffect } from 'react';
import {
  Customer,
  Order,
  WalletTransaction,
  PantryCreditLedger,
  AuditorCheck,
  PantryCardItem,
  hasPantryAccess,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PantryPayScannerUI } from './PantryPayScannerUI';
import { AppWindowModal } from '../common/AppWindowModal';
import { AuditBillModal } from '../common/AuditBillModal';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { filterUsedPantryItems } from '../../utils/pantryHelpers';
import {
  User as UserIcon,
  MapPin,
  CreditCard,
  ShoppingBag,
  LogOut,
  Camera,
  Check,
  X,
  Phone,
  Mail,
  Building,
  Clock,
  Calendar,
  Truck,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Save,
  Wallet,
  Navigation,
  Lock,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  ClipboardCheck,
  RefreshCw,
  Search,
  Filter,
  CheckCheck,
  Info,
  ChevronRight,
  Eye,
  Boxes,
  Package,
  Barcode,
  DollarSign,
  Tag,
  Sparkles,
} from 'lucide-react';
import { parseOrderDate, formatOrderDateTime, getOrderPreciseTimestamp, getDeliveryDayCount } from '../../utils/dateTimeUtils';
import { CreditLimitDetailModal, LimitMetricTab } from './CreditLimitDetailModal';
import { WalletDetailModal, WalletMetricTab } from './WalletDetailModal';

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?:
    | 'profile'
    | 'address'
    | 'wallet'
    | 'ledger'
    | 'audits'
    | 'stock'
    | 'history'
    | 'pantry'
    | 'pantryPay'
    | 'tracking';
  onNavigateToOrders?: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
];

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'profile',
  onNavigateToOrders,
}) => {
  const { customer, user, logout, updateCustomerState } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | 'profile'
    | 'address'
    | 'wallet'
    | 'ledger'
    | 'audits'
    | 'stock'
    | 'history'
    | 'pantry'
    | 'pantryPay'
    | 'tracking'
  >(
    !hasPantryAccess(customer) && (defaultTab === 'pantry' || defaultTab === 'pantryPay' || defaultTab === 'ledger' || defaultTab === 'stock')
      ? 'profile'
      : defaultTab
  );

  // Form states
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');

  // Address states
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [walletTxns, setWalletTxns] = useState<WalletTransaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [pantryLedger, setPantryLedger] = useState<PantryCreditLedger[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [auditorChecks, setAuditorChecks] = useState<AuditorCheck[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [pantryItems, setPantryItems] = useState<
    (PantryCardItem & {
      daysSinceDelivery?: number;
      isReturnEligible?: boolean;
      isNearExpiry?: boolean;
      isExpired?: boolean;
    })[]
  >([]);
  const [pantryLoading, setPantryLoading] = useState(false);
  const [stockSubTab, setStockSubTab] = useState<'inStock' | 'used' | 'breakdown'>('inStock');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [metricModalTab, setMetricModalTab] = useState<LimitMetricTab | null>(null);
  const [walletModalTab, setWalletModalTab] = useState<WalletMetricTab | null>(null);

  // Filter & Search states
  const [walletFilter, setWalletFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'ORDER_DEBIT' | 'PAYMENT_CREDIT' | 'AUDIT_DEDUCTION'>('ALL');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  // Action states
  const [saving, setSaving] = useState(false);
  const [approvingAuditId, setApprovingAuditId] = useState<string | null>(null);
  const [selectedAuditForBill, setSelectedAuditForBill] = useState<AuditorCheck | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (customer) {
      setFullName(customer.fullName || '');
      setMobile(customer.mobile || '');
      setEmail(customer.email || '');
      setAlternateMobile(customer.alternateMobile || '');
      setProfilePhoto(customer.profilePhoto || '');

      setAddress(customer.address || '');
      setArea(customer.area || '');
      setLandmark(customer.landmark || '');
      setCity(customer.city || '');
      setState(customer.state || '');
      setPinCode(customer.pinCode || '');
    }
  }, [customer, isOpen]);

  useEffect(() => {
    if (isOpen && customer) {
      fetchAllCustomerData();
    }
  }, [isOpen, customer?.id]);

  const fetchAllCustomerData = async () => {
    if (!customer) return;
    fetchOrders();
    fetchWalletTransactions();
    fetchPantryLedger();
    fetchAuditorChecks();
    fetchPantryItems();
  };

  const fetchPantryItems = async () => {
    if (!customer) return;
    setPantryLoading(true);
    try {
      const items = await api.getPantryCard(customer.id);
      setPantryItems(items);
    } catch (err) {
      console.error('Error loading pantry items:', err);
    } finally {
      setPantryLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!customer) return;
    setOrdersLoading(true);
    try {
      const list = await api.getOrders({ customerId: customer.id });
      setOrders(list);
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchWalletTransactions = async () => {
    if (!customer) return;
    setWalletLoading(true);
    try {
      const txns = await api.getWalletTransactions(customer.id);
      setWalletTxns(txns);
    } catch (err) {
      console.error('Error loading wallet transactions:', err);
    } finally {
      setWalletLoading(false);
    }
  };

  const fetchPantryLedger = async () => {
    if (!customer) return;
    setLedgerLoading(true);
    try {
      const ledger = await api.getPantryLedger(customer.id);
      setPantryLedger(ledger);
    } catch (err) {
      console.error('Error loading pantry ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchAuditorChecks = async () => {
    if (!customer) return;
    setAuditsLoading(true);
    try {
      const checks = await api.getAuditorChecks(customer.id);
      setAuditorChecks(checks);
    } catch (err) {
      console.error('Error loading auditor checks:', err);
    } finally {
      setAuditsLoading(false);
    }
  };

  if (!isOpen || !customer) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.updateCustomer(customer.id, {
        fullName,
        mobile,
        email,
        alternateMobile,
        profilePhoto,
      });
      updateCustomerState(updated);
      setMessage({ text: 'Profile details updated successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update profile', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.updateCustomer(customer.id, {
        address,
        area,
        landmark,
        city,
        state,
        pinCode,
      });
      updateCustomerState(updated);
      setMessage({ text: 'Delivery address updated successfully! Future orders will use this address.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update address', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Customer Audit Approval Handler
  const handleApproveAuditPermission = async (auditId: string) => {
    setApprovingAuditId(auditId);
    try {
      const updated = await api.confirmAuditByCustomer(auditId);
      setAuditorChecks((prev) => prev.map((a) => (a.id === auditId ? updated : a)));
      setMessage({
        text: `✓ Audit Permission Granted! Auditor ${updated.auditorName} has been authorized for verification on ${updated.requestedDate}.`,
        type: 'success',
      });
      fetchAuditorChecks();
    } catch (err: any) {
      setMessage({
        text: err.message || 'Failed to confirm audit permission.',
        type: 'error',
      });
    } finally {
      setApprovingAuditId(null);
    }
  };

  const handleApproveAuditBill = async (auditId: string) => {
    setApprovingAuditId(auditId);
    try {
      const updated = await api.confirmAuditBill(auditId);
      setAuditorChecks((prev) => prev.map((a) => (a.id === auditId || a.billId === auditId ? updated : a)));
      setMessage({
        text: `✓ Audit Bill Confirmed & Permanently Locked! Discrepancy deductions have been processed from your wallet.`,
        type: 'success',
      });
      // Refresh customer profile, wallet, and ledger states
      try {
        const balanceData = await api.getWalletBalance(customer.id);
        if (balanceData && typeof balanceData.walletBalance === 'number') {
          updateCustomerState({ ...customer, walletBalance: balanceData.walletBalance });
        }
        await Promise.all([
          fetchWalletTransactions(),
          fetchPantryLedger(),
          fetchAuditorChecks(),
        ]);
      } catch (e) {
        console.warn('Error refreshing customer wallet after bill confirmation:', e);
      }
      return updated;
    } catch (err: any) {
      setMessage({
        text: err.message || 'Failed to confirm audit bill.',
        type: 'error',
      });
    } finally {
      setApprovingAuditId(null);
    }
  };

  const handleDisputeAuditBill = async (auditId: string, remarks: string) => {
    try {
      const updated = await api.disputeAuditBill(auditId, remarks);
      setAuditorChecks((prev) =>
        prev.map((a) => (a.id === auditId || a.billId === auditId ? updated : a))
      );
      setMessage({
        text: `Audit Bill rejected and sent back to Field Auditor with your remarks for revision.`,
        type: 'success',
      });
      fetchAuditorChecks();
      return updated;
    } catch (err: any) {
      setMessage({
        text: err.message || 'Failed to reject audit bill.',
        type: 'error',
      });
      throw err;
    }
  };

  const sortOrdersByNewest = (list: Order[]) => {
    return [...list].sort((a, b) => {
      const tsA = getOrderPreciseTimestamp(a);
      const tsB = getOrderPreciseTimestamp(b);
      const dateA = parseOrderDate(tsA);
      const dateB = parseOrderDate(tsB);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });
  };

  const codOrders = sortOrdersByNewest(orders.filter((o) => o.orderType === 'QUICK'));
  const pantryOrders = sortOrdersByNewest(orders.filter((o) => o.orderType === 'PANTRY'));

  // Separate Pending Visit Permissions vs Pending Audit Bills awaiting Customer Inspection & Locking
  const pendingVisitPermissionAudits = auditorChecks.filter(
    (a) =>
      !a.isPermissionGranted &&
      (a.status === 'REQUESTED' || a.status === 'CUSTOMER_PENDING' || a.status === 'SCHEDULED') &&
      !a.billGeneratedAt &&
      !a.billId
  );

  const pendingBillConfirmationAudits = auditorChecks.filter(
    (a) =>
      !a.isBillLocked &&
      !a.isBillConfirmed &&
      (a.billStatus === 'CUSTOMER_PENDING_CONFIRMATION' ||
        a.status === 'CUSTOMER_PENDING_CONFIRMATION' ||
        a.status === 'PENDING_CONFIRMATION' ||
        (!!a.billId && a.status !== 'COMPLETED' && a.status !== 'LOCKED'))
  );

  const pendingConfirmationAudits = [...pendingVisitPermissionAudits, ...pendingBillConfirmationAudits];

  // Helper to format Date and Time with exact minutes and seconds
  const formatFullDateTimeWithSeconds = (
    dateStr?: string,
    timeStr?: string,
    timestamp?: string,
    createdAt?: string
  ) => {
    if (timestamp) {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
      }
    }
    if (createdAt) {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
      }
    }
    if (dateStr && timeStr) {
      return `${dateStr} • ${timeStr}`;
    }
    if (dateStr) {
      return dateStr;
    }
    return 'Just now';
  };

  // Filtered & Sorted Wallet Transactions (Always latest first, ensuring latest closing balance is on TOP)
  const filteredWalletTxns = [...walletTxns]
    .sort((a, b) => {
      const timeA = a.timestamp
        ? new Date(a.timestamp).getTime()
        : a.date
        ? new Date(`${a.date} ${a.time || '00:00:00'}`).getTime()
        : 0;
      const timeB = b.timestamp
        ? new Date(b.timestamp).getTime()
        : b.date
        ? new Date(`${b.date} ${b.time || '00:00:00'}`).getTime()
        : 0;
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    })
    .filter((t) => {
      if (walletFilter === 'ALL') return true;
      const isCredit =
        t.transactionType === 'ADMIN_RECHARGE' ||
        t.transactionType === 'OPENING_BALANCE' ||
        t.transactionType === 'REFUND_IF_APPLICABLE' ||
        t.amount > 0;
      return walletFilter === 'CREDIT' ? isCredit : !isCredit;
    });

  // Filtered & Sorted Pantry Credit Ledger (Always latest first, ensuring latest closing limit is on TOP)
  const filteredLedger = [...pantryLedger]
    .sort((a, b) => {
      const timeA = a.createdAt
        ? new Date(a.createdAt).getTime()
        : a.date
        ? new Date(`${a.date} ${a.time || '00:00:00'}`).getTime()
        : 0;
      const timeB = b.createdAt
        ? new Date(b.createdAt).getTime()
        : b.date
        ? new Date(`${b.date} ${b.time || '00:00:00'}`).getTime()
        : 0;
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    })
    .filter((l) => {
      if (ledgerFilter === 'ALL') return true;
      if (ledgerFilter === 'ORDER_DEBIT') return l.transactionType === 'PANTRY_ORDER_DEBIT' || (l as any).type === 'ORDER_DEBIT';
      if (ledgerFilter === 'PAYMENT_CREDIT') return l.transactionType === 'AUDIT_CREDIT_RESTORE' || l.transactionType === 'RETURN_CREDIT' || (l as any).type === 'PAYMENT_CREDIT';
      if (ledgerFilter === 'AUDIT_DEDUCTION') return (l as any).transactionType === 'AUDIT_DEDUCTION' || (l as any).type === 'AUDIT_DEDUCTION';
      return true;
    });

  // Filtered Audits
  const filteredAudits = auditorChecks.filter((a) => {
    if (auditFilter === 'ALL') return true;
    if (auditFilter === 'PENDING') {
      return (
        a.status === 'REQUESTED' ||
        a.status === 'CUSTOMER_PENDING' ||
        a.status === 'PENDING_CONFIRMATION' ||
        !a.isPermissionGranted
      );
    }
    return a.status === 'COMPLETED' || a.status === 'BILL_CONFIRMED' || a.status === 'LOCKED' || a.status === 'IN_PROGRESS';
  });

  // Calculate wallet summary statistics
  const totalWalletRecharge = walletTxns
    .filter(
      (t) =>
        t.transactionType === 'ADMIN_RECHARGE' ||
        t.transactionType === 'OPENING_BALANCE' ||
        t.transactionType === 'REFUND_IF_APPLICABLE' ||
        t.amount > 0
    )
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalWalletDeductions = walletTxns
    .filter(
      (t) =>
        t.transactionType === 'AUDIT_DEDUCTION' ||
        t.transactionType === 'ADMIN_ADJUSTMENT' ||
        t.amount < 0
    )
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <AppWindowModal
      isOpen={isOpen}
      onClose={onClose}
      title={customer.fullName}
      subtitle={`Customer ID: ${customer.id} • Mobile: +91 ${customer.mobile}`}
      icon={<UserIcon className="w-5 h-5 text-emerald-400" />}
      size="2xl"
      badge={
        <div className="flex items-center gap-2">
          {pendingConfirmationAudits.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {pendingConfirmationAudits.length} Audit Permission Pending
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            {customer.status}
          </span>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Top Header Card with Quick Stats & Audit Alert */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 relative flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* User Avatar & Info */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-800 border-2 border-emerald-500 shadow-md flex items-center justify-center shrink-0">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-emerald-400" />
                  )}
                </div>
                <button
                  onClick={() => setActiveTab('profile')}
                  className="absolute -bottom-1 -right-1 p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs shadow-xs cursor-pointer"
                  title="Change Avatar"
                >
                  <Camera className="w-3 h-3" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white tracking-tight">{customer.fullName}</h2>
                  {customer.isChild ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-300 border border-purple-400/40">
                      {customer.relationInfo || 'Family Member'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      Primary Household Account
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-3">
                  <span>ID: {customer.id}</span>
                  <span>•</span>
                  <span>+91 {customer.mobile}</span>
                </div>
              </div>
            </div>

            {/* Wallet & Limit Quick Metrics Cards */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Wallet Card */}
              <button
                type="button"
                onClick={() => { setActiveTab('wallet'); setMessage(null); }}
                className="flex items-center gap-2.5 bg-slate-800/90 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-2.5 px-3 text-left transition cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider group-hover:text-emerald-300">
                    Wallet Balance
                  </div>
                  <div className="font-extrabold text-emerald-400 text-base leading-tight">
                    ₹{(customer.walletBalance ?? 1000).toLocaleString('en-IN')}
                  </div>
                </div>
              </button>

              {/* Pantry Limit Card */}
              {hasPantryAccess(customer) && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('ledger'); setMessage(null); }}
                  className="flex items-center gap-2.5 bg-slate-800/90 hover:bg-slate-800 border border-purple-500/30 hover:border-purple-500/60 rounded-2xl p-2.5 px-3 text-left transition cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider group-hover:text-purple-300">
                      Pantry Limit
                    </div>
                    <div className="font-extrabold text-purple-300 text-base leading-tight">
                      ₹{customer.availablePantryLimit.toLocaleString('en-IN')}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        / ₹{customer.pantryLimit.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Pending Audit Permission Alert Banner */}
          {pendingConfirmationAudits.length > 0 && (
            <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <span>
                  <strong>Auditor Inspection Pending:</strong> An auditor has scheduled physical verification. Your permission is required before they can start.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('audits');
                  setMessage(null);
                }}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer shrink-0 shadow-xs"
              >
                Approve Permission Now
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation Strip - Displays all tabs on large PC screens via lg:flex-wrap */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 pt-3 flex items-center gap-1.5 overflow-x-auto lg:flex-wrap text-xs font-semibold scrollbar-none">
          <button
            onClick={() => { setActiveTab('profile'); setMessage(null); }}
            className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Profile</span>
          </button>

          <button
            onClick={() => { setActiveTab('wallet'); setMessage(null); }}
            className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'wallet'
                ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Wallet History ({walletTxns.length})</span>
          </button>

          {hasPantryAccess(customer) && (
            <button
              onClick={() => { setActiveTab('ledger'); setMessage(null); }}
              className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'ledger'
                  ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-purple-600" />
              <span>Limit &amp; Ledger ({pantryLedger.length})</span>
            </button>
          )}

          <button
            onClick={() => { setActiveTab('audits'); setMessage(null); }}
            className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'audits'
                ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
            <span>Audits &amp; Permissions</span>
            {pendingConfirmationAudits.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-extrabold">
                {pendingConfirmationAudits.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('address'); setMessage(null); }}
            className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'address'
                ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>Address</span>
          </button>

          {hasPantryAccess(customer) && (
            <button
              onClick={() => { setActiveTab('stock'); setMessage(null); }}
              className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'stock'
                  ? 'bg-white border-slate-200 text-purple-900 font-bold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-purple-600" />
              <span>
                Pantry Stock ({pantryItems.filter((i) => i.quantity > 0).length} In Pantry • {filterUsedPantryItems(pantryItems).length} Used)
              </span>
            </button>
          )}

          <button
            onClick={() => { setActiveTab('history'); setMessage(null); }}
            className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'history'
                ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            <span>COD Orders ({codOrders.length})</span>
          </button>

          {hasPantryAccess(customer) && (
            <button
              onClick={() => { setActiveTab('pantry'); setMessage(null); }}
              className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'pantry'
                  ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              <span>Pantry Orders ({pantryOrders.length})</span>
            </button>
          )}

          <button
            onClick={() => { setActiveTab('tracking'); setMessage(null); }}
            className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'tracking'
                ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Order Tracking</span>
          </button>

          {hasPantryAccess(customer) && (
            <button
              onClick={() => { setActiveTab('pantryPay'); setMessage(null); }}
              className={`px-3.5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'pantryPay'
                  ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-purple-600" />
              <span>Pantry Pay</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          {message && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* TAB: WALLET STATEMENT & HISTORICAL TRANSACTIONS */}
          {activeTab === 'wallet' && (
            <div className="space-y-5">
              {/* TOP HERO BANNER: ALWAYS VISIBLE CLOSING WALLET BALANCE */}
              <div
                onClick={() => setWalletModalTab('FORMULA')}
                className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl shadow-lg border border-emerald-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:border-emerald-400 hover:shadow-xl transition group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      TOP CLOSING WALLET BALANCE
                    </span>
                    <span className="text-[11px] text-emerald-200/80 font-medium">Live Passbook</span>
                    <span className="text-[10px] bg-white/20 text-emerald-100 px-2 py-0.5 rounded-full font-bold opacity-0 group-hover:opacity-100 transition">
                      Click for Formula Breakdown ↗
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-baseline gap-2">
                    <span>₹{(customer.walletBalance ?? 1000).toLocaleString('en-IN')}</span>
                    <span className="text-xs font-normal text-emerald-200">
                      {(customer.walletBalance ?? 0) < 0 ? '(Negative Balance - Pending Settlement)' : '(Active Closing Balance)'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-100/80">
                    Wallet closing balance hamesha top me live rahega. Click karein total credits, deductions aur &ldquo;Kaise ye amount hua&rdquo; formula janne ke liye.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 border-emerald-700/40 pt-3 md:pt-0" onClick={(e) => e.stopPropagation()}>
                  <div className="text-left md:text-right">
                    <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Customer ID</div>
                    <div className="text-xs font-mono font-black text-white">{customer.id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={fetchWalletTransactions}
                    className="px-3 py-2 bg-emerald-700/60 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-emerald-500/30"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                </div>
              </div>

              {/* Wallet Overview KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setWalletModalTab('FORMULA')}
                  className="p-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-2xl text-left cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Current Closing Balance
                    </span>
                    <Wallet className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
                  </div>
                  <div className={`text-2xl font-black mt-1 ${
                    (customer.walletBalance ?? 0) < 0 ? 'text-rose-600' : 'text-emerald-950'
                  }`}>
                    ₹{(customer.walletBalance ?? 1000).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5 flex items-center justify-between">
                    <span>Security &amp; Audit Pool</span>
                    <span className="font-bold opacity-0 group-hover:opacity-100 text-emerald-800">Formula ↗</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWalletModalTab('CREDITS')}
                  className="p-4 bg-purple-50 hover:bg-purple-100/80 border border-purple-200 rounded-2xl text-left cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">
                      Total Credits / Top-ups
                    </span>
                    <ArrowDownLeft className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
                  </div>
                  <div className="text-2xl font-black text-purple-950 mt-1">
                    +₹{totalWalletRecharge.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-purple-700 mt-0.5 flex items-center justify-between">
                    <span>Admin Top-ups &amp; Deposits</span>
                    <span className="font-bold opacity-0 group-hover:opacity-100 text-purple-800">View ↗</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWalletModalTab('DEDUCTIONS')}
                  className="p-4 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-2xl text-left cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                      Total Deductions
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-rose-600 group-hover:scale-110 transition" />
                  </div>
                  <div className="text-2xl font-black text-rose-950 mt-1">
                    -₹{totalWalletDeductions.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-rose-700 mt-0.5 flex items-center justify-between">
                    <span>Missing Items Adjustments</span>
                    <span className="font-bold opacity-0 group-hover:opacity-100 text-rose-800">View ↗</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWalletModalTab('AUDIT_SETTLEMENTS')}
                  className="p-4 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 rounded-2xl text-left cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                      Audit Discrepancies
                    </span>
                    <ShieldCheck className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
                  </div>
                  <div className="text-2xl font-black text-amber-950 mt-1">
                    {walletTxns.filter((t) => Boolean(t.auditId) || t.transactionType === 'AUDIT_DEDUCTION').length} Bills
                  </div>
                  <div className="text-[10px] text-amber-700 mt-0.5 flex items-center justify-between">
                    <span>Verified Audit Deductions</span>
                    <span className="font-bold opacity-0 group-hover:opacity-100 text-amber-800">Inspect ↗</span>
                  </div>
                </button>
              </div>

              {/* Transactions Header & Filter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Wallet Historical Transaction Statement</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Complete passbook with exact date, hours, minutes &amp; seconds (latest transactions &amp; closing balances on top).
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setWalletFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        walletFilter === 'ALL'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({walletTxns.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalletFilter('CREDIT')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        walletFilter === 'CREDIT'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Credits
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalletFilter('DEBIT')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        walletFilter === 'DEBIT'
                          ? 'bg-rose-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Debits
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={fetchWalletTransactions}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    title="Refresh Statement"
                  >
                    <RefreshCw className={`w-4 h-4 ${walletLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Transaction List */}
              {walletLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading wallet statement...</div>
              ) : filteredWalletTxns.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                  No wallet transactions found under this filter.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredWalletTxns.map((txn, idx) => {
                    const isCredit =
                      txn.transactionType === 'ADMIN_RECHARGE' ||
                      txn.transactionType === 'OPENING_BALANCE' ||
                      txn.transactionType === 'REFUND_IF_APPLICABLE' ||
                      txn.amount > 0;
                    const displayAmt = Math.abs(txn.amount);
                    const formattedDateTime = formatFullDateTimeWithSeconds(
                      txn.date,
                      txn.time,
                      txn.timestamp,
                      (txn as any).createdAt
                    );
                    const balAfter = txn.newBalance ?? (txn as any).balanceAfter ?? 0;
                    const isLatest = idx === 0;

                    return (
                      <div
                        key={txn.id}
                        className={`p-4 bg-white border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs transition ${
                          isLatest
                            ? 'border-emerald-300 ring-1 ring-emerald-200/60 bg-emerald-50/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isCredit
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="w-5 h-5" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {txn.reason || (isCredit ? 'Wallet Top-up' : 'Audit Deduction')}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                  isCredit
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {txn.transactionType.replace(/_/g, ' ')}
                              </span>
                              {isLatest && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-600 text-white">
                                  LATEST
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-2 flex-wrap">
                              <span>Txn #{txn.id}</span>
                              {txn.referenceId && (
                                <>
                                  <span>•</span>
                                  <span className="text-purple-700 font-bold">Ref: {txn.referenceId}</span>
                                </>
                              )}
                              {txn.auditId && (
                                <>
                                  <span>•</span>
                                  <span className="text-cyan-700 font-bold">Audit: {txn.auditId}</span>
                                </>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-slate-700 font-semibold">{formattedDateTime}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 flex sm:flex-col justify-between items-center sm:items-end gap-1">
                          <div
                            className={`text-lg font-black font-mono ${
                              isCredit ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isCredit ? '+' : '-'}₹{displayAmt.toLocaleString('en-IN')}
                          </div>
                          <div className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200 text-[11px] text-slate-700 font-medium">
                            Closing Balance: <strong className="font-mono font-bold text-slate-900">₹{balAfter.toLocaleString('en-IN')}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PANTRY LIMIT & CREDIT LEDGER HISTORY */}
          {hasPantryAccess(customer) && activeTab === 'ledger' && (
            <div className="space-y-5">
              {/* TOP HERO BANNER: ALWAYS VISIBLE CLOSING PANTRY LIMIT & AUTO CALCULATION */}
              {(() => {
                const stockValuation = pantryItems
                  .filter((i) => (i.quantity || 0) > 0 && i.status !== 'RETURNED')
                  .reduce((acc, i) => acc + (i.quantity || 0) * (i.unitPrice || 0), 0);

                const inTransitPantryOrders = orders.filter(
                  (o) =>
                    o.orderType === 'PANTRY' &&
                    ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(
                      o.orderStatus
                    )
                );
                const inTransitOrdersValue = inTransitPantryOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
                const approvedLimit = customer.pantryLimit || 0;
                const computedUsedLimit = stockValuation + inTransitOrdersValue;
                const closingAvailableLimit = Math.max(0, approvedLimit - computedUsedLimit);

                return (
                  <>
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-lg border border-purple-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-purple-400/20 text-purple-300 border border-purple-400/30 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                            TOP CLOSING PANTRY LIMIT
                          </span>
                          <span className="text-[11px] text-purple-200/80 font-medium">Live Credit Status</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-baseline gap-2">
                          <span>₹{closingAvailableLimit.toLocaleString('en-IN')}</span>
                          <span className="text-xs font-normal text-purple-200">
                            (Available for Orders • Max: ₹{approvedLimit.toLocaleString('en-IN')})
                          </span>
                        </h3>
                        <p className="text-[11px] text-purple-100/80">
                          Pantry limit automatic formula: Approved Limit (₹{approvedLimit.toLocaleString('en-IN')}) - [ Home Stock Value (₹{stockValuation.toLocaleString('en-IN')}) + In-Transit Orders (₹{inTransitOrdersValue.toLocaleString('en-IN')}) ] = ₹{closingAvailableLimit.toLocaleString('en-IN')}.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 border-purple-700/40 pt-3 md:pt-0">
                        <div className="text-left md:text-right">
                          <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Used Credit</div>
                          <div className="text-xs font-mono font-black text-rose-300">₹{computedUsedLimit.toLocaleString('en-IN')}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            fetchPantryLedger();
                            fetchPantryItems();
                            fetchOrders();
                          }}
                          className="px-3 py-2 bg-purple-700/60 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-purple-500/30"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${ledgerLoading ? 'animate-spin' : ''}`} />
                          <span>Sync</span>
                        </button>
                      </div>
                    </div>

                    {/* Limit Overview Cards (5 Columns Automated Breakdown) */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setMetricModalTab('APPROVED')}
                        className="p-3 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 border border-purple-200 rounded-2xl transition cursor-pointer text-left group hover:scale-[1.02] active:scale-98"
                      >
                        <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block group-hover:text-purple-900">
                          1. Approved Limit 🔍
                        </span>
                        <div className="text-lg sm:text-xl font-black text-purple-950 mt-1">
                          ₹{approvedLimit.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-purple-700 mt-0.5">Click for credit line</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMetricModalTab('HOME_STOCK')}
                        className="p-3 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 border border-amber-200 rounded-2xl transition cursor-pointer text-left group hover:scale-[1.02] active:scale-98"
                      >
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block group-hover:text-amber-900">
                          2. Home Stock Value 🔍
                        </span>
                        <div className="text-lg sm:text-xl font-black text-amber-950 mt-1">
                          ₹{stockValuation.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-amber-700 mt-0.5">
                          {pantryItems.filter((i) => (i.quantity || 0) > 0 && i.status !== 'RETURNED').length} active items (Click)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMetricModalTab('IN_TRANSIT')}
                        className="p-3 bg-sky-50 hover:bg-sky-100 hover:border-sky-300 border border-sky-200 rounded-2xl transition cursor-pointer text-left group hover:scale-[1.02] active:scale-98"
                      >
                        <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block group-hover:text-sky-900">
                          3. In-Transit Orders 🔍
                        </span>
                        <div className="text-lg sm:text-xl font-black text-sky-950 mt-1">
                          ₹{inTransitOrdersValue.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-sky-700 mt-0.5">
                          {inTransitPantryOrders.length} in delivery (Click)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMetricModalTab('TOTAL_USED')}
                        className="p-3 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 border border-rose-200 rounded-2xl transition cursor-pointer text-left group hover:scale-[1.02] active:scale-98"
                      >
                        <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block group-hover:text-rose-900">
                          4. Total Used (2+3) 🔍
                        </span>
                        <div className="text-lg sm:text-xl font-black text-rose-950 mt-1">
                          ₹{computedUsedLimit.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-rose-700 mt-0.5">Stock + Transit (Click)</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMetricModalTab('AVAILABLE')}
                        className="p-3 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 border border-emerald-300 rounded-2xl col-span-2 sm:col-span-1 transition cursor-pointer text-left group hover:scale-[1.02] active:scale-98"
                      >
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block group-hover:text-emerald-900">
                          5. Closing Available 🔍
                        </span>
                        <div className="text-lg sm:text-xl font-black text-emerald-950 mt-1">
                          ₹{closingAvailableLimit.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-emerald-700 mt-0.5">Ready for Orders (Click)</div>
                      </button>
                    </div>
                  </>
                );
              })()}

              {/* Ledger Header & Filter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    <span>Pantry Credit &amp; Limit Order Ledger</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Real-time audit trail with Date, Hours, Minutes &amp; Seconds (Latest Closing Pantry Limit on top).
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setLedgerFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        ledgerFilter === 'ALL'
                          ? 'bg-purple-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({pantryLedger.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerFilter('ORDER_DEBIT')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        ledgerFilter === 'ORDER_DEBIT'
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Orders
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerFilter('PAYMENT_CREDIT')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        ledgerFilter === 'PAYMENT_CREDIT'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Payments
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={fetchPantryLedger}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    title="Refresh Ledger"
                  >
                    <RefreshCw className={`w-4 h-4 ${ledgerLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Ledger Entries List */}
              {ledgerLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading pantry limit ledger...</div>
              ) : filteredLedger.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                  No pantry ledger entries found for this customer.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredLedger.map((entry, idx) => {
                    const isCredit =
                      entry.transactionType === 'RETURN_CREDIT' ||
                      entry.transactionType === 'AUDIT_CREDIT_RESTORE' ||
                      entry.transactionType === 'INITIAL_LIMIT' ||
                      (entry as any).type === 'PAYMENT_CREDIT' ||
                      entry.amount > 0;
                    const displayAmt = Math.abs(entry.amount);
                    const openLimit = entry.openingLimit ?? (entry as any).limitBefore ?? 0;
                    const closeLimit = entry.closingLimit ?? entry.balanceAfter ?? (entry as any).limitAfter ?? 0;
                    const refId = entry.referenceId ?? (entry as any).orderId;
                    const formattedDateTime = formatFullDateTimeWithSeconds(
                      entry.date,
                      entry.time,
                      (entry as any).timestamp,
                      entry.createdAt
                    );
                    const isLatest = idx === 0;

                    return (
                      <div
                        key={entry.id}
                        className={`p-4 bg-white border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs transition ${
                          isLatest
                            ? 'border-purple-300 ring-1 ring-purple-200/60 bg-purple-50/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isCredit
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {entry.description || entry.transactionType}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                  isCredit
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {entry.transactionType.replace(/_/g, ' ')}
                              </span>
                              {isLatest && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-700 text-white">
                                  LATEST
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-2 flex-wrap">
                              <span>Entry #{entry.id}</span>
                              {refId && (
                                <>
                                  <span>•</span>
                                  <span className="text-purple-700 font-bold">Ref: {refId}</span>
                                </>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-slate-700 font-semibold">{formattedDateTime}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 flex sm:flex-col justify-between items-center sm:items-end gap-1">
                          <div
                            className={`text-lg font-black font-mono ${
                              isCredit ? 'text-emerald-600' : 'text-purple-700'
                            }`}
                          >
                            {isCredit ? '+' : '-'}₹{displayAmt.toLocaleString('en-IN')}
                          </div>
                          <div className="px-2.5 py-1 bg-purple-50 rounded-lg border border-purple-200 text-[11px] text-purple-900 font-medium">
                            Closing Limit: <strong className="font-mono font-bold text-purple-950">₹{closeLimit.toLocaleString('en-IN')}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: AUDIT REQUESTS & PERMISSION APPROVALS */}
          {activeTab === 'audits' && (
            <div className="space-y-5">
              {/* Overview / Info Banner */}
              <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-xs text-cyan-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-700" />
                    <span>Auditor Physical Inspections &amp; Customer Verification</span>
                  </div>
                  <div className="text-[11px] text-cyan-800 leading-relaxed max-w-xl">
                    Auditors conduct doorstep physical checks on pantry card inventory. You must <strong>Approve Permission &amp; Confirm the Slot</strong> before an auditor can begin their visit.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchAuditorChecks}
                  className="px-3 py-1.5 bg-white hover:bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${auditsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Audits</span>
                </button>
              </div>

              {/* Pending Approvals & Bill Confirmations Section */}
              {pendingConfirmationAudits.length > 0 && (
                <div className="space-y-4">
                  {/* Generated Bills awaiting inspection & locking */}
                  {pendingBillConfirmationAudits.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-black text-indigo-950 uppercase tracking-wider">
                        <FileText className="w-4 h-4 text-indigo-600 animate-bounce" />
                        <span>Action Required: Audit Bill Generated — Inspect &amp; Confirm ({pendingBillConfirmationAudits.length})</span>
                      </div>

                      {pendingBillConfirmationAudits.map((audit) => (
                        <div
                          key={audit.id}
                          className="p-5 bg-gradient-to-br from-indigo-50 via-purple-50/50 to-pink-50/30 border-2 border-indigo-300 rounded-2xl space-y-4 shadow-sm"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/80 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-indigo-200 text-indigo-900 flex items-center justify-center font-black shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                  <span>Audit Bill #{audit.billId || audit.id}</span>
                                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                                    Awaiting Customer Lock
                                  </span>
                                </div>
                                <div className="text-xs text-indigo-900 font-medium">
                                  Auditor: <strong>{audit.auditorName}</strong> (ID: {audit.auditorId})
                                </div>
                              </div>
                            </div>

                            <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-black bg-indigo-200 text-indigo-900 border border-indigo-300 animate-pulse">
                              Bill Generated • Inspection Required
                            </span>
                          </div>

                          {/* Quick Summary Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white/90 p-3.5 rounded-xl border border-indigo-200">
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Items Checked</span>
                              <strong className="text-slate-800 text-sm font-mono mt-0.5 block">
                                {audit.totalItemsCount || audit.itemsChecked?.length || 0} Products
                              </strong>
                            </div>

                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Missing Discrepancies</span>
                              <strong className="text-rose-600 text-sm font-mono mt-0.5 block">
                                {audit.notAvailableCount || audit.itemsChecked?.filter(i => (i.qtyMissing || 0) > 0 || i.verificationStatus === 'NOT_AVAILABLE').length || 0} Items
                              </strong>
                            </div>

                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Wallet Deduction</span>
                              <strong className="text-rose-700 text-sm font-mono mt-0.5 block">
                                -₹{(audit.totalWalletDeduction || 0).toLocaleString()}
                              </strong>
                            </div>

                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Pantry Limit Restored</span>
                              <strong className="text-emerald-700 text-sm font-mono mt-0.5 block">
                                +₹{(audit.totalCreditRestored || 0).toLocaleString()}
                              </strong>
                            </div>
                          </div>

                          {/* Action Guidance & Inspection Buttons */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                            <div className="text-[11px] text-indigo-950 flex items-center gap-1.5">
                              <Info className="w-4 h-4 text-indigo-700 shrink-0" />
                              <span>
                                Please <strong>View &amp; Inspect Audit Bill</strong> to review verified items, missing deductions, and returns before locking.
                              </span>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => setSelectedAuditForBill(audit)}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                                <span>View &amp; Inspect Bill</span>
                              </button>

                              <button
                                type="button"
                                disabled={approvingAuditId === audit.id}
                                onClick={() => handleApproveAuditBill(audit.id)}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                {approvingAuditId === audit.id ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Locking Bill...</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-4 h-4" />
                                    <span>Accept &amp; Lock Bill</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedAuditForBill(audit)}
                                className="flex-1 sm:flex-none px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <span>Reject Bill</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Visit Permission Requests */}
                  {pendingVisitPermissionAudits.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse" />
                        <span>Action Required: Audit Visit Permission Pending ({pendingVisitPermissionAudits.length})</span>
                      </div>

                      {pendingVisitPermissionAudits.map((audit) => (
                        <div
                          key={audit.id}
                          className="p-5 bg-gradient-to-br from-amber-50 to-orange-50/50 border-2 border-amber-300 rounded-2xl space-y-4 shadow-sm"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-black shrink-0">
                                <ShieldAlert className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm">
                                  Physical Audit Visit Request #{audit.id}
                                </div>
                                <div className="text-xs text-amber-900 font-medium">
                                  Auditor: <strong>{audit.auditorName}</strong> (ID: {audit.auditorId})
                                </div>
                              </div>
                            </div>

                            <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-black bg-amber-200 text-amber-900 border border-amber-300 animate-pulse">
                              Visit Permission Pending
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white/80 p-3.5 rounded-xl border border-amber-200">
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Scheduled Visit Date</span>
                              <strong className="text-slate-800 text-sm font-mono flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                {audit.requestedDate}
                              </strong>
                            </div>

                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Preferred Time Slot</span>
                              <strong className="text-slate-800 text-sm font-mono flex items-center gap-1 mt-0.5">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                {audit.requestedTime || '10:00 AM - 02:00 PM'}
                              </strong>
                            </div>

                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Audit Purpose</span>
                              <span className="text-slate-700 text-xs mt-0.5 block truncate">
                                {audit.purpose || 'Routine Physical Inventory & Expiry Verification'}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                            <div className="text-[11px] text-amber-950 flex items-center gap-1.5">
                              <Info className="w-4 h-4 text-amber-700 shrink-0" />
                              <span>
                                By clicking <strong>Approve Permission</strong>, you confirm the scheduled slot and authorize the field auditor for physical inspection.
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={approvingAuditId === audit.id}
                              onClick={() => handleApproveAuditPermission(audit.id)}
                              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                            >
                              {approvingAuditId === audit.id ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span>Approving Permission...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Approve Permission &amp; Confirm Slot</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All Audits History Section */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-cyan-600" />
                    <span>Audit Inspection History &amp; Verified Reports</span>
                  </h4>

                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setAuditFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        auditFilter === 'ALL'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({auditorChecks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilter('PENDING')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        auditFilter === 'PENDING'
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pending ({pendingConfirmationAudits.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilter('COMPLETED')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        auditFilter === 'COMPLETED'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Completed
                    </button>
                  </div>
                </div>

                {auditsLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400">Loading audit history...</div>
                ) : filteredAudits.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                    No audits found in this category.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAudits.map((audit) => (
                      <div
                        key={audit.id}
                        className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-3xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                              {audit.id}
                            </span>
                            <span className="text-xs text-slate-600">
                              Auditor: <strong>{audit.auditorName}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                audit.status === 'COMPLETED' || audit.status === 'BILL_CONFIRMED' || audit.status === 'LOCKED'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : audit.status === 'IN_PROGRESS' || audit.status === 'STARTED'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {audit.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Audit Details Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-semibold">Visit Date</span>
                            <strong className="text-slate-800">{audit.visitDate || audit.requestedDate}</strong>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-semibold">Permission Status</span>
                            <strong
                              className={
                                audit.isPermissionGranted || audit.status === 'CUSTOMER_CONFIRMED'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }
                            >
                              {audit.isPermissionGranted || audit.status === 'CUSTOMER_CONFIRMED'
                                ? '✓ Granted by Customer'
                                : 'Pending Confirmation'}
                            </strong>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-semibold">Items Checked</span>
                            <strong className="text-slate-800">
                              {audit.totalItemsCount || audit.itemsChecked?.length || 0} Items
                            </strong>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-semibold">Wallet Deduction</span>
                            <strong className="text-rose-700">
                              ₹{(audit.totalWalletDeduction || 0).toLocaleString()}
                            </strong>
                          </div>
                        </div>

                        {/* Footer / Bill Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                          <div className="text-[11px] text-slate-500">
                            {audit.customerConfirmedAt ? (
                              <span className="text-emerald-700 flex items-center gap-1 font-medium">
                                <CheckCheck className="w-3.5 h-3.5" />
                                Confirmed on {audit.customerConfirmedDate} {audit.customerConfirmedTime}
                              </span>
                            ) : (
                              <span>Permission pending</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* If bill generated, view bill */}
                            {(audit.billId || audit.billStatus || audit.status === 'COMPLETED') && (
                              <button
                                type="button"
                                onClick={() => setSelectedAuditForBill(audit)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Audit Bill</span>
                              </button>
                            )}

                            {/* If audit needs customer confirmation */}
                            {(audit.status === 'REQUESTED' ||
                              audit.status === 'CUSTOMER_PENDING' ||
                              audit.status === 'PENDING_CONFIRMATION' ||
                              !audit.isPermissionGranted) && (
                              <button
                                type="button"
                                disabled={approvingAuditId === audit.id}
                                onClick={() => handleApproveAuditPermission(audit.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve Permission</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PROFILE & AVATAR EDIT */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Choose Profile Image / Avatar
                </label>
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {PRESET_AVATARS.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setProfilePhoto(url)}
                      className={`w-14 h-14 rounded-2xl overflow-hidden border-2 transition cursor-pointer shrink-0 relative ${
                        profilePhoto === url
                          ? 'border-emerald-600 ring-2 ring-emerald-500/30 scale-105'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                      {profilePhoto === url && (
                        <div className="absolute inset-0 bg-emerald-600/30 flex items-center justify-center text-white">
                          <Check className="w-5 h-5 drop-shadow-md" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-2">
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">
                    Or specify custom image URL:
                  </label>
                  <input
                    type="url"
                    value={profilePhoto}
                    onChange={(e) => setProfilePhoto(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                  />
                </div>
              </div>

              {/* Personal Details Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 font-medium bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 font-mono bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="customer@example.com"
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alternate Mobile
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      value={alternateMobile}
                      onChange={(e) => setAlternateMobile(e.target.value)}
                      placeholder="+91 9800000000"
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 font-mono bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          )}

          {/* TAB: ADDRESS EDIT */}
          {activeTab === 'address' && (
            <form onSubmit={handleSaveAddress} className="space-y-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-slate-900">Current Saved Primary Address</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {customer.address}, {customer.area}, {customer.landmark ? `Near ${customer.landmark}, ` : ''}{customer.city}, {customer.state} - {customer.pinCode}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Flat / House No / Street Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Area / Sector / Locality <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Landmark
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Near Park / Opposite Gate"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PIN Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 font-mono bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Updating Address...' : 'Update Delivery Address'}
                </button>
              </div>
            </form>
          )}

          {/* TAB: PANTRY STOCK (IN-STOCK VS USED & DELIVERED BREAKDOWN) */}
          {hasPantryAccess(customer) && activeTab === 'stock' && (
            <div className="space-y-5">
              {/* Header Info Banner */}
              <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-lg border border-purple-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-purple-400/20 text-purple-300 border border-purple-400/30 flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5" />
                      PANTRY STOCK &amp; USAGE PROFILE
                    </span>
                    <span className="text-[11px] text-purple-200/80 font-medium">Household Doorstep Audit</span>
                  </div>
                  <h3 className="text-xl font-black text-white">
                    Household Pantry Items &amp; Consumed Stock
                  </h3>
                  <p className="text-xs text-purple-200/90 max-w-2xl">
                    Aapke doorstep pantry me available in-stock items, used ho chuke (0-quantity) items aur delivery ke through inward huye products ki full detail (MFG, EXP, Price, Images).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={fetchPantryItems}
                    className="px-3.5 py-2 bg-purple-700/80 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-purple-500/30"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pantryLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh Stock</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              {(() => {
                const activeStock = pantryItems.filter((i) => i.quantity > 0);
                const usedStock = filterUsedPantryItems(pantryItems);
                const activeUnits = activeStock.reduce((acc, i) => acc + (i.quantity || 0), 0);
                const stockValuation = activeStock.reduce((acc, i) => acc + (i.quantity || 0) * (i.unitPrice || 0), 0);

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                      <div className="text-[10px] font-black uppercase text-purple-800 tracking-wider flex items-center justify-between">
                        <span>In Pantry Stock</span>
                        <Package className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="text-2xl font-black text-purple-950 mt-1">
                        {activeStock.length} <span className="text-xs font-bold text-purple-700 font-sans">({activeUnits} units)</span>
                      </div>
                      <div className="text-[10px] text-purple-700 mt-0.5">Active Household Shelf</div>
                    </div>

                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                      <div className="text-[10px] font-black uppercase text-rose-800 tracking-wider flex items-center justify-between">
                        <span>Used (0 Qty)</span>
                        <Clock className="w-4 h-4 text-rose-600" />
                      </div>
                      <div className="text-2xl font-black text-rose-950 mt-1">
                        {usedStock.length} <span className="text-xs font-bold text-rose-700 font-sans">Products</span>
                      </div>
                      <div className="text-[10px] text-rose-700 mt-0.5">Latest 30 Consumed (Max 2/Batch)</div>
                    </div>

                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <div className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center justify-between">
                        <span>Stock Valuation</span>
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-black text-emerald-950 mt-1">
                        ₹{stockValuation.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">Physical Goods Value</div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                      <div className="text-[10px] font-black uppercase text-blue-800 tracking-wider flex items-center justify-between">
                        <span>Delivered Orders</span>
                        <Truck className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-2xl font-black text-blue-950 mt-1">
                        {orders.filter((o) => o.orderStatus === 'DELIVERED').length} <span className="text-xs font-bold text-blue-700 font-sans">Orders</span>
                      </div>
                      <div className="text-[10px] text-blue-700 mt-0.5">Pantry &amp; COD Inwards</div>
                    </div>
                  </div>
                );
              })()}

              {/* Sub-tab Switcher & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setStockSubTab('inStock')}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer shrink-0 ${
                      stockSubTab === 'inStock'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>🟢 In Pantry Stock</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      stockSubTab === 'inStock' ? 'bg-purple-900 text-white' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {pantryItems.filter((i) => i.quantity > 0).length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStockSubTab('used')}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer shrink-0 ${
                      stockSubTab === 'used'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>🔴 Used / Consumed (0 Qty)</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      stockSubTab === 'used' ? 'bg-rose-900 text-white' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {filterUsedPantryItems(pantryItems).length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStockSubTab('breakdown')}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer shrink-0 ${
                      stockSubTab === 'breakdown'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>📦 Delivered Inward Orders</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      stockSubTab === 'breakdown' ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {orders.filter((o) => o.orderStatus === 'DELIVERED').length}
                    </span>
                  </button>
                </div>

                {stockSubTab !== 'breakdown' && (
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={stockSearchQuery}
                      onChange={(e) => setStockSearchQuery(e.target.value)}
                      placeholder="Search items, brand, batch..."
                      className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-purple-600 bg-slate-50 font-medium"
                    />
                  </div>
                )}
              </div>

              {/* In-Stock & Used Sub-Tabs */}
              {(stockSubTab === 'inStock' || stockSubTab === 'used') && (
                <div>
                  {pantryLoading ? (
                    <div className="py-16 text-center text-slate-400 text-xs">Loading pantry stock items...</div>
                  ) : (() => {
                    const basePool = stockSubTab === 'inStock'
                      ? pantryItems.filter((i) => i.quantity > 0)
                      : filterUsedPantryItems(pantryItems);

                    const list = basePool.filter((i) => {
                      if (stockSearchQuery.trim()) {
                        const q = stockSearchQuery.toLowerCase();
                        return (
                          i.productName.toLowerCase().includes(q) ||
                          (i.brand && i.brand.toLowerCase().includes(q)) ||
                          (i.batchNumber && i.batchNumber.toLowerCase().includes(q))
                        );
                      }
                      return true;
                    });

                    if (list.length === 0) {
                      return (
                        <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-3xl text-slate-400 space-y-2">
                          <Boxes className="w-10 h-10 mx-auto text-slate-300" />
                          <div className="text-sm font-bold text-slate-700">
                            {stockSubTab === 'inStock' ? 'No Active In-Stock Items' : 'No Consumed (0 Qty) Items'}
                          </div>
                          <div className="text-xs text-slate-400 max-w-sm mx-auto">
                            {stockSubTab === 'inStock'
                              ? 'Delivered pantry orders automatically add items to your active shelf.'
                              : 'Consumed items with 0 quantity remain preserved here for record and audit history.'}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {list.map((it) => {
                          const isUsed = it.quantity === 0;
                          return (
                            <div
                              key={it.id}
                              className={`p-4 rounded-3xl border shadow-xs space-y-3 flex flex-col justify-between ${
                                isUsed ? 'bg-rose-50/20 border-rose-200' : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  {isUsed ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-rose-600" />
                                      USED / 0 QTY
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      IN PANTRY STOCK ({it.quantity} {it.quantity === 1 ? 'Unit' : 'Units'})
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono font-bold text-slate-400">{it.id}</span>
                                </div>

                                <div className="flex items-start gap-3">
                                  <div className="w-18 h-18 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                                    <ImageWithFallback src={it.image} alt={it.productName} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-purple-700 uppercase truncate">
                                      {it.brand || 'Brand'} • {it.weightSize || ''}
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-sm truncate mt-0.5">
                                      {it.productName}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-mono font-bold text-[10px]">
                                        Batch #{it.batchNumber}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5 font-medium">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-500 text-[11px]">Unit Price:</span>
                                    <span className="font-extrabold text-slate-900 font-mono text-xs">₹{it.unitPrice}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-500 text-[11px]">Stock Value:</span>
                                    <span className={`font-mono font-black text-xs ${isUsed ? 'line-through text-rose-700' : 'text-emerald-700'}`}>
                                      ₹{(it.quantity || 0) * (it.unitPrice || 0)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5">
                                    <span className="text-slate-500 text-[11px]">MFG Date:</span>
                                    <span className="font-mono text-slate-700 font-semibold text-[11px]">
                                      {(it as any).manufacturingDate || (it as any).mfgDate || 'Available in Batch'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-500 text-[11px]">EXP Date:</span>
                                    <span className="font-mono text-emerald-700 font-bold text-[11px]">
                                      {it.expiryDate}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5">
                                    <span className="text-slate-500 text-[11px]">Delivered On:</span>
                                    <div className="flex flex-col items-end">
                                      <span className="text-slate-800 text-[11px] font-semibold flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        {it.deliveryDate}
                                      </span>
                                      {(() => {
                                        const dayInfo = getDeliveryDayCount(it.deliveryDate);
                                        return (
                                          <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md mt-1 border flex items-center gap-1 ${dayInfo.statusBadgeColor}`}
                                            title={dayInfo.detailLabel}
                                          >
                                            <Clock className="w-2.5 h-2.5 shrink-0" />
                                            <span>{dayInfo.badgeLabel}</span>
                                            {dayInfo.isWithin15Days && (
                                              <span className="opacity-80 font-normal">({dayInfo.daysRemaining}d left)</span>
                                            )}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Delivered Orders Breakdown Subtab */}
              {stockSubTab === 'breakdown' && (
                <div className="space-y-4">
                  {orders
                    .filter((o) => o.orderStatus === 'DELIVERED')
                    .map((o) => {
                      const isPantry = o.orderType === 'PANTRY';
                      const dt = formatOrderDateTime(getOrderPreciseTimestamp(o));
                      return (
                        <div key={o.id} className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                          <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
                            isPantry ? 'bg-purple-50/70 border-purple-100' : 'bg-amber-50/70 border-amber-100'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                isPantry ? 'bg-purple-200 text-purple-800' : 'bg-amber-200 text-amber-800'
                              }`}>
                                {isPantry ? <CreditCard className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-slate-900 text-sm">{o.id}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isPantry ? 'bg-purple-200 text-purple-900' : 'bg-amber-200 text-amber-900'
                                  }`}>
                                    {isPantry ? 'Pantry Inward' : 'COD Quick'}
                                  </span>
                                  {isPantry && (() => {
                                    const dayInfo = getDeliveryDayCount(dt.date);
                                    return (
                                      <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${dayInfo.statusBadgeColor}`}
                                        title={dayInfo.detailLabel}
                                      >
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>{dayInfo.badgeLabel}</span>
                                        {dayInfo.isWithin15Days && (
                                          <span className="opacity-80 font-normal">({dayInfo.daysRemaining}d left)</span>
                                        )}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  Delivered on: {dt.date} • {dt.time || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <div className="text-left sm:text-right">
                              <div className="text-sm font-black text-slate-900 font-mono">₹{o.totalAmount}</div>
                              <div className="text-[10px] text-slate-400">{isPantry ? 'Debited from Limit' : 'Paid Cash'}</div>
                            </div>
                          </div>

                          <div className="p-4 space-y-2.5">
                            <div className="text-xs font-bold text-slate-700">Delivered Items in this Order ({o.items.length})</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {o.items.map((it, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
                                    <ImageWithFallback src={it.image} alt={it.productName} />
                                  </div>
                                  <div className="flex-1 min-w-0 text-xs">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold truncate">{it.brand} • {it.weightSize}</div>
                                    <div className="font-bold text-slate-900 truncate">{it.productName}</div>
                                    <div className="text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                                      <span>Qty: <strong>{it.quantity}</strong></span>
                                      <span>•</span>
                                      <span>Price: <strong className="text-slate-900 font-mono">₹{it.price}</strong></span>
                                      {it.mrp && it.mrp > it.price && (
                                        <>
                                          <span className="line-through text-slate-400 font-mono text-[10px]">₹{it.mrp}</span>
                                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                            {Math.round(((it.mrp - it.price) / it.mrp) * 100)}% OFF
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {isPantry && (it.manufacturingDate || it.expiryDate) && (
                                      <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-2">
                                        {it.manufacturingDate && <span>MFG: {it.manufacturingDate}</span>}
                                        {it.expiryDate && <span className="text-emerald-700 font-bold">EXP: {it.expiryDate}</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB: COD ORDER HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-amber-900">Quick Cash on Delivery (COD) Orders</div>
                  <div className="text-[11px] text-amber-700">
                    Track total cash collected and pending COD doorstep deliveries with full product details.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-amber-600 font-bold uppercase">Total COD Orders</div>
                  <div className="text-lg font-extrabold text-amber-900">{codOrders.length}</div>
                </div>
              </div>

              {ordersLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading COD history...</div>
              ) : codOrders.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No COD orders placed yet.</div>
              ) : (
                <div className="space-y-4">
                  {codOrders.map((o) => {
                    const dt = formatOrderDateTime(getOrderPreciseTimestamp(o));
                    return (
                      <div key={o.id} className="p-4 sm:p-5 rounded-3xl border border-slate-200 bg-white shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-sm">{o.id}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              {o.orderStatus}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
                            <span>{dt.date} • {dt.time || 'N/A'}</span>
                            <span className="font-bold text-slate-900 text-sm">Total: ₹{o.totalAmount}</span>
                          </div>
                        </div>

                        {/* Item Cards with Images, Price, MRP, Discount */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                              <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
                                <ImageWithFallback src={it.image} alt={it.productName} />
                              </div>
                              <div className="flex-1 min-w-0 text-xs">
                                <div className="text-[10px] text-slate-400 font-bold uppercase truncate">{it.brand} • {it.weightSize}</div>
                                <h5 className="font-bold text-slate-900 truncate">{it.productName}</h5>
                                <div className="text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                                  <span>Qty: <strong className="text-slate-900">{it.quantity}</strong></span>
                                  <span>•</span>
                                  <span>Price: <strong className="font-mono text-slate-900">₹{it.price}</strong></span>
                                  {it.mrp && it.mrp > it.price && (
                                    <>
                                      <span className="line-through text-slate-400 font-mono text-[10px]">₹{it.mrp}</span>
                                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        {Math.round(((it.mrp - it.price) / it.mrp) * 100)}% OFF
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                          <div className="flex items-center gap-1 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-sm">{o.deliveryAddress}</span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-700">Cash On Delivery</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PANTRY ORDER HISTORY */}
          {hasPantryAccess(customer) && activeTab === 'pantry' && (
            <div className="space-y-6">
              {/* Digital Pantry Card UI Section */}
              <div className="bg-gradient-to-br from-purple-900 to-indigo-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                <div className="flex flex-col sm:flex-row justify-between gap-6 relative z-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/20">
                        <CreditCard className="w-6 h-6 text-purple-200" />
                      </div>
                      <div>
                        <div className="text-[10px] text-purple-200 font-black uppercase tracking-[0.2em]">Digital Pantry Card</div>
                        <div className="text-xl font-bold tracking-tight">{customer.fullName}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-[10px] text-purple-300 font-bold uppercase">Card Number</div>
                      <div className="text-lg font-mono tracking-[0.15em]">{customer.id.padEnd(16, '0').match(/.{4}/g)?.join(' ')}</div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div>
                        <div className="text-[10px] text-purple-300 font-bold uppercase">Valid Thru</div>
                        <div className="text-sm font-bold">12 / 2029</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-purple-300 font-bold uppercase">Status</div>
                        <div className="text-sm font-bold text-emerald-400">ACTIVE</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between text-right">
                    <div className="bg-white p-2 rounded-xl">
                      <QrCode className="w-16 h-16 text-slate-900" />
                    </div>
                    <div className="mt-4">
                      <div className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">Available Pantry Limit</div>
                      <div className="text-3xl font-black text-emerald-400">₹{customer.availablePantryLimit.toLocaleString()}</div>
                      <div className="text-[11px] text-purple-300">Total: ₹{customer.pantryLimit.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-purple-900">Pantry Card Order History</div>
                  <div className="text-[11px] text-purple-700">
                    Pantry Card usage orders with product items (₹0 Cash on Delivery)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-purple-600 font-bold uppercase">Total Pantry Orders</div>
                  <div className="text-lg font-extrabold text-purple-900">{pantryOrders.length}</div>
                </div>
              </div>

              {ordersLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading Pantry history...</div>
              ) : pantryOrders.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No Pantry orders placed yet.</div>
              ) : (
                <div className="space-y-4">
                  {pantryOrders.map((o) => {
                    const dt = formatOrderDateTime(getOrderPreciseTimestamp(o));
                    return (
                      <div key={o.id} className="p-4 sm:p-5 rounded-3xl border border-slate-200 bg-white shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-purple-900 flex items-center gap-1.5 text-sm">
                              <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                              {o.id}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                              Debited: ₹{o.totalAmount}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
                            <span>{dt.date} • {dt.time || 'N/A'}</span>
                            <span className="font-bold text-emerald-700 text-xs">Status: {o.orderStatus} (₹0 COD)</span>
                          </div>
                        </div>

                        {/* Item Cards with Images, MFG, EXP */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                              <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
                                <ImageWithFallback src={it.image} alt={it.productName} />
                              </div>
                              <div className="flex-1 min-w-0 text-xs">
                                <div className="text-[10px] text-slate-400 font-bold uppercase truncate">{it.brand} • {it.weightSize}</div>
                                <h5 className="font-bold text-slate-900 truncate">{it.productName}</h5>
                                <div className="text-slate-600 mt-1 flex items-center gap-2">
                                  <span>Qty: <strong className="text-slate-900">{it.quantity}</strong></span>
                                  <span>•</span>
                                  <span>Price: <strong className="font-mono">₹{it.price}</strong></span>
                                </div>
                                {(it.manufacturingDate || it.expiryDate) && (
                                  <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-2">
                                    {it.manufacturingDate && <span>MFG: {it.manufacturingDate}</span>}
                                    {it.expiryDate && <span className="text-emerald-700 font-bold">EXP: {it.expiryDate}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                          <div className="flex items-center gap-1 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-sm">{o.deliveryAddress}</span>
                          </div>
                          <span className="text-[11px] font-bold text-purple-700">Digital Pantry Settlement</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PANTRY PAY SCANNER */}
          {hasPantryAccess(customer) && activeTab === 'pantryPay' && (
            <div>
              <PantryPayScannerUI customer={customer} />
            </div>
          )}

          {/* TAB: ORDER TRACKING */}
          {activeTab === 'tracking' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-emerald-900">Live Order Tracking</div>
                  <div className="text-[11px] text-emerald-700">
                    Track your active deliveries and batch status.
                  </div>
                </div>
                <Truck className="w-8 h-8 text-emerald-600 opacity-20" />
              </div>

              {orders.filter(o => o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'CANCELLED').length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                  No active orders for tracking.
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.filter(o => o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'CANCELLED').map((o) => (
                    <div key={o.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Order ID: {o.id}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> One-Way Locked
                          </span>
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                            {o.orderStatus}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Kahan Pahucha Live Pill */}
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 bg-emerald-50/90 p-2.5 rounded-xl border border-emerald-200">
                          <Navigation className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Kahan Pahucha: <strong className="text-emerald-950 font-black">{o.currentLocation || (o.orderStatus === 'DELIVERED' ? 'Delivered at Doorstep' : o.orderStatus === 'OUT_FOR_DELIVERY' ? 'Out with Delivery Boy' : o.orderStatus === 'SHIPPED' ? 'Shipped from Hub' : 'Warehouse Fulfillment')}</strong></span>
                        </div>

                        {/* 5-Step Visual Stepper */}
                        <div className="grid grid-cols-5 gap-1 relative px-1">
                          {[
                            { key: 'PENDING', label: 'Placed', rank: 1 },
                            { key: 'CONFIRMED', label: 'Picked & Packed', rank: 2 },
                            { key: 'SHIPPED', label: 'Shipped', rank: 3 },
                            { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', rank: 4 },
                            { key: 'DELIVERED', label: 'Delivered', rank: 5 },
                          ].map((step) => {
                            const getRank = (st: string) => {
                              if (st === 'DELIVERED' || st === 'COMPLETED') return 5;
                              if (st === 'OUT_FOR_DELIVERY') return 4;
                              if (st === 'SHIPPED' || st === 'ASSIGNED' || st === 'ACCEPTED') return 3;
                              if (st === 'CONFIRMED' || st === 'READY_TO_SHIP') return 2;
                              return 1;
                            };
                            const currentRank = getRank(o.orderStatus);
                            const isPast = step.rank <= currentRank;
                            return (
                              <div key={step.key} className="flex flex-col items-center text-center gap-1">
                                <div
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                                    isPast
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'bg-white border-slate-200 text-slate-300'
                                  }`}
                                >
                                  {isPast ? <Check className="w-3.5 h-3.5" /> : step.rank}
                                </div>
                                <span
                                  className={`text-[9px] font-bold leading-tight ${
                                    isPast ? 'text-emerald-700' : 'text-slate-400'
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs text-slate-700 truncate">{o.deliveryAddress}</span>
                          </div>
                          {o.assignedDeliveryBoyName && (
                            <div className="flex items-center gap-2">
                              <Truck className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-xs text-slate-700">Delivery Partner: <strong>{o.assignedDeliveryBoyName}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Logout & Close */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Customer Account</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Audit Bill Modal for Customer */}
      {selectedAuditForBill && (
        <AuditBillModal
          audit={selectedAuditForBill}
          onClose={() => setSelectedAuditForBill(null)}
          isCustomerView={true}
          onConfirmBill={handleApproveAuditBill}
          onDisputeBill={handleDisputeAuditBill}
        />
      )}

      {/* Credit Limit & Stock Valuation Itemized Breakdown Modal */}
      {metricModalTab && customer && (
        <CreditLimitDetailModal
          isOpen={true}
          onClose={() => setMetricModalTab(null)}
          initialTab={metricModalTab}
          customer={customer}
          pantryItems={pantryItems}
          orders={orders}
        />
      )}

      {/* Customer Wallet Balance & Passbook Audit Modal */}
      {walletModalTab && customer && (
        <WalletDetailModal
          isOpen={true}
          onClose={() => setWalletModalTab(null)}
          initialTab={walletModalTab}
          customer={customer}
          walletTxns={walletTxns}
        />
      )}
    </AppWindowModal>
  );
};
