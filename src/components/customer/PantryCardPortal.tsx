import React, { useState, useEffect } from 'react';
import {
  PantryCardItem,
  PantryCreditLedger,
  ReturnRequest,
  ReplacementRequest,
  Customer,
  WalletTransaction,
  AuditorCheck,
  CustomerProductTimeline,
  Order,
} from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { AuditBillModal } from '../common/AuditBillModal';
import { ProductTimelineModal } from '../common/ProductTimelineModal';
import { filterUsedPantryItems } from '../../utils/pantryHelpers';
import {
  CreditCard,
  RotateCcw,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  FileText,
  User,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  ClipboardCheck,
  Eye,
  Check,
  Lock,
  Search,
  ShoppingBag,
  Package,
  Truck,
  Tag,
  DollarSign,
  Sparkles,
  Filter,
  CheckCircle,
  XCircle,
  Info,
  Barcode,
  Boxes,
} from 'lucide-react';
import { formatOrderDateTime, getOrderPreciseTimestamp, getDeliveryDayCount } from '../../utils/dateTimeUtils';
import { CreditLimitDetailModal, LimitMetricTab } from './CreditLimitDetailModal';
import { WalletDetailModal, WalletMetricTab } from './WalletDetailModal';

const hasPantryAccess = (c: Customer) => c.isPantryAllowed !== false && c.pantryLimit > 0;

