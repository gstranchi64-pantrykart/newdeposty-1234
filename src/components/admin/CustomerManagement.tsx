import React, { useState, useEffect } from 'react';
import { Customer, PantryCardItem, PantryCreditLedger, Order, WalletTransaction, CustomerProductTimeline, PantryPayment, AuditorCheck } from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ProductTimelineModal } from '../common/ProductTimelineModal';
import { AppWindowModal } from '../common/AppWindowModal';
import { AuditBillModal } from '../common/AuditBillModal';
import { CreditLimitDetailModal, LimitMetricTab } from '../customer/CreditLimitDetailModal';
import {
  Users,
  Search,
  PlusCircle,
  CreditCard,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  X,
  UserPlus,
  Wallet,
  Calendar,
  Clock,
  KeyRound,
  Send,
  Lock,
  RefreshCw,
  Info,
  Eye,
  Boxes,
  Package,
  DollarSign,
  Truck,
  Tag,
  Sparkles,
  Barcode,
} from 'lucide-react';
import { formatOrderDateTime, getOrderPreciseTimestamp, getDeliveryDayCount } from '../../utils/dateTimeUtils';

interface CustomerManagementProps {
  onConductAudit?: () => void;
}

export const CustomerManagement: React.FC<CustomerManagementProps> = ({ onConductAudit }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PARENT' | 'CHILD' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // 360 Degree Drawer / Modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeCustomerTab, setActiveCustomerTab] = useState<'profile' | 'pantry' | 'audits' | 'pantryPayments' | 'timelines' | 'wallet' | 'ledger' | 'orders'>('profile');
  const [stockSubTab, setStockSubTab] = useState<'inStock' | 'used' | 'breakdown'>('inStock');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [pantryStockLoading, setPantryStockLoading] = useState(false);
  const [customerPantryItems, setCustomerPantryItems] = useState<PantryCardItem[]>([]);
  const [customerLedger, setCustomerLedger] = useState<PantryCreditLedger[]>([]);
  const [customerWalletTxns, setCustomerWalletTxns] = useState<WalletTransaction[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerTimelines, setCustomerTimelines] = useState<CustomerProductTimeline[]>([]);
  const [customerPantryPayments, setCustomerPantryPayments] = useState<PantryPayment[]>([]);
  const [customerAudits, setCustomerAudits] = useState<AuditorCheck[]>([]);
  const [selectedAuditForBill, setSelectedAuditForBill] = useState<AuditorCheck | null>(null);
  const [selectedAdminTimeline, setSelectedAdminTimeline] = useState<CustomerProductTimeline | null>(null);
  const [metricModalTab, setMetricModalTab] = useState<LimitMetricTab | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Pantry Permission Admin OTP Security Modal State
  const [permissionModal, setPermissionModal] = useState<{
    isOpen: boolean;
    customer: Customer | null;
    action: 'ALLOW' | 'REVOKE';
    adminMobile: string;
    otp: string;
    reason: string;
    isSendingOtp: boolean;
    otpSent: boolean;
    otpHint?: string;
    isVerifying: boolean;
    error?: string;
    successMessage?: string;
  }>({
    isOpen: false,
    customer: null,
    action: 'REVOKE',
    adminMobile: '9876543210',
    otp: '',
    reason: '',
    isSendingOtp: false,
    otpSent: false,
    isVerifying: false,
  });

  // New Customer Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    address: '',
    city: 'Ranchi',
    state: 'Jharkhand',
    pinCode: '834001',
    pantryLimit: 10000,
    isPantryAllowed: true,
  });
  const [parentMobileStatus, setParentMobileStatus] = useState<{
    checking: boolean;
    available?: boolean;
    error?: string;
  }>({ checking: false });

  // New Child Modal
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [parentForChild, setParentForChild] = useState<Customer | null>(null);
  const [childFormData, setChildFormData] = useState({
    fullName: '',
    mobile: '',
    relationInfo: 'Spouse',
    pantryLimit: 2000,
  });
  const [childMobileStatus, setChildMobileStatus] = useState<{
    checking: boolean;
    available?: boolean;
    error?: string;
  }>({ checking: false });

  // Validate Parent Mobile Uniqueness in Real-Time
  useEffect(() => {
    const clean = formData.mobile.replace(/\D/g, '');
    if (clean.length === 10) {
      setParentMobileStatus({ checking: true });
      const timer = setTimeout(async () => {
        try {
          const res = await api.checkMobileAvailability(clean);
          if (res.available) {
            setParentMobileStatus({ checking: false, available: true });
          } else {
            setParentMobileStatus({ checking: false, available: false, error: res.error || 'Mobile number already registered across database' });
          }
        } catch (err: any) {
          setParentMobileStatus({ checking: false, available: false, error: err.message });
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setParentMobileStatus({ checking: false, available: undefined });
    }
  }, [formData.mobile]);

  // Validate Child Mobile Uniqueness in Real-Time
  useEffect(() => {
    const clean = childFormData.mobile.replace(/\D/g, '');
    if (parentForChild && clean === parentForChild.mobile.replace(/\D/g, '')) {
      setChildMobileStatus({
        checking: false,
        available: false,
        error: `Cannot use Parent's mobile number (${parentForChild.fullName}: ${parentForChild.mobile}). Every customer must have a unique mobile number.`,
      });
      return;
    }
    if (clean.length === 10) {
      setChildMobileStatus({ checking: true });
      const timer = setTimeout(async () => {
        try {
          const res = await api.checkMobileAvailability(clean);
          if (res.available) {
            setChildMobileStatus({ checking: false, available: true });
          } else {
            setChildMobileStatus({ checking: false, available: false, error: res.error || 'Mobile number already registered across database' });
          }
        } catch (err: any) {
          setChildMobileStatus({ checking: false, available: false, error: err.message });
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setChildMobileStatus({ checking: false, available: undefined });
    }
  }, [childFormData.mobile, parentForChild]);

  // Limit Adjustment Modal
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [newLimit, setNewLimit] = useState(0);
  const [limitReason, setLimitReason] = useState('Admin approval of limit increase');

  // Wallet Recharge Modal
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(1000);
  const [rechargeReason, setRechargeReason] = useState('Customer Advance Deposit / Prepaid Balance');
  const [recharging, setRecharging] = useState(false);

  const fetchCustomers = async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    const unsubscribe = api.subscribeRealtime(() => {
      fetchCustomers(true);
      if (selectedCustomer) {
        openCustomer360(selectedCustomer);
      }
    });
    return () => unsubscribe();
  }, [selectedCustomer?.id]);

  const openCustomer360 = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setActiveCustomerTab('profile');
    setStockSubTab('inStock');
    setStockSearchQuery('');
    setDrawerLoading(true);
    try {
      const [items, ledg, orders, wTxns, timelines, payments, audits] = await Promise.all([
        api.getPantryCard(cust.id),
        api.getPantryLedger(cust.id),
        api.getOrders({ customerId: cust.id }),
        api.getWalletTransactions(cust.id).catch(() => []),
        api.getCustomerProductTimeline(cust.id).catch(() => []),
        api.getCustomerPantryPayments(cust.id).catch(() => []),
        api.getAuditorChecks(cust.id).catch(() => []),
      ]);
      setCustomerPantryItems(items);
      setCustomerLedger(ledg);
      setCustomerOrders(orders);
      setCustomerWalletTxns(wTxns);
      setCustomerTimelines(timelines);
      setCustomerPantryPayments(payments);
      setCustomerAudits(audits);
    } catch (err) {
      console.error(err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const refreshCustomerPantryItems = async () => {
    if (!selectedCustomer) return;
    setPantryStockLoading(true);
    try {
      const items = await api.getPantryCard(selectedCustomer.id);
      setCustomerPantryItems(items);
    } catch (err) {
      console.error('Failed to reload pantry items:', err);
    } finally {
      setPantryStockLoading(false);
    }
  };

  const initiatePantryPermissionChange = (cust: Customer) => {
    const isCurrentlyAllowed = cust.isPantryAllowed !== false && cust.pantryLimit > 0;
    const action: 'ALLOW' | 'REVOKE' = isCurrentlyAllowed ? 'REVOKE' : 'ALLOW';
    setPermissionModal({
      isOpen: true,
      customer: cust,
      action,
      adminMobile: '9876543210',
      otp: '',
      reason: isCurrentlyAllowed
        ? 'Pantry Card access revoked by Admin'
        : 'Pantry Card access authorized by Admin',
      isSendingOtp: false,
      otpSent: false,
      otpHint: undefined,
      isVerifying: false,
      error: undefined,
      successMessage: undefined,
    });
  };

  const handleSendPermissionOtp = async () => {
    if (!permissionModal.customer) return;
    const cleanMobile = permissionModal.adminMobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setPermissionModal((prev) => ({
        ...prev,
        error: 'Please enter a valid 10-digit Admin Mobile Number',
      }));
      return;
    }
    setPermissionModal((prev) => ({ ...prev, isSendingOtp: true, error: undefined }));
    try {
      const res = await api.sendPantryPermissionOtp(
        permissionModal.customer.id,
        permissionModal.action,
        cleanMobile
      );
      setPermissionModal((prev) => ({
        ...prev,
        isSendingOtp: false,
        otpSent: true,
        otpHint: res.otpHint || '123456',
        error: undefined,
      }));
    } catch (err: any) {
      setPermissionModal((prev) => ({
        ...prev,
        isSendingOtp: false,
        error: err.message || 'Failed to send OTP to Admin mobile',
      }));
    }
  };

  const handleConfirmPermissionToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissionModal.customer) return;
    if (permissionModal.otp.trim().length !== 6) {
      setPermissionModal((prev) => ({
        ...prev,
        error: 'Please enter the 6-digit OTP sent to Admin mobile',
      }));
      return;
    }
    setPermissionModal((prev) => ({ ...prev, isVerifying: true, error: undefined }));
    try {
      const isAllowed = permissionModal.action === 'ALLOW';
      const res = await api.verifyPantryPermissionOtpAndToggle({
        customerId: permissionModal.customer.id,
        isPantryAllowed: isAllowed,
        adminMobile: permissionModal.adminMobile,
        otp: permissionModal.otp.trim(),
        reason: permissionModal.reason,
      });

      // Update local customers state
      await fetchCustomers();

      if (selectedCustomer?.id === permissionModal.customer.id) {
        setSelectedCustomer(res.customer);
      }

      setPermissionModal((prev) => ({
        ...prev,
        isVerifying: false,
        successMessage: res.message,
      }));

      // Close modal after brief feedback
      setTimeout(() => {
        setPermissionModal({
          isOpen: false,
          customer: null,
          action: 'REVOKE',
          adminMobile: '9876543210',
          otp: '',
          reason: '',
          isSendingOtp: false,
          otpSent: false,
          isVerifying: false,
        });
      }, 1500);
    } catch (err: any) {
      setPermissionModal((prev) => ({
        ...prev,
        isVerifying: false,
        error: err.message || 'Failed to verify OTP or update permission',
      }));
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCustomer(formData);
      alert('Parent Customer registered successfully with Pantry Limit!');
      setIsCreateModalOpen(false);
      setFormData({
        fullName: '',
        mobile: '',
        email: '',
        address: '',
        city: 'Ranchi',
        state: 'Jharkhand',
        pinCode: '834001',
        pantryLimit: 10000,
        isPantryAllowed: true,
      });
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentForChild) return;
    try {
      await api.createChildCustomer(parentForChild.id, childFormData);
      alert(`Child Pantry Card added successfully for ${parentForChild.fullName}!`);
      setIsChildModalOpen(false);
      setChildFormData({
        fullName: '',
        mobile: '',
        relationInfo: 'Spouse',
        pantryLimit: 2000,
      });
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      await api.updatePantryLimit(selectedCustomer.id, Number(newLimit), limitReason);
      alert(`Pantry Credit Limit updated to ₹${newLimit}!`);
      setIsLimitModalOpen(false);
      fetchCustomers();
      // reload customer in drawer
      const updated = (await api.getCustomers()).find((c) => c.id === selectedCustomer.id);
      if (updated) setSelectedCustomer(updated);
      const ledg = await api.getPantryLedger(selectedCustomer.id);
      setCustomerLedger(ledg);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRechargeCustomerWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setRecharging(true);
    try {
      const res = await api.rechargeWallet(selectedCustomer.id, Number(rechargeAmount), rechargeReason);
      alert(`Wallet successfully recharged! New Balance: ₹${res.newBalance}`);
      setIsRechargeModalOpen(false);
      fetchCustomers();
      const updated = (await api.getCustomers()).find((c) => c.id === selectedCustomer.id);
      if (updated) setSelectedCustomer(updated);
      const wTxns = await api.getWalletTransactions(selectedCustomer.id);
      setCustomerWalletTxns(wTxns);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRecharging(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (statusFilter === 'PARENT') return !c.isChild;
    if (statusFilter === 'CHILD') return c.isChild;
    if (statusFilter === 'ACTIVE') return c.status === 'ACTIVE';
    if (statusFilter === 'INACTIVE') return c.status === 'INACTIVE';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span>Customer 360° Management &amp; Household Accounts</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage parent households, linked family cards, credit limits, prepaid wallets, and field verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onConductAudit && (
            <button
              onClick={onConductAudit}
              className="px-3 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              Auditor Portal
            </button>
          )}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            + Register Parent Customer
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, mobile, ID, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto text-xs font-medium">
          {(['ALL', 'PARENT', 'CHILD', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                statusFilter === filter
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter === 'ALL'
                ? `All (${customers.length})`
                : filter === 'PARENT'
                ? `Parents (${customers.filter((c) => !c.isChild).length})`
                : filter === 'CHILD'
                ? `Family Cards (${customers.filter((c) => c.isChild).length})`
                : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading customers...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-700">No customers found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search or register a new customer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-purple-400 transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Top Badge & ID */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                      {cust.id}
                    </span>
                    {cust.isChild ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                        {cust.relationInfo || 'Family Member'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Parent Card
                      </span>
                    )}
                  </div>
                  <StatusBadge status={cust.status} />
                </div>

                {/* Name & Contact */}
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{cust.fullName}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>+91 {cust.mobile}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {cust.address}, {cust.city}
                    </span>
                  </div>
                </div>

                {/* Dual Meter: Pantry Limit + Wallet Balance */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-100">
                    <div className="text-[10px] text-purple-700 font-bold uppercase">Pantry Limit</div>
                    <div className="text-sm font-black text-purple-900 mt-0.5">
                      ₹{cust.availablePantryLimit}
                    </div>
                    <div className="text-[10px] text-purple-600/80">Approved: ₹{cust.pantryLimit}</div>
                  </div>

                  <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                    <div className="text-[10px] text-emerald-700 font-bold uppercase flex items-center gap-1">
                      <Wallet className="w-3 h-3" /> Wallet
                    </div>
                    <div className="text-sm font-black text-emerald-900 mt-0.5">
                      ₹{cust.walletBalance ?? 1000}
                    </div>
                    <div className="text-[10px] text-emerald-600/80">Audit Deposit</div>
                  </div>
                </div>

                {/* Pantry Permission Toggle Bar */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <CreditCard
                      className={`w-4 h-4 shrink-0 ${
                        cust.isPantryAllowed !== false && cust.pantryLimit > 0
                          ? 'text-purple-600'
                          : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <div className="font-bold text-[11px] text-slate-800 leading-tight">
                        {cust.isPantryAllowed !== false && cust.pantryLimit > 0
                          ? 'Pantry Card: ALLOWED'
                          : 'Pantry Card: REVOKED / DISABLED'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {cust.isPantryAllowed !== false && cust.pantryLimit > 0
                          ? 'Pantry credit & 0 COD enabled'
                          : 'Normal Quick COD orders only'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => initiatePantryPermissionChange(cust)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                      cust.isPantryAllowed !== false && cust.pantryLimit > 0
                        ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200'
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                    }`}
                  >
                    {cust.isPantryAllowed !== false && cust.pantryLimit > 0 ? (
                      <>
                        <ShieldAlert className="w-3 h-3" />
                        <span>Revoke</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3 h-3" />
                        <span>Allow Access</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {!cust.isChild && (
                  cust.isPantryAllowed !== false && cust.pantryLimit > 0 ? (
                    <button
                      onClick={() => {
                        setParentForChild(cust);
                        setIsChildModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Add Linked Child / Family Card"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      + Child
                    </button>
                  ) : (
                    <button
                      onClick={() => initiatePantryPermissionChange(cust)}
                      className="px-2.5 py-1.5 rounded-lg border border-dashed border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                      title="Pantry Card Revoked: Click to Grant Permission and unlock child accounts"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-[10px]">Enable +Child</span>
                    </button>
                  )
                )}

                <button
                  onClick={() => openCustomer360(cust)}
                  className="flex-1 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>360° Profile</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 360 Degree Customer Drawer / Detailed View Modal */}
      {selectedCustomer && (
        <AppWindowModal
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={selectedCustomer.fullName}
          subtitle={`+91 ${selectedCustomer.mobile} • ${selectedCustomer.city}, ${selectedCustomer.state}`}
          icon={<CreditCard className="w-5 h-5 text-purple-600" />}
          size="2xl"
          badge={
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-100 text-purple-800 font-bold border border-purple-200">
              {selectedCustomer.id}
            </span>
          }
          headerActions={
            <div className="flex items-center gap-1.5 mr-2">
              <button
                onClick={() => {
                  setRechargeAmount(1000);
                  setIsRechargeModalOpen(true);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Top-up Wallet</span>
              </button>

              <button
                onClick={() => {
                  setNewLimit(selectedCustomer.pantryLimit);
                  setIsLimitModalOpen(true);
                }}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Update Limit</span>
              </button>
            </div>
          }
        >
          <div className="flex flex-col h-full">

            {/* Navigation Tabs */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 flex gap-2 text-xs font-semibold overflow-x-auto">
              {(
                [
                  { id: 'profile', label: 'Overview & Cards' },
                  {
                    id: 'pantry',
                    label: `In Pantry & Consumed Stock (${customerPantryItems.filter((i) => i.quantity > 0).length} In Pantry • ${customerPantryItems.filter((i) => i.quantity === 0).length} Used)`,
                  },
                  { id: 'audits', label: `Field Audits & Bills (${customerAudits.length})` },
                  { id: 'pantryPayments', label: `Pantry Payments (${customerPantryPayments.length})` },
                  { id: 'timelines', label: `Product History Timelines (${customerTimelines.length})` },
                  { id: 'wallet', label: `Wallet Ledger (${customerWalletTxns.length})` },
                  { id: 'ledger', label: `Credit Ledger (${customerLedger.length})` },
                  { id: 'orders', label: `Orders (${customerOrders.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCustomerTab(tab.id)}
                  className={`py-3 px-3 border-b-2 font-bold transition cursor-pointer whitespace-nowrap ${
                    activeCustomerTab === tab.id
                      ? 'border-purple-600 text-purple-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {drawerLoading ? (
                <div className="py-12 text-center text-slate-400">Loading customer profile...</div>
              ) : activeCustomerTab === 'profile' ? (
                <div className="space-y-4">
                  {/* Digital Dual Cards Preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Pantry Limit Card */}
                    <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden border border-purple-500/20 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                            Pantry Credit Card
                          </div>
                          <div className="font-mono text-sm font-bold tracking-widest mt-1">
                            {selectedCustomer.id}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          {selectedCustomer.status}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="text-[10px] text-purple-300 uppercase">Available Credit</div>
                        <div className="text-xl font-black text-emerald-300">
                          ₹{selectedCustomer.availablePantryLimit.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-300 mt-0.5">
                          Limit: ₹{selectedCustomer.pantryLimit.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Wallet Card */}
                    <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden border border-emerald-500/20 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Wallet className="w-3 h-3" /> Pre-paid Deposit Wallet
                          </div>
                          <div className="font-mono text-sm font-bold tracking-widest mt-1">
                            {selectedCustomer.id}
                          </div>
                        </div>
                        <button
                          onClick={() => setIsRechargeModalOpen(true)}
                          className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          + Top-up
                        </button>
                      </div>

                      <div className="mt-4">
                        <div className="text-[10px] text-emerald-300 uppercase">Current Wallet Balance</div>
                        <div className="text-xl font-black text-white">
                          ₹{(selectedCustomer.walletBalance ?? 1000).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-emerald-300/80 mt-0.5">
                          Audit Deductions Settlement
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5-BOX INTERACTIVE PANTRY CREDIT & STOCK VALUE BREAKDOWN (Click to Inspect Items) */}
                  {(() => {
                    const approvedLimit = selectedCustomer.pantryLimit || 0;
                    const activeStockItems = customerPantryItems.filter((i) => (i.quantity || 0) > 0 && i.status !== 'RETURNED');
                    const stockValuation = activeStockItems.reduce((acc, item) => acc + (item.quantity || 0) * (item.unitPrice || 0), 0);
                    const inTransitPantryOrders = customerOrders.filter(
                      (o) =>
                        (o.orderType === 'PANTRY' || (o as any).type === 'PANTRY') &&
                        ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(
                          (((o.orderStatus || (o as any).status) || '').toUpperCase())
                        )
                    );
                    const inTransitOrdersValue = inTransitPantryOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
                    const effectiveUsedLimit = stockValuation + inTransitOrdersValue;
                    const closingAvailableLimit = Math.max(0, approvedLimit - effectiveUsedLimit);

                    return (
                      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-700 shadow-md space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            <span className="text-xs font-black text-slate-200">
                              Revolving Credit Line &amp; Stock Value Live Breakdown
                            </span>
                            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full font-semibold">
                              Click any box for item-wise list
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Formula: Approved - (Home Stock + In Transit) = Available
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-left">
                          {/* 1. Approved Limit */}
                          <button
                            type="button"
                            onClick={() => setMetricModalTab('APPROVED')}
                            className="bg-slate-800/80 hover:bg-slate-800 p-2.5 rounded-xl border border-slate-700 hover:border-purple-400 transition text-left cursor-pointer group"
                          >
                            <div className="text-[10px] text-purple-300 font-bold uppercase truncate flex items-center justify-between">
                              <span>1. Approved Limit</span>
                              <span className="text-[9px] opacity-0 group-hover:opacity-100 text-purple-300 font-normal">View ↗</span>
                            </div>
                            <div className="text-base font-black text-white mt-1">
                              ₹{approvedLimit.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[9px] text-slate-400 mt-0.5">Sanctioned credit line</div>
                          </button>

                          {/* 2. Home Stock Value */}
                          <button
                            type="button"
                            onClick={() => setMetricModalTab('HOME_STOCK')}
                            className="bg-amber-950/40 hover:bg-amber-950/60 p-2.5 rounded-xl border border-amber-600/40 hover:border-amber-400 transition text-left cursor-pointer group"
                          >
                            <div className="text-[10px] text-amber-300 font-bold uppercase truncate flex items-center justify-between">
                              <span>2. Home Stock Value</span>
                              <span className="text-[9px] opacity-0 group-hover:opacity-100 text-amber-300 font-normal">View ↗</span>
                            </div>
                            <div className="text-base font-black text-amber-300 mt-1">
                              ₹{stockValuation.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[9px] text-amber-200/70 mt-0.5">
                              {activeStockItems.length} active products
                            </div>
                          </button>

                          {/* 3. In-Transit Orders */}
                          <button
                            type="button"
                            onClick={() => setMetricModalTab('IN_TRANSIT')}
                            className="bg-blue-950/40 hover:bg-blue-950/60 p-2.5 rounded-xl border border-blue-600/40 hover:border-blue-400 transition text-left cursor-pointer group"
                          >
                            <div className="text-[10px] text-blue-300 font-bold uppercase truncate flex items-center justify-between">
                              <span>3. In-Transit Orders</span>
                              <span className="text-[9px] opacity-0 group-hover:opacity-100 text-blue-300 font-normal">View ↗</span>
                            </div>
                            <div className="text-base font-black text-blue-300 mt-1">
                              ₹{inTransitOrdersValue.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[9px] text-blue-200/70 mt-0.5">
                              {inTransitPantryOrders.length} orders dispatched
                            </div>
                          </button>

                          {/* 4. Total Used */}
                          <button
                            type="button"
                            onClick={() => setMetricModalTab('TOTAL_USED')}
                            className="bg-rose-950/40 hover:bg-rose-950/60 p-2.5 rounded-xl border border-rose-600/40 hover:border-rose-400 transition text-left cursor-pointer group"
                          >
                            <div className="text-[10px] text-rose-300 font-bold uppercase truncate flex items-center justify-between">
                              <span>4. Total Used (2+3)</span>
                              <span className="text-[9px] opacity-0 group-hover:opacity-100 text-rose-300 font-normal">View ↗</span>
                            </div>
                            <div className="text-base font-black text-rose-300 mt-1">
                              ₹{effectiveUsedLimit.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[9px] text-rose-200/70 mt-0.5">Stock + In-Transit</div>
                          </button>

                          {/* 5. Closing Available */}
                          <button
                            type="button"
                            onClick={() => setMetricModalTab('AVAILABLE')}
                            className="col-span-2 sm:col-span-1 bg-emerald-950/50 hover:bg-emerald-950/70 p-2.5 rounded-xl border border-emerald-500/50 hover:border-emerald-400 transition text-left cursor-pointer group"
                          >
                            <div className="text-[10px] text-emerald-300 font-bold uppercase truncate flex items-center justify-between">
                              <span>5. Closing Available</span>
                              <span className="text-[9px] opacity-0 group-hover:opacity-100 text-emerald-300 font-normal">View ↗</span>
                            </div>
                            <div className="text-base font-black text-emerald-400 mt-1">
                              ₹{closingAvailableLimit.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[9px] text-emerald-200/70 mt-0.5">Active order limit</div>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pantry Card & Pantry Pay Permissions */}
                  <div className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                    selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0
                      ? 'bg-purple-50/50 border-purple-200'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <CreditCard className={`w-4 h-4 ${
                          selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0 ? 'text-purple-600' : 'text-slate-400'
                        }`} />
                        <span>Pantry Card &amp; Pantry Pay Access</span>
                      </h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : 'bg-rose-100 text-rose-800 border-rose-200'
                      }`}>
                        {selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0 ? 'PERMISSION ACTIVE' : 'ACCESS RESTRICTED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600">
                      <div>
                        <span className="font-semibold text-slate-500 block">Pantry Pay Eligible:</span>
                        <strong className={selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0 ? 'text-purple-700' : 'text-rose-700'}>
                          {selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0 
                            ? 'Yes, Authorized' 
                            : 'No, Restricted (Needs Active Pantry Card Permission)'}
                        </strong>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500 block">Payment Method Limits:</span>
                        <strong>
                          {selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0 
                            ? `Pantry Credit & Direct UPI / Bank Pantry Pay enabled` 
                            : 'Normal COD Quick Delivery Orders Only'}
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        {selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0
                          ? 'Pantry Card is active. Family child accounts have full pantry credit access.'
                          : 'Pantry Card is restricted. Revoking parent automatically disables all child cards.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => initiatePantryPermissionChange(selectedCustomer)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs ${
                          selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        {selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0 ? (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Revoke Pantry Access (OTP Required)</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Grant Permission (OTP Required)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Household & Family Child Accounts Management */}
                  {!selectedCustomer.isChild ? (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-purple-600" />
                            <span>Household &amp; Family Child Accounts</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Family cards linked to this household pool. Status cascades automatically with parent pantry card.
                          </p>
                        </div>
                        {selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setParentForChild(selectedCustomer);
                              setIsChildModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>+ Add Family Child Card</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => initiatePantryPermissionChange(selectedCustomer)}
                            className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Click to Grant Pantry Card permission first"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            <span>Enable Pantry To Add Child</span>
                          </button>
                        )}
                      </div>

                      {/* Linked Children List */}
                      {customers.filter((c) => c.parentCustomerId === selectedCustomer.id).length === 0 ? (
                        <div className="p-4 bg-white rounded-lg border border-dashed border-slate-300 text-center text-slate-500">
                          {selectedCustomer.isPantryAllowed !== false && selectedCustomer.pantryLimit > 0
                            ? 'No family child cards registered under this parent yet. Click "+ Add Family Child Card" to add family members.'
                            : 'No family child cards registered. Grant Pantry Card permission above to enable family card registration.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {customers
                            .filter((c) => c.parentCustomerId === selectedCustomer.id)
                            .map((child) => (
                              <div
                                key={child.id}
                                className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-3xs"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900">{child.fullName}</span>
                                    <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                                      {child.relationInfo || 'Family'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    +91 {child.mobile} • Limit: ₹{child.pantryLimit}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                      child.isPantryAllowed !== false && child.pantryLimit > 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {child.isPantryAllowed !== false && child.pantryLimit > 0
                                      ? 'Active'
                                      : 'Revoked (Inherited)'}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-purple-50/60 rounded-xl p-4 border border-purple-200 text-xs space-y-2">
                      <h4 className="font-bold text-purple-900 text-sm flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-purple-700" />
                        <span>Parent Household Info</span>
                      </h4>
                      <div className="text-slate-600">
                        This is a linked Family Card ({selectedCustomer.relationInfo || 'Member'}).
                        {selectedCustomer.parentCustomerId && (
                          <span className="ml-1 font-mono font-bold text-purple-900">
                            Parent ID: {selectedCustomer.parentCustomerId}
                          </span>
                        )}
                        <p className="mt-1 text-[11px] text-slate-500">
                          Pantry Card access and credit limits are tied directly to the Parent Household account.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Customer Information Grid */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm mb-2">Address &amp; Contact Details</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400">Mobile:</span>{' '}
                        <strong className="text-slate-800">+91 {selectedCustomer.mobile}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Account Status:</span>{' '}
                        <strong className="text-emerald-700">{selectedCustomer.status}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">Address:</span>{' '}
                        <strong className="text-slate-800">
                          {selectedCustomer.address}, {selectedCustomer.city}, {selectedCustomer.state} -{' '}
                          {selectedCustomer.pinCode}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeCustomerTab === 'audits' ? (
                <div className="space-y-4">
                  {/* Field Audit Summary Card */}
                  <div className="p-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl shadow-md border border-purple-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                        <span>Doorstep Physical Pantry Audits</span>
                      </div>
                      <h3 className="text-lg font-black text-white mt-1">
                        {customerAudits.length} Audit{customerAudits.length === 1 ? '' : 's'} Conducted
                      </h3>
                      <p className="text-xs text-purple-200/80 mt-0.5">
                        Complete history of physical pantry inspections, verified bills, wallet deductions & credit restorations.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (selectedCustomer) {
                          const audits = await api.getAuditorChecks(selectedCustomer.id).catch(() => []);
                          setCustomerAudits(audits);
                        }
                      }}
                      className="px-3 py-1.5 bg-purple-700/60 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-purple-500/30 shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync Audits</span>
                    </button>
                  </div>

                  {customerAudits.length === 0 ? (
                    <div className="p-10 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400 space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700 text-xs">No Physical Pantry Audits Found</p>
                      <p className="text-[11px] text-slate-400">
                        When an auditor schedules and conducts a physical doorstep verification for this customer, the generated audit bills and full details will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customerAudits.map((audit) => {
                        const isLocked = audit.isBillLocked || audit.billStatus === 'LOCKED' || audit.status === 'LOCKED';
                        const isRejected = audit.status === 'CUSTOMER_REJECTED' || audit.billStatus === 'CUSTOMER_REJECTED';
                        const isPending = audit.billStatus === 'CUSTOMER_PENDING_CONFIRMATION' || audit.status === 'CUSTOMER_PENDING_CONFIRMATION';

                        return (
                          <div
                            key={audit.id}
                            className={`p-4 bg-white rounded-2xl border transition shadow-xs space-y-3 ${
                              isLocked
                                ? 'border-emerald-300 bg-emerald-50/20'
                                : isRejected
                                ? 'border-rose-300 bg-rose-50/20'
                                : 'border-amber-300 bg-amber-50/20'
                            }`}
                          >
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-black text-slate-900 text-sm">
                                    Bill #{audit.billId || audit.id}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                                      isLocked
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : isRejected
                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                                    }`}
                                  >
                                    {isLocked ? (
                                      <>
                                        <Lock className="w-3 h-3 text-emerald-600" />
                                        <span>LOCKED &amp; CONFIRMED BY HOUSEHOLD</span>
                                      </>
                                    ) : isRejected ? (
                                      <>
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        <span>DISPUTED / REJECTED BY CUSTOMER</span>
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        <span>PENDING HOUSEHOLD CONFIRMATION</span>
                                      </>
                                    )}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                                    v{audit.billVersion || 1}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                  <span>Auditor: <strong className="text-slate-800">{audit.auditorName || audit.auditorId}</strong></span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {audit.billGeneratedDate || audit.requestedDate || 'N/A'} {audit.billGeneratedTime || ''}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAuditForBill(audit)}
                                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Bill Detail</span>
                                </button>
                              </div>
                            </div>

                            {/* Breakdown Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="text-[10px] text-slate-500 font-medium">Checked Items</div>
                                <div className="font-bold text-slate-900 mt-0.5">{audit.totalItemsCount || audit.itemsChecked?.length || 0}</div>
                              </div>
                              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                                <div className="text-[10px] text-emerald-700 font-medium">Available</div>
                                <div className="font-bold text-emerald-800 mt-0.5">{audit.availableCount || 0}</div>
                              </div>
                              <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                                <div className="text-[10px] text-rose-700 font-medium">Missing (Wallet)</div>
                                <div className="font-bold text-rose-800 mt-0.5">{audit.notAvailableCount || 0}</div>
                              </div>
                              <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                                <div className="text-[10px] text-amber-700 font-medium">Damaged/Exp</div>
                                <div className="font-bold text-amber-800 mt-0.5">{(audit.damagedCount || 0) + (audit.expiredCount || 0)}</div>
                              </div>
                              <div className="p-2 bg-purple-50 rounded-xl border border-purple-100 col-span-2 sm:col-span-1">
                                <div className="text-[10px] text-purple-700 font-medium">Wallet Deduction</div>
                                <div className="font-bold text-purple-900 mt-0.5">₹{(audit.totalWalletDeduction || 0).toLocaleString('en-IN')}</div>
                              </div>
                            </div>

                            {/* Rejection / Dispute Notice */}
                            {isRejected && audit.customerRejectionReason && (
                              <div className="p-2.5 bg-rose-100/70 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-0.5">
                                <span className="font-bold text-[11px] block text-rose-950 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                                  Customer Rejection Reason:
                                </span>
                                <p className="text-[11px]">{audit.customerRejectionReason}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : activeCustomerTab === 'pantry' ? (
                <div className="space-y-4">
                  {/* Header Summary Banner */}
                  <div className="p-4 bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-md border border-purple-700/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase text-purple-300 tracking-wider flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-purple-400" />
                        <span>Customer Household Physical Inventory Audit</span>
                      </div>
                      <h3 className="text-lg font-black text-white mt-1">
                        In Pantry &amp; Used Stock Details
                      </h3>
                      <p className="text-xs text-purple-200/80 mt-0.5">
                        Live inventory tracking with delivery date, MFG/EXP dates, batches, valuation, and live day count (Day 1 to 15 max return window).
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pantryStockLoading}
                      onClick={refreshCustomerPantryItems}
                      className="px-3 py-1.5 bg-purple-700/70 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-purple-500/30 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${pantryStockLoading ? 'animate-spin' : ''}`} />
                      <span>{pantryStockLoading ? 'Syncing...' : 'Sync Stock'}</span>
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  {(() => {
                    const inStockItems = customerPantryItems.filter((i) => i.quantity > 0);
                    const usedItems = customerPantryItems.filter((i) => i.quantity === 0);
                    const totalActiveUnits = inStockItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
                    const totalValuation = inStockItems.reduce(
                      (sum, i) => sum + (i.totalValue || (i.quantity * (i.unitPrice || 0))),
                      0
                    );
                    const deliveredOrders = customerOrders.filter((o) => o.orderStatus === 'DELIVERED');

                    return (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl">
                            <div className="text-[10px] font-black uppercase text-purple-800 tracking-wider flex items-center justify-between">
                              <span>In Pantry Stock</span>
                              <Package className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="text-2xl font-black text-purple-950 mt-1">
                              {inStockItems.length} <span className="text-xs font-normal text-purple-700">items ({totalActiveUnits} units)</span>
                            </div>
                            <div className="text-[10px] text-purple-600 mt-0.5">Available on customer shelf</div>
                          </div>

                          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl">
                            <div className="text-[10px] font-black uppercase text-rose-800 tracking-wider flex items-center justify-between">
                              <span>Used / Consumed</span>
                              <RotateCcw className="w-4 h-4 text-rose-600" />
                            </div>
                            <div className="text-2xl font-black text-rose-950 mt-1">
                              {usedItems.length} <span className="text-xs font-normal text-rose-700">products (0 Qty)</span>
                            </div>
                            <div className="text-[10px] text-rose-600 mt-0.5">Fully consumed / settled</div>
                          </div>

                          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                            <div className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center justify-between">
                              <span>Stock Valuation</span>
                              <DollarSign className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="text-2xl font-black text-emerald-950 mt-1">
                              ₹{totalValuation.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-emerald-600 mt-0.5">In-pantry active stock value</div>
                          </div>

                          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl">
                            <div className="text-[10px] font-black uppercase text-indigo-800 tracking-wider flex items-center justify-between">
                              <span>Delivered Inward</span>
                              <Truck className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="text-2xl font-black text-indigo-950 mt-1">
                              {deliveredOrders.length} <span className="text-xs font-normal text-indigo-700">Orders</span>
                            </div>
                            <div className="text-[10px] text-indigo-600 mt-0.5">COD &amp; Pantry Inward orders</div>
                          </div>
                        </div>

                        {/* Sub Tabs & Search */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-b border-slate-200 pb-3">
                          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto">
                            <button
                              type="button"
                              onClick={() => setStockSubTab('inStock')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                stockSubTab === 'inStock'
                                  ? 'bg-purple-700 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                              }`}
                            >
                              <div className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span>🟢 In Pantry Stock</span>
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                stockSubTab === 'inStock' ? 'bg-purple-900 text-white' : 'bg-slate-200 text-slate-800'
                              }`}>
                                {inStockItems.length}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setStockSubTab('used')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                stockSubTab === 'used'
                                  ? 'bg-purple-700 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                              }`}
                            >
                              <div className="w-2 h-2 rounded-full bg-rose-400" />
                              <span>🔴 Used / Consumed (0 Qty)</span>
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                stockSubTab === 'used' ? 'bg-purple-900 text-white' : 'bg-slate-200 text-slate-800'
                              }`}>
                                {usedItems.length}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setStockSubTab('breakdown')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                stockSubTab === 'breakdown'
                                  ? 'bg-purple-700 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                              }`}
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>📦 Inward Delivered Orders</span>
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                stockSubTab === 'breakdown' ? 'bg-purple-900 text-white' : 'bg-slate-200 text-slate-800'
                              }`}>
                                {deliveredOrders.length}
                              </span>
                            </button>
                          </div>

                          <div className="relative flex-1 sm:max-w-xs">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="Search item, brand, batch, barcode..."
                              value={stockSearchQuery}
                              onChange={(e) => setStockSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            {stockSearchQuery && (
                              <button
                                onClick={() => setStockSearchQuery('')}
                                className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Sub Tab Content */}
                        {stockSubTab === 'inStock' || stockSubTab === 'used' ? (
                          (() => {
                            const rawList = stockSubTab === 'inStock' ? inStockItems : usedItems;
                            const filteredList = rawList.filter((it) => {
                              if (!stockSearchQuery.trim()) return true;
                              const q = stockSearchQuery.toLowerCase();
                              return (
                                it.productName.toLowerCase().includes(q) ||
                                (it.brand && it.brand.toLowerCase().includes(q)) ||
                                (it.batchNumber && it.batchNumber.toLowerCase().includes(q)) ||
                                (it.barcode && it.barcode.toLowerCase().includes(q)) ||
                                (it.productId && it.productId.toLowerCase().includes(q))
                              );
                            });

                            if (filteredList.length === 0) {
                              return (
                                <div className="py-12 bg-white rounded-2xl border border-dashed border-slate-300 text-center text-slate-400 space-y-2">
                                  <Package className="w-8 h-8 text-slate-300 mx-auto" />
                                  <p className="text-xs font-bold text-slate-700">
                                    {stockSearchQuery
                                      ? `No items match "${stockSearchQuery}"`
                                      : stockSubTab === 'inStock'
                                      ? 'No active in-pantry stock items for this customer.'
                                      : 'No used (0-qty) items found.'}
                                  </p>
                                  <p className="text-[11px] text-slate-400">
                                    {stockSubTab === 'inStock'
                                      ? 'Items delivered via Pantry or COD orders will automatically show here.'
                                      : 'When items are marked consumed during physical audits, they move to this tab.'}
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {filteredList.map((item) => {
                                  const dayInfo = getDeliveryDayCount(item.deliveryDate);
                                  const itemValuation = (item.quantity || 0) * (item.unitPrice || 0);

                                  return (
                                    <div
                                      key={item.id}
                                      className={`p-4 rounded-2xl border transition shadow-xs flex flex-col justify-between ${
                                        item.quantity === 0
                                          ? 'bg-rose-50/30 border-rose-200'
                                          : 'bg-white border-slate-200 hover:border-purple-300'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-start gap-3">
                                            <div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                                              <ImageWithFallback src={item.image} alt={item.productName} />
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">
                                                  {item.brand || 'Pantry Item'}
                                                </span>
                                                {item.weightSize && (
                                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                                    {item.weightSize}
                                                  </span>
                                                )}
                                              </div>
                                              <h5 className="font-bold text-slate-900 text-sm leading-tight mt-0.5">
                                                {item.productName}
                                              </h5>
                                              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-500 flex-wrap">
                                                <span className="bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded font-bold">
                                                  Batch #{item.batchNumber}
                                                </span>
                                                {item.barcode && (
                                                  <span className="text-slate-400">Barcode: #{item.barcode}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="text-right shrink-0">
                                            {item.quantity === 0 ? (
                                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                                USED / 0 QTY
                                              </span>
                                            ) : (
                                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                IN PANTRY STOCK ({item.quantity} {item.quantity === 1 ? 'Unit' : 'Units'})
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Financial & Valuation Bar */}
                                        <div className="mt-3 p-2 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                                          <div>
                                            <span className="text-slate-400 text-[10px] block">Unit Price</span>
                                            <strong className="text-slate-900 font-bold">₹{item.unitPrice || 0}</strong>
                                          </div>
                                          <div className="text-right">
                                            <span className="text-slate-400 text-[10px] block">Total Stock Value</span>
                                            <strong className="text-purple-900 font-black">₹{itemValuation.toLocaleString('en-IN')}</strong>
                                          </div>
                                        </div>

                                        {/* Date Details & Live Day Count */}
                                        <div className="mt-3 space-y-1.5 text-xs">
                                          <div className="flex justify-between items-center text-[11px] text-slate-500">
                                            <span>MFG Date:</span>
                                            <span className="font-medium text-slate-700">
                                              {item.manufacturingDate || 'Available in Batch'}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-center text-[11px] text-slate-500">
                                            <span>Expiry Date:</span>
                                            <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                              {item.expiryDate}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-center border-t border-slate-100 pt-1.5">
                                            <span className="text-slate-500 text-[11px]">Delivered On:</span>
                                            <div className="flex flex-col items-end">
                                              <span className="text-slate-800 text-[11px] font-semibold flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                {item.deliveryDate}
                                              </span>
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
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Footer Actions */}
                                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[10px] font-mono text-slate-400">{item.id}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const t = customerTimelines.find((x) => x.productId === item.productId);
                                            if (t) setSelectedAdminTimeline(t);
                                          }}
                                          className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                                        >
                                          <Clock className="w-3 h-3" />
                                          <span>Product Timeline</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()
                        ) : (
                          /* Breakdown: Delivered Orders Inward sub-tab */
                          <div className="space-y-3">
                            {deliveredOrders.length === 0 ? (
                              <div className="py-12 bg-white rounded-2xl border border-dashed border-slate-300 text-center text-slate-400 space-y-2">
                                <Truck className="w-8 h-8 text-slate-300 mx-auto" />
                                <p className="text-xs font-bold text-slate-700">No Delivered Inward Orders</p>
                                <p className="text-[11px] text-slate-400">
                                  When pantry orders are delivered to this household, the full order and product details will be listed here.
                                </p>
                              </div>
                            ) : (
                              deliveredOrders.map((ord) => {
                                const isPantry = ord.paymentMethod === 'PANTRY_CARD';
                                const dt = formatOrderDateTime(ord.deliveredAt || ord.createdAt);
                                const dayInfo = getDeliveryDayCount(dt.date);

                                return (
                                  <div
                                    key={ord.id}
                                    className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-slate-900 text-sm">
                                          {ord.id}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                            isPantry ? 'bg-purple-100 text-purple-900 border border-purple-200' : 'bg-amber-100 text-amber-900 border border-amber-200'
                                          }`}
                                        >
                                          {isPantry ? 'Pantry Inward' : 'COD Quick'}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
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

                                      <div className="text-right">
                                        <div className="font-black text-slate-900 text-sm">
                                          ₹{ord.totalAmount?.toLocaleString('en-IN')}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          Delivered on: {dt.date}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Products list inside order */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {ord.items?.map((item, idx) => (
                                        <div
                                          key={`${ord.id}-${item.productId}-${idx}`}
                                          className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-2.5 text-xs"
                                        >
                                          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                                            <ImageWithFallback src={item.image} alt={item.productName} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 truncate">
                                              {item.productName}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono">
                                              Qty: <strong className="text-purple-700">{item.quantity}</strong> • ₹{item.price || 0}/unit
                                            </div>
                                            {isPantry && item.batchNumber && (
                                              <div className="text-[9px] text-slate-400 font-mono">
                                                Batch: #{item.batchNumber}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : activeCustomerTab === 'timelines' ? (
                <div className="space-y-3">
                  {customerTimelines.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">
                      No order or product history found for this customer.
                    </div>
                  ) : (
                    customerTimelines.map((timeline) => (
                      <div
                        key={timeline.productId}
                        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                          timeline.isUsedUp
                            ? 'bg-rose-50/50 border-rose-200'
                            : 'bg-white border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-slate-50">
                            <ImageWithFallback src={timeline.image} alt={timeline.productName} />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{timeline.productName}</span>
                              {timeline.isUsedUp ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                  0 Qty • Used Up
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  In Pantry ({timeline.currentStock} left)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Brand: {timeline.brand} {timeline.barcode ? `• Barcode: #${timeline.barcode}` : ''}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Total Ordered: <strong>{timeline.totalQuantityOrdered}</strong> • Consumed/Returned: <strong>{timeline.totalQuantityConsumed}</strong>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedAdminTimeline(timeline)}
                          className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                        >
                          <Clock className="w-3.5 h-3.5 text-purple-200" />
                          <span>View Full Work History ({timeline.events.length} logs)</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : activeCustomerTab === 'wallet' ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center font-bold">
                    <span>Wallet Transactions &amp; Audit Deductions</span>
                    <span className="text-emerald-700">
                      Balance: ₹{selectedCustomer.walletBalance ?? 1000}
                    </span>
                  </div>
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50 font-semibold text-slate-700 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Date &amp; Time</th>
                        <th className="py-2.5 px-3">Txn Type</th>
                        <th className="py-2.5 px-3">Reason / Ref</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerWalletTxns.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            No wallet transactions on record.
                          </td>
                        </tr>
                      ) : (
                        customerWalletTxns.map((w) => (
                          <tr key={w.id}>
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {w.date} {w.time}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  w.transactionType === 'ADMIN_RECHARGE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {w.transactionType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">
                              <div>{w.reason}</div>
                              {w.auditId && <div className="text-[10px] font-mono text-slate-400">{w.auditId}</div>}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold">
                              {w.amount > 0 ? (
                                <span className="text-emerald-600">+₹{w.amount}</span>
                              ) : (
                                <span className="text-rose-600">-₹{Math.abs(w.amount)}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              ₹{w.newBalance}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : activeCustomerTab === 'ledger' ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50 font-semibold text-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Debit / Credit</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerLedger.map((l) => (
                        <tr key={l.id}>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{l.createdAt}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{l.description}</td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              l.transactionType === 'PANTRY_ORDER_DEBIT'
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {l.transactionType === 'PANTRY_ORDER_DEBIT' ? `-₹${l.amount}` : `+₹${l.amount}`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ₹{l.closingLimit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : activeCustomerTab === 'pantryPayments' ? (
                <div className="space-y-4">
                  {/* Summary / Filter Bar */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Direct Pantry Pay Ledger</h4>
                      <p className="text-[11px] text-slate-500">Real-time payments processed via UPI or direct bank transfer for specific pantry stock acquisitions.</p>
                    </div>
                    <div className="bg-slate-100 p-1 rounded-lg flex gap-1 text-[11px] font-bold">
                      <span className="px-2 py-1 text-slate-600 bg-white shadow-xs rounded">
                        Total Amount: ₹{customerPantryPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {customerPantryPayments.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">
                      <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold">No Pantry Pay transactions found</p>
                      <p className="text-xs text-slate-400 mt-1">This customer has not completed any direct payments yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customerPantryPayments.some(
                        (p) =>
                          (p.isWalletRecharge || p.paymentType === 'WALLET_RECHARGE' || p.productId === 'WALLET-RECHARGE-1000' || p.barcode === 'WALLET-1000' || p.productId === 'WALLET-RECHARGE-100' || p.barcode === 'WALLET-100') &&
                          p.auditorConfirmationStatus !== 'CONFIRMED'
                      ) && (
                        <div className="p-3 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                              <span className="font-bold text-emerald-950">Pending Fixed Wallet Recharge: </span>
                              <span className="text-emerald-800">
                                Customer has requested a wallet recharge via Pantry Pay. Admin can verify &amp; credit the requested amount directly.
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white uppercase tracking-wider shrink-0">
                            ACTION REQUIRED
                          </span>
                        </div>
                      )}

                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-white shadow-xs">
                        <table className="min-w-full divide-y divide-slate-200 text-left">
                          <thead className="bg-slate-50 font-bold text-slate-700 text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Date &amp; Time</th>
                              <th className="py-2.5 px-3">Product / Purpose</th>
                              <th className="py-2.5 px-3">Payment Details</th>
                              <th className="py-2.5 px-3 text-right">Amount</th>
                              <th className="py-2.5 px-3">Verification Status</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customerPantryPayments.map((p) => {
                              const isRecharge = p.isWalletRecharge === true || p.paymentType === 'WALLET_RECHARGE' || p.productId === 'WALLET-RECHARGE-1000' || p.barcode === 'WALLET-1000' || p.productId === 'WALLET-RECHARGE-100' || p.barcode === 'WALLET-100';
                              return (
                                <tr key={p.id} className={`transition-colors ${isRecharge ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50/55'}`}>
                                  <td className="py-3 px-3 font-medium text-slate-600 whitespace-nowrap">
                                    <div className="font-bold text-slate-900">
                                      {new Date(p.createdAt).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                      {new Date(p.createdAt).toLocaleTimeString('en-IN', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                      })}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-10 h-10 rounded-lg border overflow-hidden shrink-0 flex items-center justify-center ${
                                        isRecharge ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200'
                                      }`}>
                                        {isRecharge ? (
                                          <Wallet className="w-5 h-5 text-emerald-600" />
                                        ) : (
                                          <ImageWithFallback src={p.productImage} alt={p.productName} />
                                        )}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-slate-900 line-clamp-1">{p.productName}</span>
                                          {isRecharge && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                                              WALLET TOP-UP
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                          {isRecharge ? `Fixed ₹${p.amount.toLocaleString('en-IN')} Recharge` : `Barcode: ${p.barcode}`}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 font-medium text-slate-700">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                        p.paymentMethod === 'UPI' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {p.paymentMethod}
                                      </span>
                                      <span className="font-mono text-[11px] text-slate-800">{p.transactionRef || 'N/A'}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">Status: <span className="text-emerald-600 font-bold">SUCCESS</span></div>
                                  </td>
                                  <td className="py-3 px-3 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                                    ₹{p.amount.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <div className="flex flex-col gap-0.5">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                                        p.auditorConfirmationStatus === 'CONFIRMED'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : p.auditorConfirmationStatus === 'REJECTED'
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {p.auditorConfirmationStatus === 'CONFIRMED' ? (
                                          <>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>{isRecharge ? 'CONFIRMED & CREDITED' : 'CONFIRMED'}</span>
                                          </>
                                        ) : (
                                          <>
                                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                                            <span>{isRecharge ? 'PENDING RECHARGE APPROVAL' : 'PENDING VERIFICATION'}</span>
                                          </>
                                        )}
                                      </span>
                                      {p.confirmedBy && (
                                        <span className="text-[9px] text-slate-400 mt-0.5">
                                          By: {p.confirmedBy} at {p.confirmedAt ? new Date(p.confirmedAt).toLocaleDateString('en-IN') : ''}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right whitespace-nowrap">
                                    {p.auditorConfirmationStatus !== 'CONFIRMED' ? (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const updated = await api.confirmPantryPayment(p.id);
                                            setCustomerPantryPayments(prev => 
                                              prev.map(item => item.id === p.id ? updated : item)
                                            );
                                            // Refresh customer data to update wallet balance in admin view immediately
                                            if (selectedCustomer) {
                                              const updatedCust = await api.getCustomerById(selectedCustomer.id).catch(() => null);
                                              if (updatedCust) {
                                                setSelectedCustomer(updatedCust);
                                                setCustomers(prev => prev.map(c => c.id === updatedCust.id ? updatedCust : c));
                                              }
                                              const txns = await api.getWalletTransactions(selectedCustomer.id).catch(() => []);
                                              setCustomerWalletTxns(txns);
                                            }
                                          } catch (error: any) {
                                            console.error('Failed to confirm payment:', error);
                                            alert(error.message || 'Failed to confirm payment');
                                          }
                                        }}
                                        className={`px-2.5 py-1 text-white rounded text-[10px] font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1 ${
                                          isRecharge
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 ring-2 ring-emerald-300'
                                            : 'bg-emerald-600 hover:bg-emerald-700'
                                        }`}
                                      >
                                        {isRecharge && <Wallet className="w-3 h-3" />}
                                        <span>{isRecharge ? `Verify & Credit ₹${p.amount.toLocaleString('en-IN')}` : 'Verify & Confirm'}</span>
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>{isRecharge ? 'Credited to Wallet ✓' : 'Verified'}</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {customerOrders.map((o) => (
                    <div
                      key={o.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-slate-900">{o.id}</span>
                        <StatusBadge status={o.orderStatus} />
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Type: {o.orderType}</span>
                        <span className="font-bold text-slate-900">Total: ₹{o.totalAmount}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {o.items.length} items • Date: {o.createdAt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </AppWindowModal>
      )}

      {/* New Customer Modal */}
      {isCreateModalOpen && (
        <AppWindowModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Register Parent Household Customer"
          subtitle="Registers primary cardholder eligible for Pantry Credit and linked family cards."
          icon={<UserPlus className="w-5 h-5 text-purple-600" />}
          size="xl"
        >
          <div className="p-6">
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar Verma"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Mobile (Primary Login ID) *</label>
                    <span className="text-[10px] text-slate-400 font-mono">{formData.mobile.length}/10</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                    className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:outline-none font-mono ${
                      parentMobileStatus.available === false
                        ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/40 text-rose-900'
                        : parentMobileStatus.available === true
                        ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/40 text-emerald-900'
                        : 'border-slate-300 focus:ring-purple-500'
                    }`}
                    required
                  />
                  {parentMobileStatus.checking && (
                    <p className="text-[10px] text-purple-600 mt-1 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full border border-purple-600 border-t-transparent animate-spin"></span>
                      Verifying database uniqueness...
                    </p>
                  )}
                  {parentMobileStatus.available === true && (
                    <p className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      Unique Mobile: Available across entire database
                    </p>
                  )}
                  {parentMobileStatus.available === false && (
                    <p className="text-[10px] text-rose-600 font-medium mt-1 leading-tight flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                      <span>{parentMobileStatus.error}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address *</label>
                <input
                  type="text"
                  placeholder="e.g. House No. 42, Circular Road"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={formData.pinCode}
                    onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Approved Pantry Limit (₹) *</label>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  value={formData.pantryLimit}
                  onChange={(e) => setFormData({ ...formData, pantryLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2.5 p-3 bg-purple-50 rounded-xl border border-purple-200">
                <input
                  type="checkbox"
                  id="createGrantPantry"
                  checked={formData.isPantryAllowed}
                  onChange={(e) => setFormData({ ...formData, isPantryAllowed: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="createGrantPantry" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Grant Pantry Card Order Permission &amp; Digital Limit Access
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={parentMobileStatus.checking || parentMobileStatus.available === false || formData.mobile.length !== 10}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-all ${
                    parentMobileStatus.checking || parentMobileStatus.available === false || formData.mobile.length !== 10
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-purple-600 hover:bg-purple-700 cursor-pointer'
                  }`}
                >
                  {parentMobileStatus.checking ? 'Checking Mobile...' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* New Child Modal */}
      {isChildModalOpen && parentForChild && (
        <AppWindowModal
          isOpen={isChildModalOpen}
          onClose={() => setIsChildModalOpen(false)}
          title={`Add Linked Child Card for ${parentForChild.fullName}`}
          subtitle={`Parent ID: ${parentForChild.id} • Available: ₹${parentForChild.availablePantryLimit}`}
          icon={<Users className="w-5 h-5 text-purple-600" />}
          size="lg"
        >
          <div className="p-6">
            {parentForChild.isPantryAllowed === false ? (
              <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
                <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
                <h4 className="font-bold text-rose-900 text-sm">
                  Pantry Card Access is REVOKED for Parent Account
                </h4>
                <p className="text-xs text-rose-700 max-w-md mx-auto">
                  Linked family child accounts require active Pantry Card permission on the Parent account.
                  Please grant / allow Pantry Card permission for <strong>{parentForChild.fullName}</strong> first.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChildModalOpen(false);
                      initiatePantryPermissionChange(parentForChild);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Grant Parent Permission Now (OTP)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChildModalOpen(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateChild} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ananya Verma"
                    value={childFormData.fullName}
                    onChange={(e) => setChildFormData({ ...childFormData, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Mobile (Primary Login ID) *</label>
                    <span className="text-[10px] text-slate-400 font-mono">{childFormData.mobile.length}/10</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543212"
                    value={childFormData.mobile}
                    onChange={(e) => setChildFormData({ ...childFormData, mobile: e.target.value.replace(/\D/g, '') })}
                    className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:outline-none font-mono ${
                      childMobileStatus.available === false
                        ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/40 text-rose-900'
                        : childMobileStatus.available === true
                        ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/40 text-emerald-900'
                        : 'border-slate-300 focus:ring-purple-500'
                    }`}
                    required
                  />
                  {childMobileStatus.checking && (
                    <p className="text-[10px] text-purple-600 mt-1 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full border border-purple-600 border-t-transparent animate-spin"></span>
                      Verifying database uniqueness...
                    </p>
                  )}
                  {childMobileStatus.available === true && (
                    <p className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      Unique Mobile: Valid for Child Account
                    </p>
                  )}
                  {childMobileStatus.available === false && (
                    <p className="text-[10px] text-rose-600 font-medium mt-1 leading-tight flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                      <span>{childMobileStatus.error}</span>
                    </p>
                  )}
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Credit Limit (₹)</label>
                  <input
                    type="number"
                    min="500"
                    max={parentForChild.availablePantryLimit}
                    value={childFormData.pantryLimit}
                    onChange={(e) => setChildFormData({ ...childFormData, pantryLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
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
                    disabled={childMobileStatus.checking || childMobileStatus.available === false || childFormData.mobile.length !== 10}
                    className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-all ${
                      childMobileStatus.checking || childMobileStatus.available === false || childFormData.mobile.length !== 10
                        ? 'bg-slate-400 cursor-not-allowed opacity-60'
                        : 'bg-purple-600 hover:bg-purple-700 cursor-pointer'
                    }`}
                  >
                    {childMobileStatus.checking ? 'Checking Mobile...' : 'Create Child Card'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </AppWindowModal>
      )}

      {/* Pantry Permission Admin Mobile OTP Confirmation Modal */}
      {permissionModal.isOpen && permissionModal.customer && (
        <AppWindowModal
          isOpen={permissionModal.isOpen}
          onClose={() => setPermissionModal((prev) => ({ ...prev, isOpen: false }))}
          title={
            permissionModal.action === 'REVOKE'
              ? `Confirm Revoke: ${permissionModal.customer.fullName}`
              : `Confirm Grant Permission: ${permissionModal.customer.fullName}`
          }
          subtitle={`Customer ID: ${permissionModal.customer.id} • +91 ${permissionModal.customer.mobile}`}
          icon={
            permissionModal.action === 'REVOKE' ? (
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-purple-600" />
            )
          }
          size="md"
        >
          <div className="p-6 space-y-4">
            {/* Impact Details & Warning Banner */}
            <div
              className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
                permissionModal.action === 'REVOKE'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-purple-50 border-purple-200 text-purple-900'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-sm">
                {permissionModal.action === 'REVOKE' ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Cascading Revocation Confirmation</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Granting Pantry Card &amp; Family Access</span>
                  </>
                )}
              </div>

              {permissionModal.action === 'REVOKE' ? (
                <div>
                  <p>
                    You are about to <strong>REVOKE Pantry Card access</strong> for{' '}
                    <strong className="underline">{permissionModal.customer.fullName}</strong>.
                  </p>
                  {!permissionModal.customer.isChild ? (
                    <div className="mt-2 p-2.5 rounded-lg bg-rose-100/70 border border-rose-300 text-[11px] font-semibold text-rose-950">
                      🚨 <strong>Cascading Rule:</strong> All linked family child accounts (
                      {customers.filter((c) => c.parentCustomerId === permissionModal.customer?.id).length} child cards)
                      under this parent will also be automatically REVOKED. They will only be able to place Quick COD orders.
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-rose-800">
                      This family card will no longer have pantry credit access.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p>
                    You are granting <strong>Digital Pantry Card permission</strong> for{' '}
                    <strong className="underline">{permissionModal.customer.fullName}</strong>.
                  </p>
                  <p className="mt-1 text-[11px] text-purple-800">
                    This will enable full Pantry Credit orders, 0-COD checkout, and enable adding linked family cards.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {permissionModal.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{permissionModal.error}</span>
              </div>
            )}

            {/* Success Message */}
            {permissionModal.successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{permissionModal.successMessage}</span>
              </div>
            )}

            <form onSubmit={handleConfirmPermissionToggle} className="space-y-4">
              {/* Step 1: Admin Mobile Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-purple-600" />
                    Admin Mobile Number (OTP Target) *
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {permissionModal.adminMobile.length}/10
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    maxLength={10}
                    value={permissionModal.adminMobile}
                    onChange={(e) =>
                      setPermissionModal((prev) => ({
                        ...prev,
                        adminMobile: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="9876543210"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono font-bold text-slate-800"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSendPermissionOtp}
                    disabled={
                      permissionModal.isSendingOtp ||
                      permissionModal.adminMobile.replace(/\D/g, '').length !== 10
                    }
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs ${
                      permissionModal.otpSent
                        ? 'bg-slate-100 text-purple-700 hover:bg-slate-200 border border-purple-200'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {permissionModal.isSendingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : permissionModal.otpSent ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Resend OTP</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: OTP Sent Notification & Hint Badge */}
              {permissionModal.otpSent && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-purple-900 font-medium">
                      <KeyRound className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>OTP sent to +91 {permissionModal.adminMobile}</span>
                    </div>
                    {permissionModal.otpHint && (
                      <button
                        type="button"
                        onClick={() =>
                          setPermissionModal((prev) => ({
                            ...prev,
                            otp: prev.otpHint || '123456',
                          }))
                        }
                        className="px-2 py-0.5 bg-purple-200 hover:bg-purple-300 text-purple-950 font-mono font-bold text-[11px] rounded border border-purple-300 transition cursor-pointer"
                        title="Click to auto-fill OTP"
                      >
                        Auto-Fill: {permissionModal.otpHint}
                      </button>
                    )}
                  </div>

                  {/* Step 3: Enter 6-digit OTP */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Enter 6-Digit Admin Verification OTP *
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={permissionModal.otp}
                      onChange={(e) =>
                        setPermissionModal((prev) => ({
                          ...prev,
                          otp: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      placeholder="• • • • • •"
                      className="w-full px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white text-purple-950 shadow-inner"
                      required
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Audit Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Remarks for Audit Trail
                </label>
                <input
                  type="text"
                  value={permissionModal.reason}
                  onChange={(e) =>
                    setPermissionModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="e.g. Field verification approved, customer requested restriction"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPermissionModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    permissionModal.isVerifying ||
                    !permissionModal.otpSent ||
                    permissionModal.otp.trim().length !== 6
                  }
                  className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                    permissionModal.isVerifying ||
                    !permissionModal.otpSent ||
                    permissionModal.otp.trim().length !== 6
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : permissionModal.action === 'REVOKE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {permissionModal.isVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying &amp; Applying...</span>
                    </>
                  ) : permissionModal.action === 'REVOKE' ? (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Revoke Pantry Access</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Grant Permission</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* Update Limit Modal */}
      {isLimitModalOpen && selectedCustomer && (
        <AppWindowModal
          isOpen={isLimitModalOpen}
          onClose={() => setIsLimitModalOpen(false)}
          title={`Update Credit Limit: ${selectedCustomer.fullName}`}
          subtitle={`Current Limit: ₹${selectedCustomer.pantryLimit} • Used: ₹${selectedCustomer.usedPantryLimit}`}
          icon={<Edit3 className="w-5 h-5 text-purple-600" />}
          size="md"
        >
          <div className="p-6">
            <form onSubmit={handleUpdateLimit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Total Limit (₹)</label>
                <input
                  type="number"
                  min={selectedCustomer.usedPantryLimit}
                  value={newLimit}
                  onChange={(e) => setNewLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes for Audit Trail</label>
                <input
                  type="text"
                  value={limitReason}
                  onChange={(e) => setLimitReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLimitModalOpen(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Save Limit
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* Wallet Recharge Modal */}
      {isRechargeModalOpen && selectedCustomer && (
        <AppWindowModal
          isOpen={isRechargeModalOpen}
          onClose={() => setIsRechargeModalOpen(false)}
          title={`Top-up Customer Wallet: ${selectedCustomer.fullName}`}
          subtitle={`Current Wallet Balance: ₹${selectedCustomer.walletBalance ?? 1000} (Customer ID: ${selectedCustomer.id})`}
          icon={<Wallet className="w-5 h-5 text-emerald-600" />}
          size="md"
        >
          <div className="p-6">
            <form onSubmit={handleRechargeCustomerWallet} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recharge Amount (₹) *</label>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Payment Reference *</label>
                <input
                  type="text"
                  value={rechargeReason}
                  onChange={(e) => setRechargeReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRechargeModalOpen(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recharging}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
                >
                  {recharging ? 'Recharging...' : 'Confirm Recharge'}
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* Product Timeline Modal for Admin */}
      {selectedAdminTimeline && selectedCustomer && (
        <ProductTimelineModal
          timeline={selectedAdminTimeline}
          onClose={() => setSelectedAdminTimeline(null)}
          customerName={selectedCustomer.fullName}
        />
      )}

      {/* Detailed Audit Settlement Bill Modal for Admin */}
      {selectedAuditForBill && (
        <AuditBillModal
          onClose={() => setSelectedAuditForBill(null)}
          audit={selectedAuditForBill}
          isAdminView={true}
        />
      )}

      {/* Credit Limit / Home Stock Value Detail Drill-Down Modal for Admin */}
      {metricModalTab && selectedCustomer && (
        <CreditLimitDetailModal
          isOpen={true}
          onClose={() => setMetricModalTab(null)}
          initialTab={metricModalTab}
          customer={selectedCustomer}
          pantryItems={customerPantryItems}
          orders={customerOrders}
        />
      )}
    </div>
  );
};
