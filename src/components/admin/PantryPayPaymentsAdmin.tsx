import React, { useState, useEffect } from 'react';
import { PantryPayment } from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import {
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Package,
  RefreshCw,
  Eye,
  X,
  Check,
  DollarSign,
  QrCode,
  Copy,
  ExternalLink,
  Calendar,
  Layers,
  ArrowUpRight,
  Sparkles,
  Info,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface PantryPayPaymentsAdminProps {
  initialFilter?: string;
  onNavigateCustomer?: (customerId: string) => void;
}

export const PantryPayPaymentsAdmin: React.FC<PantryPayPaymentsAdminProps> = ({
  initialFilter,
  onNavigateCustomer,
}) => {
  const [payments, setPayments] = useState<PantryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter || 'ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');

  // Modals
  const [selectedPayment, setSelectedPayment] = useState<PantryPayment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Accept / Confirm Modal with Remarks
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [acceptingPayment, setAcceptingPayment] = useState<PantryPayment | null>(null);
  const [acceptRemark, setAcceptRemark] = useState('');
  const [processingAccept, setProcessingAccept] = useState(false);

  // Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Invalid UTR / Transaction reference mismatch');
  const [customRejectNotes, setCustomRejectNotes] = useState('');
  const [processingReject, setProcessingReject] = useState(false);

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.getAllPantryPayments();
      // Sort latest first
      const sorted = [...data].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime() || 0;
        const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime() || 0;
        if (timeB !== timeA) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
      setPayments(sorted);
    } catch (err: any) {
      console.error('Error loading pantry payments:', err);
      showToast('error', err.message || 'Failed to load pantry payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Accept Modal
  const handleOpenAcceptModal = (payment: PantryPayment) => {
    setAcceptingPayment(payment);
    setAcceptRemark('Verified and approved via bank UPI reference check');
    setIsAcceptModalOpen(true);
  };

  // Submit Confirm / Accept Payment with Remark
  const handleSubmitAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptingPayment) return;

    setProcessingAccept(true);
    try {
      const updated = await api.confirmPantryPayment(acceptingPayment.id, acceptRemark.trim() || undefined);
      showToast('success', `Payment #${acceptingPayment.id} confirmed & accepted successfully!`);
      setIsAcceptModalOpen(false);
      setAcceptingPayment(null);
      setAcceptRemark('');
      await fetchData();
      if (selectedPayment && selectedPayment.id === acceptingPayment.id) {
        setSelectedPayment(updated);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to confirm payment');
    } finally {
      setProcessingAccept(false);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (paymentId: string) => {
    setRejectingPaymentId(paymentId);
    setRejectReason('Invalid UTR / Transaction reference mismatch');
    setCustomRejectNotes('');
    setIsRejectModalOpen(true);
  };

  // Submit Reject Payment
  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPaymentId) return;

    const finalReason = customRejectNotes.trim()
      ? `${rejectReason}: ${customRejectNotes.trim()}`
      : rejectReason;

    setProcessingReject(true);
    try {
      const updated = await api.rejectPantryPayment(rejectingPaymentId, finalReason);
      showToast('info', `Payment #${rejectingPaymentId} marked as REJECTED.`);
      setIsRejectModalOpen(false);
      setRejectingPaymentId(null);
      await fetchData();
      if (selectedPayment && selectedPayment.id === rejectingPaymentId) {
        setSelectedPayment(updated);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reject payment');
    } finally {
      setProcessingReject(false);
    }
  };

  // Filtered Payments
  const filteredPayments = payments.filter((p) => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        p.id.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.customerMobile.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.transactionRef && p.transactionRef.toLowerCase().includes(q)) ||
        (p.confirmedBy && p.confirmedBy.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Status
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING' && p.auditorConfirmationStatus !== 'PENDING') return false;
      if (statusFilter === 'CONFIRMED' && p.auditorConfirmationStatus !== 'CONFIRMED') return false;
      if (statusFilter === 'REJECTED' && p.auditorConfirmationStatus !== 'REJECTED') return false;
    }

    // Method
    if (methodFilter !== 'ALL' && p.paymentMethod !== methodFilter) return false;

    // Type
    if (typeFilter === 'WALLET_RECHARGE') {
      const isRecharge = p.isWalletRecharge || p.paymentType === 'WALLET_RECHARGE' || p.productId?.startsWith('WALLET-');
      if (!isRecharge) return false;
    } else if (typeFilter === 'PRODUCT') {
      const isRecharge = p.isWalletRecharge || p.paymentType === 'WALLET_RECHARGE' || p.productId?.startsWith('WALLET-');
      if (isRecharge) return false;
    }

    // Date
    if (dateFilter === 'TODAY') {
      const today = new Date().toISOString().split('T')[0];
      if (!p.createdAt?.startsWith(today)) return false;
    }

    return true;
  });

  // KPI Calculations
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingPayments = payments.filter((p) => p.auditorConfirmationStatus === 'PENDING');
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const confirmedPayments = payments.filter((p) => p.auditorConfirmationStatus === 'CONFIRMED');
  const confirmedAmount = confirmedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayPayments = payments.filter((p) => p.createdAt?.startsWith(todayStr));
  const todayAmount = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-md transition animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : toast.type === 'error' ? (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span className="text-xs font-semibold">{toast.text}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Customer Pantry Pay Payments &amp; Settlement Hub
                </h1>
                {pendingPayments.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                    {pendingPayments.length} Pending Verification
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized ledger of all customer UPI / Bank payments, consumed item settlements, and wallet recharges across all accounts.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Transactions
        </button>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Collected */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition ${
            statusFilter === 'ALL'
              ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-400/30'
              : 'bg-white border-slate-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between text-purple-800 text-[11px] font-black uppercase tracking-wider">
            <span>Total Collections</span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-950 mt-1">
            ₹{totalAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-purple-700 mt-0.5">
            {payments.length} total transactions
          </div>
        </div>

        {/* Pending Verification */}
        <div
          onClick={() => setStatusFilter('PENDING')}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition ${
            statusFilter === 'PENDING'
              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-800 text-[11px] font-black uppercase tracking-wider">
            <span>Pending Approval</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950 mt-1">
            ₹{pendingAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            {pendingPayments.length} payments require action
          </div>
        </div>

        {/* Confirmed / Accepted */}
        <div
          onClick={() => setStatusFilter('CONFIRMED')}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition ${
            statusFilter === 'CONFIRMED'
              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 text-[11px] font-black uppercase tracking-wider">
            <span>Confirmed / Accepted</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-1">
            ₹{confirmedAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">
            {confirmedPayments.length} verified &amp; settled
          </div>
        </div>

        {/* Today's Collection */}
        <div
          onClick={() => {
            setDateFilter(dateFilter === 'TODAY' ? 'ALL' : 'TODAY');
          }}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition ${
            dateFilter === 'TODAY'
              ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400/30'
              : 'bg-white border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-blue-800 text-[11px] font-black uppercase tracking-wider">
            <span>Today's Payments</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-950 mt-1">
            ₹{todayAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-blue-700 mt-0.5">
            {todayPayments.length} transactions today
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Customer Name, Mobile, UTR/Ref No, Product, or Barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="CONFIRMED">Confirmed / Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="w-full md:w-36">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
            >
              <option value="ALL">All Methods</option>
              <option value="UPI">UPI / QR</option>
              <option value="BANK">Bank Transfer</option>
            </select>
          </div>

          {/* Payment Type Filter */}
          <div className="w-full md:w-44">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
            >
              <option value="ALL">All Payment Types</option>
              <option value="PRODUCT">Item Consumption</option>
              <option value="WALLET_RECHARGE">Wallet Recharge</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider shrink-0">
            Quick Filter:
          </span>
          {['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-full font-bold transition cursor-pointer text-xs shrink-0 ${
                statusFilter === st
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Payments' : st}
            </button>
          ))}

          <button
            onClick={() => setDateFilter(dateFilter === 'TODAY' ? 'ALL' : 'TODAY')}
            className={`px-3 py-1 rounded-full font-bold transition cursor-pointer text-xs shrink-0 ${
              dateFilter === 'TODAY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📅 Today Only
          </button>
        </div>
      </div>

      {/* Main Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600" />
            <p className="text-sm font-bold">Loading Customer Pantry Payments...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-2">
            <CreditCard className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-base font-bold text-slate-700">No Pantry Pay Transactions Found</p>
            <p className="text-xs text-slate-400">
              Try adjusting your search query, status, or date filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Payment ID &amp; Date</th>
                  <th className="py-3.5 px-4">Customer Details</th>
                  <th className="py-3.5 px-4">Product / Purpose</th>
                  <th className="py-3.5 px-4">UTR / Bank Ref</th>
                  <th className="py-3.5 px-4 text-center">Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Verified By</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPayments.map((pay) => {
                  const isBusy = actionLoadingId === pay.id;
                  const isRecharge = pay.isWalletRecharge || pay.paymentType === 'WALLET_RECHARGE' || pay.productId?.startsWith('WALLET-');

                  return (
                    <tr key={pay.id} className="hover:bg-slate-50/80 transition">
                      {/* ID & Date */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold font-mono text-slate-900 text-xs">
                          #{pay.id}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{pay.createdAt ? new Date(pay.createdAt).toLocaleString('en-IN') : 'N/A'}</span>
                        </div>
                      </td>

                      {/* Customer Details */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{pay.customerName}</span>
                          {onNavigateCustomer && (
                            <button
                              onClick={() => onNavigateCustomer(pay.customerId)}
                              className="text-purple-600 hover:text-purple-800 cursor-pointer"
                              title="View Customer Profile"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <span>📞 +91 {pay.customerMobile}</span>
                        </div>
                      </td>

                      {/* Product / Purpose */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {isRecharge ? (
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-black text-[11px]">
                              ⚡ Wallet Recharge
                            </span>
                          ) : (
                            <span>{pay.productName}</span>
                          )}
                        </div>
                        {pay.barcode && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Barcode: <span className="font-semibold">{pay.barcode}</span>
                          </div>
                        )}
                      </td>

                      {/* UTR / Bank Ref */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1 font-mono text-slate-800 font-semibold bg-slate-100 px-2 py-1 rounded-md border border-slate-200 w-fit">
                          <span>{pay.transactionRef || 'N/A'}</span>
                          {pay.transactionRef && (
                            <button
                              onClick={() => handleCopy(pay.transactionRef, pay.id)}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                              title="Copy UTR Ref"
                            >
                              {copiedId === pay.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Method: <strong className="text-slate-600 uppercase">{pay.paymentMethod || 'UPI'}</strong>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 align-top text-center">
                        <div className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-900 font-black text-sm rounded-xl">
                          ₹{pay.amount?.toLocaleString('en-IN')}
                        </div>
                      </td>

                      {/* Confirmation Status */}
                      <td className="py-3.5 px-4 align-top">
                        <StatusBadge status={pay.auditorConfirmationStatus || 'PENDING'} />
                        {pay.paymentStatus === 'SUCCESS' && (
                          <div className="text-[10px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Payment Captured
                          </div>
                        )}
                      </td>

                      {/* Verified By */}
                      <td className="py-3.5 px-4 align-top">
                        {pay.confirmedBy ? (
                          <div className="text-xs">
                            <div className="font-semibold text-slate-800">{pay.confirmedBy}</div>
                            <div className="text-[10px] text-slate-400">
                              {pay.confirmedAt ? new Date(pay.confirmedAt).toLocaleDateString('en-IN') : 'Confirmed'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-semibold italic">Awaiting Action</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* View Detail */}
                          <button
                            onClick={() => {
                              setSelectedPayment(pay);
                              setIsDetailModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>

                          {/* Accept / Confirm Button */}
                          {pay.auditorConfirmationStatus !== 'CONFIRMED' && (
                            <button
                              onClick={() => handleOpenAcceptModal(pay)}
                              disabled={isBusy}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Accept & Verify Payment"
                            >
                              {isBusy ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Accept
                            </button>
                          )}

                          {/* Reject Button */}
                          {pay.auditorConfirmationStatus !== 'REJECTED' && (
                            <button
                              onClick={() => handleOpenRejectModal(pay.id)}
                              disabled={isBusy}
                              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Reject Invalid Payment"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILED PAYMENT RECEIPT MODAL */}
      {isDetailModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Pantry Payment Receipt #{selectedPayment.id}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Recorded on {selectedPayment.createdAt ? new Date(selectedPayment.createdAt).toLocaleString('en-IN') : 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount Banner */}
            <div className="bg-purple-900 text-white p-5 rounded-2xl text-center space-y-1">
              <div className="text-xs uppercase tracking-wider font-bold text-purple-300">
                Total Payment Amount
              </div>
              <div className="text-3xl font-black">
                ₹{selectedPayment.amount?.toLocaleString('en-IN')}
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <StatusBadge status={selectedPayment.auditorConfirmationStatus || 'PENDING'} />
                <span className="text-xs font-mono text-purple-200 uppercase">
                  via {selectedPayment.paymentMethod || 'UPI'}
                </span>
              </div>
            </div>

            {/* Customer & Product Information */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Customer Name:</span>
                <span className="font-bold text-slate-900">{selectedPayment.customerName}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Mobile Number:</span>
                <span className="font-mono font-bold text-slate-900">+91 {selectedPayment.customerMobile}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Product / Purpose:</span>
                <span className="font-bold text-purple-900">{selectedPayment.productName}</span>
              </div>

              {selectedPayment.barcode && (
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-semibold">Barcode:</span>
                  <span className="font-mono text-slate-800">{selectedPayment.barcode}</span>
                </div>
              )}

              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">UTR / Bank Reference:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                  {selectedPayment.transactionRef || 'N/A'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Confirmation Status:</span>
                <span className="font-bold text-slate-900">{selectedPayment.auditorConfirmationStatus}</span>
              </div>

              {selectedPayment.adminRemarks && (
                <div className="border-t border-slate-200 pt-2 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-emerald-800 font-bold block mb-0.5">Admin Acceptance Remarks:</span>
                  <span className="text-emerald-950 font-medium">{selectedPayment.adminRemarks}</span>
                </div>
              )}

              {selectedPayment.rejectionReason && (
                <div className="border-t border-slate-200 pt-2 bg-rose-50/60 p-2.5 rounded-lg border border-rose-200">
                  <span className="text-rose-800 font-bold block mb-0.5">Rejection Reason / Notes:</span>
                  <span className="text-rose-950 font-medium">{selectedPayment.rejectionReason}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {selectedPayment.auditorConfirmationStatus !== 'REJECTED' && (
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenRejectModal(selectedPayment.id);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Reject Payment
                  </button>
                )}

                {selectedPayment.auditorConfirmationStatus !== 'CONFIRMED' && (
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenAcceptModal(selectedPayment);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Accept Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACCEPT / CONFIRM PAYMENT MODAL WITH REMARKS */}
      {isAcceptModalOpen && acceptingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Accept &amp; Confirm Payment #{acceptingPayment.id}
              </h3>
              <button
                onClick={() => setIsAcceptModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Confirmation Alert Banner */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Confirmation Message:
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Are you sure you want to verify and accept this settlement of{' '}
                <strong className="font-black text-emerald-950">₹{acceptingPayment.amount?.toLocaleString('en-IN')}</strong> from{' '}
                <strong className="font-black text-emerald-950">{acceptingPayment.customerName}</strong>?
                {acceptingPayment.isWalletRecharge || acceptingPayment.productId?.startsWith('WALLET-')
                  ? ' Customer wallet balance will be credited instantly.'
                  : ' Payment will be settled against pantry items.'}
              </p>
            </div>

            {/* Quick Summary Box */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800">{acceptingPayment.customerName} (+91 {acceptingPayment.customerMobile})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">UTR / Ref:</span>
                <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">{acceptingPayment.transactionRef || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount &amp; Method:</span>
                <span className="font-bold text-emerald-700">₹{acceptingPayment.amount?.toLocaleString('en-IN')} ({acceptingPayment.paymentMethod || 'UPI'})</span>
              </div>
            </div>

            {/* Form & Remark Field */}
            <form onSubmit={handleSubmitAccept} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Confirmation Remarks / Verification Notes (टिप्पणी)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter acceptance remark (e.g. UTR verified in bank statement, amount credited, approved by admin)..."
                  value={acceptRemark}
                  onChange={(e) => setAcceptRemark(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Quick Remark Suggestion Chips */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Quick Remark Options:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Verified & confirmed via bank UPI reference check',
                    'UTR matched with HDFC account statement',
                    'Amount credited and approved by Admin',
                    'Direct customer payment verified',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAcceptRemark(chip)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 rounded-lg text-[11px] text-slate-700 font-medium transition cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAcceptModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingAccept || !acceptRemark.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {processingAccept ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Confirm &amp; Accept Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT PAYMENT MODAL */}
      {isRejectModalOpen && rejectingPaymentId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Reject Pantry Payment #{rejectingPaymentId}
              </h3>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Rejection Reason *
                </label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                >
                  <option value="Invalid UTR / Transaction reference mismatch">Invalid UTR / Transaction reference mismatch</option>
                  <option value="Payment amount mismatch">Payment amount mismatch</option>
                  <option value="Duplicate transaction reference">Duplicate transaction reference</option>
                  <option value="Payment not credited to bank account">Payment not credited to bank account</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain reason for rejecting this payment..."
                  value={customRejectNotes}
                  onChange={(e) => setCustomRejectNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingReject}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  {processingReject && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