export const PantryCardPortal: React.FC = () => {
  const { user, customer, refreshUserData } = useAuth();
  const [pantryItems, setPantryItems] = useState<
    (PantryCardItem & {
      daysSinceDelivery: number;
      isReturnEligible: boolean;
      isNearExpiry: boolean;
      isExpired: boolean;
    })[]
  >([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<PantryCreditLedger[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [replacements, setReplacements] = useState<ReplacementRequest[]>([]);
  const [childCustomers, setChildCustomers] = useState<Customer[]>([]);
  const [walletTxns, setWalletTxns] = useState<WalletTransaction[]>([]);
  const [auditorChecks, setAuditorChecks] = useState<AuditorCheck[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'inventory' | 'wallet' | 'audits' | 'ledger' | 'requests' | 'family'>('inventory');
  const [pantrySubTab, setPantrySubTab] = useState<'active' | 'used' | 'deliveries'>('active');
  const [pantrySearchQuery, setPantrySearchQuery] = useState('');
  const [pantryExpiryFilter, setPantryExpiryFilter] = useState<'ALL' | 'FRESH' | 'NEAR_EXPIRY' | 'EXPIRED'>('ALL');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<'ALL' | 'PANTRY' | 'QUICK'>('ALL');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT' | 'PANTRY_ORDER_DEBIT' | 'RETURN_CREDIT'>('ALL');
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [selectedTimeline, setSelectedTimeline] = useState<CustomerProductTimeline | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [metricModalTab, setMetricModalTab] = useState<LimitMetricTab | null>(null);
  const [walletModalTab, setWalletModalTab] = useState<WalletMetricTab | null>(null);

  const handleViewTimeline = async (productId: string) => {
    if (!customer) return;
    try {
      setLoadingTimeline(true);
      const res = await api.getCustomerProductTimeline(customer.id, productId);
      if (res && res.length > 0) {
        setSelectedTimeline(res[0]);
      } else {
        alert('No timeline history found for this product.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to load timeline.');
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Selected audit for detailed bill view modal
  const [selectedAuditForView, setSelectedAuditForView] = useState<AuditorCheck | null>(null);

  // Request Action Modals
  const [selectedItemForAction, setSelectedItemForAction] = useState<PantryCardItem | null>(null);
  const [actionType, setActionType] = useState<'RETURN' | 'REPLACEMENT' | null>(null);
  const [requestQty, setRequestQty] = useState(1);
  const [requestReason, setRequestReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // New Child Account Modal
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [childFormData, setChildFormData] = useState({
    fullName: '',
    mobile: '',
    relationInfo: 'Family Member',
    pantryLimit: 2000,
  });

  const fetchData = async () => {
    if (!user || !customer) return;
    setLoading(true);
    try {
      const [items, ledg, allReturns, allReps, allCusts, wTxns, aChecks, userOrders] = await Promise.all([
        api.getPantryCard(customer.id),
        api.getPantryLedger(customer.id),
        api.getReturns(),
        api.getReplacements(),
        api.getCustomers(),
        api.getWalletTransactions(customer.id).catch(() => []),
        api.getAuditorChecks(customer.id).catch(() => []),
        api.getOrders({ customerId: customer.id }).catch(() => []),
      ]);

      // Sort latest first
      const sortedLedg = [...ledg].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(`${a.date} ${a.time || '00:00:00'}`).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(`${b.date} ${b.time || '00:00:00'}`).getTime() : 0);
        return timeB - timeA;
      });

      const sortedWTxns = [...wTxns].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : (a.date ? new Date(`${a.date} ${a.time || '00:00:00'}`).getTime() : 0);
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : (b.date ? new Date(`${b.date} ${b.time || '00:00:00'}`).getTime() : 0);
        return timeB - timeA;
      });

      setPantryItems(items);
      setOrders(userOrders);
      setLedger(sortedLedg);
      setReturns(allReturns.filter((r) => r.customerId === customer.id));
      setReplacements(allReps.filter((r) => r.customerId === customer.id));
      setWalletTxns(sortedWTxns);
      setAuditorChecks(aChecks);

      if (customer.childCustomerIds && customer.childCustomerIds.length > 0) {
        setChildCustomers(allCusts.filter((c) => customer.childCustomerIds.includes(c.id)));
      }
      refreshUserData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [customer?.id]);

  const handleConfirmAuditVisit = async (auditId: string) => {
    try {
      await api.confirmAuditByCustomer(auditId);
      alert('You have confirmed the upcoming Field Audit visit appointment!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmAuditBill = async (auditId: string): Promise<AuditorCheck | void> => {
    try {
      const res = await api.confirmAuditBill(auditId);
      if (res) {
        setSelectedAuditForView(res);
        setAuditorChecks((prev) =>
          prev.map((a) => (a.id === auditId || a.billId === auditId ? res : a))
        );
      }
      fetchData().catch((err) => console.warn('Background fetch error:', err));
      return res;
    } catch (err: any) {
      console.error('Failed to confirm audit bill:', err);
      throw err;
    }
  };

  const handleDisputeAuditBill = async (auditId: string, remarks: string): Promise<AuditorCheck | void> => {
    try {
      const res = await api.disputeAuditBill(auditId, remarks);
      if (res) {
        setSelectedAuditForView(res);
        setAuditorChecks((prev) =>
          prev.map((a) => (a.id === auditId || a.billId === auditId ? res : a))
        );
      }
      fetchData().catch((err) => console.warn('Background fetch error:', err));
      return res;
    } catch (err: any) {
      console.error('Failed to dispute audit bill:', err);
      throw err;
    }
  };

  const handleOpenActionModal = (item: PantryCardItem, type: 'RETURN' | 'REPLACEMENT') => {
    setSelectedItemForAction(item);
    setActionType(type);
    setRequestQty(1);
    setRequestReason('');
  };

  const handleCloseActionModal = () => {
    setSelectedItemForAction(null);
    setActionType(null);
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAction || !actionType || !customer) return;

    setSubmittingAction(true);
    try {
      if (actionType === 'RETURN') {
        await api.requestReturn({
          customerId: customer.id,
          pantryCardItemId: selectedItemForAction.id,
          quantity: requestQty,
          reason: requestReason || 'Customer initiated return within eligible return window',
          initiatedBy: 'CUSTOMER',
          initiatedById: customer.id,
        });
        alert('Return request submitted successfully! Admin will review and credit your limit.');
      } else {
        await api.requestReplacement({
          customerId: customer.id,
          pantryCardItemId: selectedItemForAction.id,
          quantity: requestQty,
          reason: requestReason || 'Customer requested replacement for damaged/expired item',
          initiatedBy: 'CUSTOMER',
          initiatedById: customer.id,
        });
        alert('Replacement request submitted! Fresh stock will be dispatched with 0 credit deduction.');
      }
      handleCloseActionModal();
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCancelReturn = async (returnId: string) => {
    if (!window.confirm('Are you sure you want to cancel this return request?')) return;
    try {
      await api.rejectReturn(returnId, 'Cancelled by customer');
      alert('Return request cancelled.');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelReplacement = async (repId: string) => {
    if (!window.confirm('Are you sure you want to cancel this replacement request?')) return;
    try {
      await api.rejectReplacement(repId, 'Cancelled by customer');
      alert('Replacement request cancelled.');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateChildCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    try {
      await api.createChildCustomer(customer.id, childFormData);
      alert('Child Pantry Card account created successfully!');
      setIsChildModalOpen(false);
      setChildFormData({
        fullName: '',
        mobile: '',
        relationInfo: 'Family Member',
        pantryLimit: 2000,
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const pendingAudits = auditorChecks.filter(
    (a) =>
      !a.isBillLocked &&
      (a.status === 'CUSTOMER_PENDING_CONFIRMATION' ||
        a.status === 'BILL_GENERATED' ||
        a.billStatus === 'GENERATED' ||
        a.billStatus === 'CUSTOMER_PENDING_CONFIRMATION' ||
        (a.status === 'COMPLETED' && !a.isBillConfirmed))
  );
  const pendingSettlementTotal = pendingAudits.reduce((acc, a) => acc + (a.totalWalletDeduction || 0), 0);

  if (!customer) return null;

  // Financial Calculations for Credit Limit & Stock Valuation
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

  const deliveredPantryOrders = orders.filter(
    (o) => o.orderType === 'PANTRY' && o.orderStatus === 'DELIVERED'
  );
  const deliveredPantryOrdersValue = deliveredPantryOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

  const approvedLimit = customer.pantryLimit || 0;
  const effectiveUsedLimit = stockValuation + inTransitOrdersValue;
  const effectiveAvailableLimit = Math.max(0, approvedLimit - effectiveUsedLimit);

  return (
    <div className="space-y-6">
      {/* Visual Dual Cards Banner: Pantry Credit + Customer Wallet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pantry Master Card (Credit Limit) */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-purple-500/20 flex flex-col justify-between">
          <div className="absolute right-0 top-0 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row justify-between gap-6">
            {/* Card Info Left */}
            <div className="space-y-4 max-w-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-purple-300" />
                </div>
                <span className="font-extrabold text-sm tracking-widest text-purple-300 uppercase">
                  PantryMaster Card
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ACTIVE
                </span>
              </div>

              <div className="font-mono text-xl font-bold tracking-widest text-slate-100">
                {customer.id}
              </div>

              <div className="pt-1">
                <div className="text-[11px] text-purple-300 font-medium">Cardholder Name</div>
                <div className="text-base font-bold text-white">{customer.fullName}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Mobile: +91 {customer.mobile} • {customer.city}, {customer.state}
                </div>
              </div>
            </div>

            {/* Card Balance Right */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col justify-between min-w-[240px] space-y-3">
              <div>
                <div className="text-[11px] text-purple-200 font-medium">Available Closing Credit</div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-300 mt-0.5">
                  ₹{effectiveAvailableLimit.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  Approved Total Limit: ₹{approvedLimit.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-purple-200">
                  <span>Total Credit Used</span>
                  <span className="font-bold text-white">
                    ₹{effectiveUsedLimit.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (effectiveUsedLimit / (approvedLimit || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Wallet Card (Deposit / Pre-paid Balance) */}
        <div
          onClick={() => setWalletModalTab('ALL')}
          className="bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-500/30 flex flex-col justify-between cursor-pointer hover:border-emerald-400 hover:shadow-2xl transition group"
        >
          <div className="absolute right-0 top-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-300" />
                </div>
                <span className="font-extrabold text-xs tracking-widest text-emerald-300 uppercase">
                  Customer Wallet
                </span>
              </div>
              <span className="text-[10px] bg-emerald-400/20 text-emerald-200 px-2 py-0.5 rounded-full font-bold border border-emerald-400/30 flex items-center gap-1 group-hover:bg-emerald-400/30 transition">
                <span>Passbook Drilldown</span>
                <span>↗</span>
              </span>
            </div>

            <div>
              <div className="text-[11px] text-emerald-200 flex items-center justify-between">
                <span>Current Wallet Balance</span>
                <span className="text-[10px] text-emerald-300/90 font-semibold opacity-0 group-hover:opacity-100 transition">
                  Click to inspect breakdown
                </span>
              </div>
              <div className="text-3xl font-black text-white mt-0.5 flex items-baseline gap-2">
                <span>₹{(customer.walletBalance ?? 1000).toLocaleString('en-IN')}</span>
                <span className="text-xs font-normal text-emerald-300/80">
                  {(customer.walletBalance ?? 0) < 0 ? '(Negative Due)' : '(Active)'}
                </span>
              </div>
              <div className="text-[10px] text-emerald-300/80 mt-1">
                Used exclusively for Field Audit discrepancy settlements. Click to view credits, deductions &amp; math proof.
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10 text-[11px] text-slate-200 space-y-1">
              <div className="flex justify-between">
                <span>Pantry Limit (Credit):</span>
                <span className="font-bold text-purple-300">₹{approvedLimit}</span>
              </div>
              <div className="flex justify-between">
                <span>Wallet (Real Deposit):</span>
                <span className="font-bold text-emerald-300">₹{customer.walletBalance ?? 1000}</span>
              </div>
              {pendingSettlementTotal > 0 && (
                <div className="flex justify-between text-amber-300 font-bold border-t border-white/10 pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-300" />
                    Pending Audit Settlement:
                  </span>
                  <span className="font-mono text-amber-300">-₹{pendingSettlementTotal}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Quick Orders:</span>
                <span className="font-bold text-amber-300">Cash on Delivery</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Limit Automatic Mathematical Equation & Breakdown Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-700 shadow-md">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
              ∑
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                Pantry Credit Calculation Breakdown (Auto-Calculated)
              </h4>
              <p className="text-[11px] text-slate-400">
                Approved Limit minus (Home Stock Valuation + In-Transit Orders) = Available Limit
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 text-purple-300">
            Auto-Synced Live
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
          {/* Box 1: Total Approved Limit */}
          <button
            type="button"
            onClick={() => setMetricModalTab('APPROVED')}
            className="bg-slate-800/80 hover:bg-slate-750 hover:border-purple-400 p-3 rounded-xl border border-slate-700 transition cursor-pointer text-center group hover:scale-[1.02] active:scale-98"
          >
            <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <span>1. Approved Limit</span>
              <span className="text-[9px] opacity-0 group-hover:opacity-100 transition text-purple-200">🔍</span>
            </div>
            <div className="text-base sm:text-lg font-black text-white mt-0.5 group-hover:text-purple-200">
              ₹{approvedLimit.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Click to inspect credit line</div>
          </button>

          {/* Box 2: Home Pantry Stock Valuation */}
          <button
            type="button"
            onClick={() => setMetricModalTab('HOME_STOCK')}
            className="bg-slate-800/80 hover:bg-slate-750 hover:border-amber-400 p-3 rounded-xl border border-slate-700 transition cursor-pointer text-center group hover:scale-[1.02] active:scale-98"
          >
            <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <span>2. Home Stock Value</span>
              <span className="text-[9px] opacity-0 group-hover:opacity-100 transition text-amber-200">🔍</span>
            </div>
            <div className="text-base sm:text-lg font-black text-amber-300 mt-0.5 group-hover:text-amber-200">
              ₹{stockValuation.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {pantryItems.filter((i) => (i.quantity || 0) > 0 && i.status !== 'RETURNED').length} active items (Click list)
            </div>
          </button>

          {/* Box 3: In-Transit Orders Value */}
          <button
            type="button"
            onClick={() => setMetricModalTab('IN_TRANSIT')}
            className="bg-slate-800/80 hover:bg-slate-750 hover:border-sky-400 p-3 rounded-xl border border-slate-700 transition cursor-pointer text-center group hover:scale-[1.02] active:scale-98"
          >
            <div className="text-[10px] font-bold text-sky-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <span>3. In-Transit Orders</span>
              <span className="text-[9px] opacity-0 group-hover:opacity-100 transition text-sky-200">🔍</span>
            </div>
            <div className="text-base sm:text-lg font-black text-sky-300 mt-0.5 group-hover:text-sky-200">
              ₹{inTransitOrdersValue.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {inTransitPantryOrders.length} {inTransitPantryOrders.length === 1 ? 'order' : 'orders'} in delivery (Click)
            </div>
          </button>

          {/* Box 4: Total Used / Blocked Limit */}
          <button
            type="button"
            onClick={() => setMetricModalTab('TOTAL_USED')}
            className="bg-slate-800/80 hover:bg-slate-750 hover:border-rose-400 p-3 rounded-xl border border-rose-500/30 transition cursor-pointer text-center group hover:scale-[1.02] active:scale-98"
          >
            <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <span>4. Total Used (2+3)</span>
              <span className="text-[9px] opacity-0 group-hover:opacity-100 transition text-rose-200">🔍</span>
            </div>
            <div className="text-base sm:text-lg font-black text-rose-400 mt-0.5 group-hover:text-rose-300">
              ₹{effectiveUsedLimit.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Stock + Transit (Click reconciliation)</div>
          </button>

          {/* Box 5: Closing Available Limit */}
          <button
            type="button"
            onClick={() => setMetricModalTab('AVAILABLE')}
            className="bg-emerald-950/60 hover:bg-emerald-900/80 hover:border-emerald-400 p-3 rounded-xl border border-emerald-500/40 col-span-2 sm:col-span-1 transition cursor-pointer text-center group hover:scale-[1.02] active:scale-98"
          >
            <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <span>5. Available Closing</span>
              <span className="text-[9px] opacity-0 group-hover:opacity-100 transition text-emerald-200">🔍</span>
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5 group-hover:text-emerald-300">
              ₹{effectiveAvailableLimit.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-emerald-300/80 mt-0.5">Ready for Orders (Click equation)</div>
          </button>
        </div>
      </div>

      {/* Global Pending Settlement Alert Banner (Visible on all tabs) */}
      {pendingAudits.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-amber-500/15 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Action Required • Settlement Pending
                </span>
                <span className="text-xs text-slate-500 font-mono font-bold">
                  Bill #{pendingAudits[0].billId || pendingAudits[0].id}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1">
                Field Auditor Generated Audit Settlement Bill — Confirmation Required
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Auditor <strong>{pendingAudits[0].auditorName}</strong> completed physical check of {pendingAudits[0].totalItemsCount} pantry items.
                {pendingAudits[0].totalWalletDeduction ? (
                  <span className="text-rose-700 font-black ml-1.5 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Pending Settlement Deduction: ₹{pendingAudits[0].totalWalletDeduction}
                  </span>
                ) : (
                  <span className="text-emerald-700 font-bold ml-1.5">
                    All items verified available (₹0 deduction).
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={() => setSelectedAuditForView(pendingAudits[0])}
              className="w-full md:w-auto px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer flex items-center justify-center gap-2 transition"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Review &amp; Settle Bill</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-2 flex border-b gap-1 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'inventory'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          My Home Pantry ({pantryItems.length})
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'wallet'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Customer Wallet Ledger ({walletTxns.length})
        </button>

        <button
          onClick={() => setActiveTab('audits')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'audits'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Field Audits &amp; Bills ({auditorChecks.length})</span>
          {pendingAudits.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
              {pendingAudits.length} Action Needed
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'ledger'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Credit Balance Ledger
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'requests'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Returns &amp; Replacements ({returns.length + replacements.length})
        </button>

        {!customer.isChild && hasPantryAccess(customer) && (
          <button
            onClick={() => setActiveTab('family')}
            className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'family'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Family Linked Cards ({childCustomers.length})
          </button>
        )}
      </div>

      {/* TAB 1: My Home Pantry Items */}
      {activeTab === 'inventory' && (
        <div className="space-y-5">
          {/* Top Info Banner */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-lg border border-purple-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-purple-400/20 text-purple-300 border border-purple-400/30 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5" />
                  HOME PANTRY STOCK LEDGER
                </span>
                <span className="text-[11px] text-purple-200/80 font-medium">Customer Doorstep Inventory</span>
              </div>
              <h3 className="text-xl font-black text-white">
                Customer Household Inventory &amp; Stock Tracking
              </h3>
              <p className="text-xs text-purple-200/90 max-w-2xl">
                Yaha customer ke ghar me available in-stock pantry items, consume/used ho chuke 0-quantity items aur delivery orders ka item-level (MFG, EXP, Price, Images) audit detail track hota hai.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={fetchData}
                className="px-3.5 py-2 bg-purple-700/80 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-purple-500/30"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Inventory</span>
              </button>
            </div>
          </div>

          {/* Quick KPI Summary Cards */}
          {(() => {
            const activeItems = pantryItems.filter((i) => i.quantity > 0);
            const usedItems = filterUsedPantryItems(pantryItems);
            const totalActiveQty = activeItems.reduce((acc, i) => acc + (i.quantity || 0), 0);
            const totalActiveValuation = activeItems.reduce((acc, i) => acc + (i.quantity || 0) * (i.unitPrice || 0), 0);
            const expiringSoonCount = activeItems.filter((i) => i.isNearExpiry || i.isExpired).length;
            const deliveredOrdersCount = orders.filter((o) => o.orderStatus === 'DELIVERED').length;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-purple-800 tracking-wider">
                    <span>In Pantry Stock</span>
                    <Package className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-black text-purple-950 mt-1">
                    {activeItems.length} <span className="text-xs font-bold text-purple-700 font-sans">Products ({totalActiveQty} units)</span>
                  </div>
                  <div className="text-[10px] text-purple-700 mt-0.5">Available on Pantry Shelf</div>
                </div>

                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-rose-800 tracking-wider">
                    <span>Used / 0-Qty Box</span>
                    <Clock className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-black text-rose-950 mt-1">
                    {usedItems.length} <span className="text-xs font-bold text-rose-700 font-sans">Products</span>
                  </div>
                  <div className="text-[10px] text-rose-700 mt-0.5">Latest 30 Consumed Products (Max 2/Batch)</div>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                    <span>Stock Valuation</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-950 mt-1">
                    ₹{totalActiveValuation.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">Current Physical Value</div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-blue-800 tracking-wider">
                    <span>Delivered Orders</span>
                    <Truck className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-blue-950 mt-1">
                    {deliveredOrdersCount} <span className="text-xs font-bold text-blue-700 font-sans">Orders</span>
                  </div>
                  <div className="text-[10px] text-blue-700 mt-0.5">
                    {expiringSoonCount > 0 ? (
                      <span className="text-amber-700 font-bold">⚠️ {expiringSoonCount} near expiry</span>
                    ) : (
                      'All stock fresh'
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Sub-Tab Navigation Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setPantrySubTab('active')}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  pantrySubTab === 'active'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>🟢 In Pantry Stock</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  pantrySubTab === 'active' ? 'bg-purple-900 text-white' : 'bg-slate-200 text-slate-800'
                }`}>
                  {pantryItems.filter((i) => i.quantity > 0).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPantrySubTab('used')}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  pantrySubTab === 'used'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span>🔴 Used / Consumed Box (0 Qty)</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  pantrySubTab === 'used' ? 'bg-rose-900 text-white' : 'bg-slate-200 text-slate-800'
                }`}>
                  {filterUsedPantryItems(pantryItems).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPantrySubTab('deliveries')}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  pantrySubTab === 'deliveries'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>📦 Delivered Orders (Pantry vs COD)</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  pantrySubTab === 'deliveries' ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-800'
                }`}>
                  {orders.filter((o) => o.orderStatus === 'DELIVERED').length}
                </span>
              </button>
            </div>

            {/* Search and Filters for Inventory */}
            {pantrySubTab !== 'deliveries' && (
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={pantrySearchQuery}
                    onChange={(e) => setPantrySearchQuery(e.target.value)}
                    placeholder="Search product, brand, batch..."
                    className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-purple-600 bg-slate-50 font-medium"
                  />
                  {pantrySearchQuery && (
                    <button
                      onClick={() => setPantrySearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <select
                  value={pantryExpiryFilter}
                  onChange={(e) => setPantryExpiryFilter(e.target.value as any)}
                  className="text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:outline-hidden focus:border-purple-600 cursor-pointer"
                >
                  <option value="ALL">All Expiry</option>
                  <option value="FRESH">Fresh Items</option>
                  <option value="NEAR_EXPIRY">Near Expiry (&lt;30d)</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            )}
          </div>

          {/* Used Sub-Tab Notice Banner */}
          {pantrySubTab === 'used' && (
            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3 flex items-center justify-between text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Rolling Used History:</strong> Displaying up to 30 most recent consumed products (Max 2 per barcode &amp; batch). Older history is automatically pruned.
                </span>
              </div>
              <span className="px-2 py-0.5 bg-rose-200/80 text-rose-900 rounded-full text-[10px] font-bold font-mono shrink-0">
                {filterUsedPantryItems(pantryItems).length} / 30 Max
              </span>
            </div>
          )}

          {/* SubTab 1 & 2: Active vs Used Pantry Items Grid */}
          {(pantrySubTab === 'active' || pantrySubTab === 'used') && (
            <div>
              {loading ? (
                <div className="py-16 text-center text-slate-400 text-xs">Loading pantry inventory...</div>
              ) : (() => {
                const basePool = pantrySubTab === 'active'
                  ? pantryItems.filter((i) => i.quantity > 0)
                  : filterUsedPantryItems(pantryItems);

                const targetList = basePool.filter((i) => {
                  if (pantrySearchQuery.trim()) {
                    const q = pantrySearchQuery.toLowerCase();
                    const matches =
                      i.productName.toLowerCase().includes(q) ||
                      (i.brand && i.brand.toLowerCase().includes(q)) ||
                      (i.batchNumber && i.batchNumber.toLowerCase().includes(q)) ||
                      (i.barcode && i.barcode.toLowerCase().includes(q));
                    if (!matches) return false;
                  }

                  if (pantryExpiryFilter === 'FRESH') return !i.isNearExpiry && !i.isExpired;
                  if (pantryExpiryFilter === 'NEAR_EXPIRY') return i.isNearExpiry;
                  if (pantryExpiryFilter === 'EXPIRED') return i.isExpired;

                  return true;
                });

                if (targetList.length === 0) {
                  return (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
                      <CreditCard className="w-12 h-12 mx-auto text-slate-300" />
                      <div>
                        <h4 className="text-base font-bold text-slate-700">
                          {pantrySubTab === 'active'
                            ? 'No Active In-Stock Items Found'
                            : 'No Consumed Items in Used History Box'}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                          {pantrySubTab === 'active'
                            ? 'Your household pantry currently has no in-stock items matching the criteria. Order groceries with your Pantry Card to replenish stock.'
                            : 'When active stock quantities are fully consumed (or returned/adjusted), they are preserved here in 0-quantity archive for records.'}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {targetList.map((item) => {
                      const isUsed = item.quantity === 0;
                      const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);

                      return (
                        <div
                          key={item.id}
                          className={`bg-white rounded-3xl border shadow-xs p-4 flex flex-col justify-between transition hover:shadow-md ${
                            isUsed
                              ? 'border-rose-200 bg-gradient-to-b from-white to-rose-50/20'
                              : 'border-slate-200 bg-white hover:border-purple-300'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Header row with status badge */}
                            <div className="flex items-center justify-between gap-2">
                              {isUsed ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-rose-600" />
                                  USED / CONSUMED (0 QTY)
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  IN PANTRY STOCK ({item.quantity} {item.quantity === 1 ? 'Unit' : 'Units'})
                                </span>
                              )}

                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                {item.id}
                              </span>
                            </div>

                            {/* Product Info & High-res Image */}
                            <div className="flex items-start gap-3">
                              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0 relative group">
                                <ImageWithFallback src={item.image} alt={item.productName} />
                                {item.isExpired ? (
                                  <div className="absolute inset-0 bg-rose-900/60 flex items-center justify-center text-[9px] font-black text-white uppercase text-center px-1">
                                    Expired
                                  </div>
                                ) : item.isNearExpiry ? (
                                  <div className="absolute bottom-0 inset-x-0 bg-amber-600/90 text-white text-[8px] font-black text-center py-0.5 uppercase">
                                    Expiring
                                  </div>
                                ) : null}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider truncate">
                                  {item.brand || 'Brand'} • {item.weightSize || 'Standard'}
                                </div>
                                <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 mt-0.5">
                                  {item.productName}
                                </h4>

                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-mono font-bold text-[10px]">
                                    Batch #{item.batchNumber}
                                  </span>
                                  {item.barcode && (
                                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                                      <Barcode className="w-3 h-3" />
                                      {item.barcode}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Manufacturing, Expiry, Price & Delivery Details Table */}
                            <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-[11px]">Unit Selling Price:</span>
                                <span className="font-extrabold text-slate-900 font-mono text-xs">
                                  ₹{item.unitPrice}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-[11px]">Current Stock Value:</span>
                                <span className={`font-mono font-black text-xs ${isUsed ? 'text-rose-700 line-through' : 'text-emerald-700'}`}>
                                  ₹{lineTotal}
                                </span>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                                <span className="text-slate-500 text-[11px]">MFG Date:</span>
                                <span className="font-mono text-slate-700 font-semibold text-[11px]">
                                  {(item as any).manufacturingDate || (item as any).mfgDate || 'Available in Batch'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-[11px]">EXP Date:</span>
                                <span
                                  className={`font-mono text-[11px] font-bold ${
                                    item.isExpired
                                      ? 'text-rose-600'
                                      : item.isNearExpiry
                                      ? 'text-amber-600'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {item.expiryDate}
                                  {item.isExpired && ' (Expired)'}
                                  {item.isNearExpiry && ' (Expiring Soon)'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                                <span className="text-slate-500 text-[11px]">Delivered On:</span>
                                <div className="flex flex-col items-end">
                                  <span className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    {item.deliveryDate}
                                  </span>
                                  {(() => {
                                    const dayInfo = getDeliveryDayCount(item.deliveryDate);
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

                              {item.orderId && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 text-[11px]">Inward Order Ref:</span>
                                  <span className="font-mono font-bold text-purple-700 text-[11px]">
                                    {item.orderId}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Footers */}
                          <div className="space-y-2 pt-3 border-t border-slate-100 mt-3">
                            <button
                              onClick={() => handleViewTimeline(item.productId)}
                              disabled={loadingTimeline}
                              className="w-full py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                            >
                              <Clock className="w-3.5 h-3.5 text-purple-200" />
                              <span>View Work History &amp; Timeline</span>
                            </button>

                            {!isUsed && item.quantity > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleOpenActionModal(item, 'RETURN')}
                                  disabled={!item.isReturnEligible}
                                  className="py-1.5 px-2 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Return Stock</span>
                                </button>

                                <button
                                  onClick={() => handleOpenActionModal(item, 'REPLACEMENT')}
                                  className="py-1.5 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-purple-200"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Replace Item</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SubTab 3: Delivered Orders Breakdown (Pantry vs COD) */}
          {pantrySubTab === 'deliveries' && (
            <div className="space-y-4">
              {/* Delivery Sub-Filter Strip */}
              <div className="flex items-center justify-between gap-3 bg-slate-100 p-1.5 rounded-2xl">
                <div className="flex items-center gap-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDeliveryTypeFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                      deliveryTypeFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Delivered ({orders.filter((o) => o.orderStatus === 'DELIVERED').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryTypeFilter('PANTRY')}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                      deliveryTypeFilter === 'PANTRY'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pantry Orders (Inward Stock)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryTypeFilter('QUICK')}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                      deliveryTypeFilter === 'QUICK'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>COD Quick Orders</span>
                  </button>
                </div>
              </div>

              {/* Delivered Orders List with item-by-item images and dates */}
              {(() => {
                const deliveredList = orders
                  .filter((o) => o.orderStatus === 'DELIVERED')
                  .filter((o) => {
                    if (deliveryTypeFilter === 'PANTRY') return o.orderType === 'PANTRY';
                    if (deliveryTypeFilter === 'QUICK') return o.orderType === 'QUICK';
                    return true;
                  });

                if (deliveredList.length === 0) {
                  return (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
                      <Truck className="w-12 h-12 mx-auto text-slate-300" />
                      <h4 className="text-base font-bold text-slate-700">No Delivered Orders Found</h4>
                      <p className="text-xs text-slate-400">
                        Delivered pantry orders automatically inward items to your active home pantry stock.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {deliveredList.map((order) => {
                      const isPantry = order.orderType === 'PANTRY';
                      const dt = formatOrderDateTime(getOrderPreciseTimestamp(order));

                      return (
                        <div
                          key={order.id}
                          className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden"
                        >
                          {/* Order Header */}
                          <div className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
                            isPantry ? 'bg-purple-50/60 border-purple-100' : 'bg-amber-50/60 border-amber-100'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                isPantry ? 'bg-purple-200 text-purple-800' : 'bg-amber-200 text-amber-800'
                              }`}>
                                {isPantry ? <CreditCard className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
                              </div>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-extrabold text-sm text-slate-900">
                                    {order.id}
                                  </span>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isPantry
                                      ? 'bg-purple-200 text-purple-900 border border-purple-300'
                                      : 'bg-amber-200 text-amber-900 border border-amber-300'
                                  }`}>
                                    {isPantry ? 'Pantry Inward Order' : 'COD Quick Order'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    DELIVERED
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

                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {dt.date} • {dt.time || 'N/A'}
                                  </span>
                                  {order.assignedDeliveryBoyName && (
                                    <span>
                                      Delivered by: <strong>{order.assignedDeliveryBoyName}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0">
                              <div className="text-xs text-slate-500">Order Amount</div>
                              <div className="text-lg font-black text-slate-900 font-mono">
                                ₹{order.totalAmount}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {isPantry ? 'Debited from Pantry Limit (₹0 Cash)' : 'Paid Cash On Delivery'}
                              </div>
                            </div>
                          </div>

                          {/* Ordered Items with Photos, Expiry, MFG, Price */}
                          <div className="p-4 sm:p-5 space-y-3">
                            <div className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Boxes className="w-4 h-4 text-purple-600" />
                              <span>Items In This Order ({order.items.length})</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {order.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3"
                                >
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
                                    <ImageWithFallback src={it.image} alt={it.productName} />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase truncate">
                                      {it.brand || 'Brand'} • {it.weightSize || ''}
                                    </div>
                                    <h5 className="font-bold text-slate-900 text-xs truncate">
                                      {it.productName}
                                    </h5>

                                    <div className="flex items-center gap-2 mt-1 text-[11px] font-medium text-slate-600 flex-wrap">
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
                                      {isPantry && it.batchNumber && (
                                        <>
                                          <span>•</span>
                                          <span className="font-mono text-purple-700 font-bold">Batch #{it.batchNumber}</span>
                                        </>
                                      )}
                                    </div>

                                    {isPantry && (it.manufacturingDate || it.expiryDate) && (
                                      <div className="text-[10px] text-slate-500 mt-1 font-mono flex items-center gap-2 flex-wrap">
                                        {it.manufacturingDate && <span>MFG: {it.manufacturingDate}</span>}
                                        {it.expiryDate && (
                                          <span className="font-bold text-emerald-700">EXP: {it.expiryDate}</span>
                                        )}
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
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Customer Wallet Ledger */}
      {activeTab === 'wallet' && (() => {
        const creditTxns = walletTxns.filter(
          (t) =>
            t.amount > 0 ||
            ['ADMIN_ADDITION', 'RECHARGE', 'INITIAL_DEPOSIT', 'AUDIT_REFUND', 'ONLINE_TOPUP'].includes(
              t.transactionType
            )
        );
        const debitTxns = walletTxns.filter(
          (t) =>
            t.amount < 0 ||
            ['AUDIT_DEDUCTION', 'PENALTY_DEDUCTION', 'WALLET_DEDUCTION', 'ORDER_PAYMENT'].includes(
              t.transactionType
            )
        );
        const auditDeductions = walletTxns.filter(
          (t) =>
            Boolean(t.auditId) ||
            t.transactionType === 'AUDIT_DEDUCTION' ||
            (t.referenceId && t.referenceId.startsWith('AUD-'))
        );
        const totalCreditsVal = creditTxns.reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);
        const totalDebitsVal = debitTxns.reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);
        const closingBal = customer.walletBalance ?? 1000;

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
            {/* Top Hero Banner */}
            <div
              onClick={() => setWalletModalTab('FORMULA')}
              className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white rounded-2xl shadow-md border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-emerald-400 transition group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    TOP CLOSING WALLET BALANCE
                  </span>
                  <span className="text-[10px] text-emerald-300 font-semibold opacity-0 group-hover:opacity-100 transition">
                    Click to view math breakdown ↗
                  </span>
                </div>
                <h3 className="font-black text-white text-lg sm:text-2xl flex items-center gap-2 mt-1.5">
                  <Wallet className="w-6 h-6 text-emerald-400" />
                  <span>Closing Balance: ₹{closingBal.toLocaleString('en-IN')}</span>
                </h3>
                <p className="text-xs text-emerald-100/80 mt-0.5">
                  Audit discrepancy deductions, security deposit top-ups, and live passbook accounting.
                </p>
              </div>
              <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/20 text-xs font-bold text-white text-right">
                <div className="text-[10px] text-emerald-300 uppercase">Live Account Status</div>
                <div className="text-sm">{closingBal < 0 ? 'Negative Due' : 'Active Balance'}</div>
              </div>
            </div>

            {/* 4 Clickable Metric Boxes */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-700 shadow-md space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-black text-slate-200">
                    Live Wallet Equation &amp; Balance Breakdown
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                    Click any box to inspect items
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Formula: [Total Top-ups &amp; Deposits] - [Total Deductions] = Closing Balance
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
                {/* 1. Total Credits / Top-ups */}
                <button
                  type="button"
                  onClick={() => setWalletModalTab('CREDITS')}
                  className="bg-emerald-950/40 hover:bg-emerald-950/70 p-2.5 rounded-xl border border-emerald-600/40 hover:border-emerald-400 transition text-left cursor-pointer group"
                >
                  <div className="text-[10px] text-emerald-300 font-bold uppercase truncate flex items-center justify-between">
                    <span>1. Total Credits (+)</span>
                    <span className="text-[9px] opacity-0 group-hover:opacity-100 text-emerald-300 font-normal">View ↗</span>
                  </div>
                  <div className="text-base font-black text-emerald-300 mt-1">
                    +₹{totalCreditsVal.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[9px] text-emerald-200/70 mt-0.5">
                    {creditTxns.length} deposit &amp; top-ups
                  </div>
                </button>

                {/* 2. Total Deductions */}
                <button
                  type="button"
                  onClick={() => setWalletModalTab('DEDUCTIONS')}
                  className="bg-rose-950/40 hover:bg-rose-950/70 p-2.5 rounded-xl border border-rose-600/40 hover:border-rose-400 transition text-left cursor-pointer group"
                >
                  <div className="text-[10px] text-rose-300 font-bold uppercase truncate flex items-center justify-between">
                    <span>2. Total Deductions (-)</span>
                    <span className="text-[9px] opacity-0 group-hover:opacity-100 text-rose-300 font-normal">View ↗</span>
                  </div>
                  <div className="text-base font-black text-rose-300 mt-1">
                    -₹{totalDebitsVal.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[9px] text-rose-200/70 mt-0.5">
                    {debitTxns.length} audit &amp; debits
                  </div>
                </button>

                {/* 3. Audit Bills */}
                <button
                  type="button"
                  onClick={() => setWalletModalTab('AUDIT_SETTLEMENTS')}
                  className="bg-amber-950/40 hover:bg-amber-950/70 p-2.5 rounded-xl border border-amber-600/40 hover:border-amber-400 transition text-left cursor-pointer group"
                >
                  <div className="text-[10px] text-amber-300 font-bold uppercase truncate flex items-center justify-between">
                    <span>3. Audit Discrepancies</span>
                    <span className="text-[9px] opacity-0 group-hover:opacity-100 text-amber-300 font-normal">View ↗</span>
                  </div>
                  <div className="text-base font-black text-amber-300 mt-1">
                    {auditDeductions.length} Settlements
                  </div>
                  <div className="text-[9px] text-amber-200/70 mt-0.5">
                    Field audit bills
                  </div>
                </button>

                {/* 4. Closing Balance (=) */}
                <button
                  type="button"
                  onClick={() => setWalletModalTab('FORMULA')}
                  className="bg-cyan-950/50 hover:bg-cyan-950/80 p-2.5 rounded-xl border border-cyan-500/50 hover:border-cyan-400 transition text-left cursor-pointer group"
                >
                  <div className="text-[10px] text-cyan-300 font-bold uppercase truncate flex items-center justify-between">
                    <span>4. Closing Balance (=)</span>
                    <span className="text-[9px] opacity-0 group-hover:opacity-100 text-cyan-300 font-normal">Proof ↗</span>
                  </div>
                  <div className={`text-base font-black mt-1 ${closingBal < 0 ? 'text-rose-400' : 'text-cyan-300'}`}>
                    ₹{closingBal.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[9px] text-cyan-200/70 mt-0.5">
                    Kaise ye amount hua?
                  </div>
                </button>
              </div>
            </div>

            {/* Passbook Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Txn ID &amp; Date Time</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Reason / Details</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3 text-right">Closing Balance</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {walletTxns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No wallet transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    walletTxns.map((w, idx) => {
                      const isLatest = idx === 0;
                      const dateStr = w.timestamp
                        ? new Date(w.timestamp).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          })
                        : `${w.date} ${w.time || ''}`;

                      return (
                        <tr key={w.id} className={`hover:bg-slate-50 ${isLatest ? 'bg-emerald-50/30' : ''}`}>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{w.id}</span>
                              {isLatest && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-600 text-white">
                                  TOP
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {dateStr}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                w.transactionType === 'ADMIN_RECHARGE' || w.amount > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {w.transactionType === 'ADMIN_RECHARGE' ? 'RECHARGE TOP-UP' : (w.amount > 0 ? 'CREDIT' : 'AUDIT DEDUCTION')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            <div className="font-semibold">{w.reason || (w as any).notes || 'Discrepancy settlement'}</div>
                            {w.auditId && (
                              <div className="text-[10px] text-slate-400 font-mono">Ref: {w.auditId}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            {w.amount > 0 ? (
                              <span className="text-emerald-600">+₹{w.amount}</span>
                            ) : (
                              <span className="text-rose-600">-₹{Math.abs(w.amount)}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            ₹{w.newBalance}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-emerald-700 text-[10px] font-bold">SUCCESS</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* TAB 3: Field Audits & Verified Bills */}
      {activeTab === 'audits' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-cyan-600" />
              <span>Doorstep Field Audits &amp; Verified Settlement Statements</span>
            </h3>
            <p className="text-xs text-slate-500">
              Audit Settlement Bills generated by Auditors. Confirm to lock and seal statement.
            </p>
          </div>

          {/* Pending Confirmation Alert Banner */}
          {auditorChecks.some(
            (a) => !a.isBillLocked && (a.status === 'CUSTOMER_PENDING_CONFIRMATION' || a.status === 'BILL_GENERATED' || a.billStatus === 'GENERATED' || a.status === 'DISPUTED' || (a.status === 'COMPLETED' && !a.isBillConfirmed))
          ) && (
            <div className="m-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Action Required:</strong> The Field Auditor has generated an Audit Settlement Bill. Please review and confirm to finalize.
                </span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Bill / Audit ID</th>
                  <th className="py-3 px-3">Field Auditor</th>
                  <th className="py-3 px-3">Bill Status</th>
                  <th className="py-3 px-3 text-center">Items Inspected</th>
                  <th className="py-3 px-3 text-right">Wallet Deducted</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditorChecks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No field audits scheduled or recorded for your household.
                    </td>
                  </tr>
                ) : (
                  auditorChecks.map((a) => {
                    const isLocked = a.isBillLocked || a.billStatus === 'LOCKED' || a.status === 'LOCKED';
                    const isPendingConfirmation = !isLocked && (a.status === 'CUSTOMER_PENDING_CONFIRMATION' || a.status === 'BILL_GENERATED' || a.billStatus === 'GENERATED' || a.status === 'COMPLETED');
                    const isDisputed = a.status === 'DISPUTED' || a.billStatus === 'DISPUTED';
                    return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td
                          className="py-3 px-4 font-mono font-bold text-slate-900 cursor-pointer group"
                          onClick={() => setSelectedAuditForView(a)}
                          title="Click to view Settlement Bill details"
                        >
                          <div className="group-hover:text-purple-700 underline flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5 text-purple-600 inline shrink-0" />
                            <span>{a.billId || a.id}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-purple-600 shrink-0" />
                            <span>{a.visitDate || a.requestedDate || 'N/A'}</span>
                            <Clock className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
                            <span>{a.visitTime || (a.startedAt ? a.startedAt.split(' ')[1] : a.requestedTime) || '11:00 AM'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{a.auditorName}</td>
                        <td className="py-3 px-3">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Lock className="w-3 h-3 text-emerald-700" />
                              LOCKED (Confirmed)
                            </span>
                          ) : isDisputed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-700" />
                              DISPUTED
                            </span>
                          ) : isPendingConfirmation ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-700" />
                              CONFIRMATION REQUIRED
                            </span>
                          ) : (
                            <StatusBadge status={a.status as any} />
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-bold">{a.totalItemsCount}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                          ₹{a.totalWalletDeduction || 0}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {a.status === 'REQUESTED' && (
                              <button
                                onClick={() => handleConfirmAuditVisit(a.id)}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold cursor-pointer"
                              >
                                Confirm Visit
                              </button>
                            )}
                            {isPendingConfirmation ? (
                              <button
                                onClick={() => setSelectedAuditForView(a)}
                                className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Review &amp; Confirm Bill</span>
                              </button>
                            ) : isDisputed ? (
                              <button
                                onClick={() => setSelectedAuditForView(a)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Review Disputed Bill</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedAuditForView(a)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3 text-cyan-700" />
                                <span>{isLocked ? 'View Locked Bill' : 'View Bill'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Credit Balance Ledger */}
      {activeTab === 'ledger' && (() => {
        const totalDebits = ledger.filter((r) => r.amount < 0).reduce((acc, r) => acc + Math.abs(r.amount), 0);
        const totalCredits = ledger.filter((r) => r.amount > 0).reduce((acc, r) => acc + r.amount, 0);

        const filteredLedger = ledger.filter((row) => {
          if (ledgerFilter === 'DEBIT' && row.amount >= 0) return false;
          if (ledgerFilter === 'CREDIT' && row.amount <= 0) return false;
          if (ledgerFilter === 'PANTRY_ORDER_DEBIT' && row.transactionType !== 'PANTRY_ORDER_DEBIT') return false;
          if (ledgerFilter === 'RETURN_CREDIT' && row.transactionType !== 'RETURN_CREDIT') return false;

          if (ledgerSearchQuery.trim()) {
            const q = ledgerSearchQuery.toLowerCase().trim();
            const matchId = row.id.toLowerCase().includes(q);
            const matchRef = (row.referenceId || '').toLowerCase().includes(q);
            const matchDesc = row.description.toLowerCase().includes(q);
            const matchType = (row.transactionType || '').toLowerCase().includes(q);
            return matchId || matchRef || matchDesc || matchType;
          }
          return true;
        });

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-6 p-4 sm:p-6">
            {/* Top Reconciled Summary Header Banner */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-2xl shadow-lg border border-purple-900/50 relative overflow-hidden space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ RECONCILED STATEMENT
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Opening &amp; Closing Reconciliation
                    </span>
                  </div>
                  <h3 className="font-black text-white text-lg sm:text-xl flex items-center gap-2 mt-1">
                    <CreditCard className="w-6 h-6 text-purple-400" />
                    <span>Customer Credit Limit Statement</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Full date-wise &amp; transaction-wise calculation breakdown. Verify opening balance, debits, credits, and closing limit.
                  </p>
                </div>

                <div className="flex items-center gap-3 self-start md:self-auto">
                  <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/20 text-right">
                    <div className="text-[10px] text-purple-200 uppercase font-bold">Approved Limit</div>
                    <div className="text-lg font-black text-white">₹{customer.pantryLimit.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="bg-emerald-500/20 px-4 py-2.5 rounded-xl border border-emerald-400/30 text-right">
                    <div className="text-[10px] text-emerald-300 uppercase font-bold">Closing Available</div>
                    <div className="text-lg font-black text-emerald-400">₹{customer.availablePantryLimit.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>

              {/* Formula & Reconciliation Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Total Debits (-)</div>
                  <div className="text-sm sm:text-base font-extrabold text-rose-400 mt-0.5">
                    - ₹{totalDebits.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Total Credits (+)</div>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5">
                    + ₹{totalCredits.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Current Used Credit</div>
                  <div className="text-sm sm:text-base font-extrabold text-amber-400 mt-0.5">
                    ₹{customer.usedPantryLimit.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Reconciliation Equation</div>
                  <div className="text-[11px] font-mono font-bold text-purple-200 mt-0.5 truncate">
                    Opening ± Txn = Closing
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                <button
                  onClick={() => setLedgerFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ledgerFilter === 'ALL'
                      ? 'bg-purple-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All ({ledger.length})
                </button>
                <button
                  onClick={() => setLedgerFilter('DEBIT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ledgerFilter === 'DEBIT'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  Debits (-)
                </button>
                <button
                  onClick={() => setLedgerFilter('CREDIT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ledgerFilter === 'CREDIT'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  Credits (+)
                </button>
                <button
                  onClick={() => setLedgerFilter('PANTRY_ORDER_DEBIT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ledgerFilter === 'PANTRY_ORDER_DEBIT'
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Pantry Orders
                </button>
                <button
                  onClick={() => setLedgerFilter('RETURN_CREDIT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ledgerFilter === 'RETURN_CREDIT'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Returns / Restores
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search Txn ID, Order #, Reason..."
                  value={ledgerSearchQuery}
                  onChange={(e) => setLedgerSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Reconciled Statement Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date &amp; Exact Time</th>
                    <th className="py-3 px-3">Txn Type &amp; Direction</th>
                    <th className="py-3 px-3 text-right">Opening Limit</th>
                    <th className="py-3 px-3 text-right">Txn Amount</th>
                    <th className="py-3 px-3 text-right">Closing Available Limit</th>
                    <th className="py-3 px-4">Detailed Calculation &amp; Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No statement transactions found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((row, idx) => {
                      const isLatest = idx === 0 && ledgerFilter === 'ALL' && !ledgerSearchQuery;
                      const dateStr = row.createdAt
                        ? new Date(row.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          })
                        : `${row.date || ''} ${row.time || ''}`;

                      const amountVal = row.amount || 0;
                      const isCredit = amountVal > 0;
                      const isDebit = amountVal < 0;
                      const closingVal = row.closingLimit ?? row.balanceAfter ?? customer.availablePantryLimit;
                      const openingVal = row.openingLimit !== undefined ? row.openingLimit : closingVal - amountVal;

                      return (
                        <tr key={row.id} className={`hover:bg-slate-50/90 ${isLatest ? 'bg-purple-50/40' : ''}`}>
                          <td className="py-3.5 px-4 font-mono text-slate-800">
                            <div className="font-bold flex items-center gap-1.5 text-slate-900">
                              <span>{row.id}</span>
                              {isLatest && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-purple-800 text-white">
                                  LATEST
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">{dateStr}</div>
                          </td>

                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                isDebit
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : isCredit
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-purple-100 text-purple-800 border border-purple-200'
                              }`}
                            >
                              <span>{isDebit ? 'DEBIT (-)' : isCredit ? 'CREDIT (+)' : 'LIMIT'}</span>
                              <span className="text-[9px] opacity-75">• {row.transactionType ? row.transactionType.replace(/_/g, ' ') : 'TXN'}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-700">
                            ₹{openingVal.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-black text-sm">
                            {isCredit ? (
                              <span className="text-emerald-600">+₹{amountVal.toLocaleString('en-IN')}</span>
                            ) : isDebit ? (
                              <span className="text-rose-600">-₹{Math.abs(amountVal).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-slate-500">₹0</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-black text-sm text-purple-950">
                            ₹{closingVal.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="text-slate-800 font-semibold">{row.description}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                                Math: ₹{openingVal.toLocaleString('en-IN')} {isCredit ? '+' : '-'} ₹{Math.abs(amountVal).toLocaleString('en-IN')} = ₹{closingVal.toLocaleString('en-IN')}
                              </span>
                              {row.referenceId && (
                                <span className="text-purple-700 font-bold">
                                  Ref: {row.referenceId}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* TAB 5: Returns & Replacements */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Returns Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                <span>Return Requests ({returns.length})</span>
              </h3>
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3 text-center">Qty</th>
                  <th className="py-3 px-3">Initiated &amp; Reason</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Credit Value</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No return requests logged.
                    </td>
                  </tr>
                ) : (
                  returns.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.id}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{r.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Batch: {r.batchNumber}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold">{r.quantity}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700">
                            {r.initiatedBy}
                          </span>
                          {r.auditId && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-[10px] font-bold text-purple-800 border border-purple-200">
                              Audit #{r.auditId}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{r.reason}</p>
                        {r.rejectionReason && (
                          <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                            Rejection: {r.rejectionReason}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        {r.status === 'COMPLETED' ? (
                          <span className="text-emerald-600">+₹{r.creditRestoreAmount || r.refundCreditAmount}</span>
                        ) : (
                          <span className="text-slate-500 font-normal">Pending (+₹{r.refundCreditAmount})</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancelReturn(r.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Replacements Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-purple-600" />
                <span>Replacement Requests ({replacements.length})</span>
              </h3>
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3 text-center">Qty</th>
                  <th className="py-3 px-3">Initiated &amp; Reason</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Fresh Batch Dispatched</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {replacements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No replacement requests logged.
                    </td>
                  </tr>
                ) : (
                  replacements.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{rep.id}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{rep.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Original Batch: {rep.originalBatchNumber}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold">{rep.quantity}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700">
                            {rep.initiatedBy}
                          </span>
                          {rep.auditId && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-[10px] font-bold text-purple-800 border border-purple-200">
                              Audit #{rep.auditId}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{rep.reason}</p>
                        {rep.rejectionReason && (
                          <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                            Rejection: {rep.rejectionReason}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={rep.status} />
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-purple-700">
                        {rep.replacementBatchNumber ? `Batch #${rep.replacementBatchNumber}` : 'Awaiting Dispatch'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {rep.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancelReplacement(rep.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: Family Linked Cards */}
      {activeTab === 'family' && !customer.isChild && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span>Linked Family Member Cards</span>
              </h3>
              <p className="text-xs text-slate-500">
                Allow family members to order under your account with customized sub-limits.
              </p>
            </div>

            <button
              onClick={() => setIsChildModalOpen(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Add Family Member</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {childCustomers.map((child) => (
              <div
                key={child.id}
                className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{child.fullName}</h4>
                    <span className="text-[11px] text-purple-700 font-semibold">{child.relationInfo || 'Family'}</span>
                  </div>
                  <span className="font-mono text-xs font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md">
                    {child.id}
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex justify-between pt-2 border-t border-purple-200/60">
                  <span>Mobile: +91 {child.mobile}</span>
                  <span className="font-bold text-emerald-700">Sub-Limit: ₹{child.pantryLimit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW AUDIT REPORT MODAL */}
      {selectedAuditForView && (
        <AuditBillModal
          audit={selectedAuditForView}
          onClose={() => setSelectedAuditForView(null)}
          onConfirmBill={handleConfirmAuditBill}
          onDisputeBill={handleDisputeAuditBill}
          isCustomerView={true}
        />
      )}

      {/* Return / Replacement Modal */}
      {selectedItemForAction && actionType && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {actionType === 'RETURN' ? 'Return Pantry Item' : 'Request Item Replacement'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Item: <strong>{selectedItemForAction.productName}</strong> (Batch #{selectedItemForAction.batchNumber})
            </p>

            <form onSubmit={handleSubmitAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity to {actionType === 'RETURN' ? 'Return' : 'Replace'} (Max: {selectedItemForAction.quantity})
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedItemForAction.quantity}
                  value={requestQty}
                  onChange={(e) => setRequestQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    actionType === 'RETURN'
                      ? 'e.g. Ordered extra quantity by mistake'
                      : 'e.g. Package damaged in transit / seal broken'
                  }
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              {actionType === 'RETURN' && (
                <div className="p-3 bg-emerald-50 rounded-lg text-xs text-emerald-800">
                  Estimated limit credit restore: <strong>₹{requestQty * selectedItemForAction.unitPrice}</strong>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseActionModal}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs cursor-pointer"
                >
                  {submittingAction ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Child Modal */}
      {isChildModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create Family Linked Card</h3>
            <p className="text-xs text-slate-500 mb-4">
              Allows family members to order using their dedicated card ID with shared credit pool.
            </p>

            <form onSubmit={handleCreateChildCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={childFormData.fullName}
                  onChange={(e) => setChildFormData({ ...childFormData, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile (For OTP Login) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543211"
                  value={childFormData.mobile}
                  onChange={(e) => setChildFormData({ ...childFormData, mobile: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
                <input
                  type="text"
                  placeholder="e.g. Spouse, Son, Daughter"
                  value={childFormData.relationInfo}
                  onChange={(e) => setChildFormData({ ...childFormData, relationInfo: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs space-y-1">
                <div className="font-bold text-purple-900 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                  Shared Family Account Limits & Wallet
                </div>
                <p className="text-purple-700 leading-relaxed text-[11px]">
                  Family members automatically share the Head of Family&apos;s Pantry Credit Limit (<strong>₹{customer.pantryLimit.toLocaleString('en-IN')}</strong>) and Wallet Balance (<strong>₹{(customer.walletBalance ?? 1000).toLocaleString('en-IN')}</strong>). All debits will be managed directly from your parent account.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsChildModalOpen(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Create Child Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Timeline & Work History Modal */}
      {selectedTimeline && (
        <ProductTimelineModal
          timeline={selectedTimeline}
          onClose={() => setSelectedTimeline(null)}
          customerName={customer.fullName}
        />
      )}

      {/* Credit Limit & Stock Valuation Itemized Breakdown Modal */}
      {metricModalTab && (
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
      {walletModalTab && (
        <WalletDetailModal
          isOpen={true}
          onClose={() => setWalletModalTab(null)}
          initialTab={walletModalTab}
          customer={customer}
          walletTxns={walletTxns}
        />
      )}
    </div>
  );
};
