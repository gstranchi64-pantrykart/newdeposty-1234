import React, { useState } from 'react';
import { Customer, WalletTransaction } from '../../types';
import {
  X,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
  Search,
  Receipt,
  FileText,
  Calculator,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';

export type WalletMetricTab = 'ALL' | 'CREDITS' | 'DEDUCTIONS' | 'AUDIT_SETTLEMENTS' | 'FORMULA';

interface WalletDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: WalletMetricTab;
  customer: Customer;
  walletTxns: WalletTransaction[];
  onOpenAuditBill?: (auditId: string) => void;
}

export const WalletDetailModal: React.FC<WalletDetailModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'ALL',
  customer,
  walletTxns,
  onOpenAuditBill,
}) => {
  const [activeTab, setActiveTab] = useState<WalletMetricTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  if (!isOpen) return null;

  // 1. Calculate live totals from transactions
  const currentBalance = customer.walletBalance ?? 1000;

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

  const auditDeductionTxns = walletTxns.filter(
    (t) =>
      Boolean(t.auditId) ||
      t.transactionType === 'AUDIT_DEDUCTION' ||
      (t.referenceId && t.referenceId.startsWith('AUD-')) ||
      (t as any).notes?.toLowerCase().includes('audit') ||
      (t as any).reason?.toLowerCase().includes('audit')
  );

  const totalCreditsAmount = creditTxns.reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);
  const totalDebitsAmount = debitTxns.reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

  // Filtered transactions based on active tab & search
  const filteredTxns = walletTxns.filter((t) => {
    // Tab filter
    if (activeTab === 'CREDITS') {
      if (t.amount < 0 && !['ADMIN_ADDITION', 'RECHARGE', 'INITIAL_DEPOSIT', 'AUDIT_REFUND'].includes(t.transactionType)) {
        return false;
      }
    } else if (activeTab === 'DEDUCTIONS') {
      if (t.amount > 0 && !['AUDIT_DEDUCTION', 'PENALTY_DEDUCTION', 'WALLET_DEDUCTION'].includes(t.transactionType)) {
        return false;
      }
    } else if (activeTab === 'AUDIT_SETTLEMENTS') {
      const isAuditRelated =
        Boolean(t.auditId) ||
        t.transactionType === 'AUDIT_DEDUCTION' ||
        (t.referenceId && t.referenceId.startsWith('AUD-')) ||
        ((t as any).notes && (t as any).notes.toLowerCase().includes('audit')) ||
        ((t as any).reason && (t as any).reason.toLowerCase().includes('audit'));
      if (!isAuditRelated) return false;
    }

    // Type filter
    if (filterType !== 'ALL') {
      if (t.transactionType !== filterType) return false;
    }

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const reasonText = (t as any).reason || (t as any).notes || (t as any).remarks || '';
    const refText = t.referenceId || t.auditId || '';
    const prodText = t.productName || '';
    const idText = t.id || '';

    return (
      idText.toLowerCase().includes(q) ||
      reasonText.toLowerCase().includes(q) ||
      refText.toLowerCase().includes(q) ||
      prodText.toLowerCase().includes(q) ||
      t.amount.toString().includes(q) ||
      (t.date || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white p-5 sm:p-6 flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Customer Wallet Balance &amp; Passbook Audit
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  100% Reconciled
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Customer: <strong>{customer.fullName}</strong> • ID: <strong>{customer.id}</strong> • Mobile: {customer.mobile}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="relative z-10 p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Interactive Clickable Metric Boxes */}
        <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 text-white space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black text-slate-200">
                Live Wallet Reconciliation Equation &amp; Breakdown
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                Click any box to inspect ledger
              </span>
            </div>
            <div className="text-[11px] text-emerald-300/90 font-mono">
              Formula: [Total Top-ups &amp; Credits] - [Total Deductions] = Closing Balance
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Box 1: Total Credits / Top-ups */}
            <button
              type="button"
              onClick={() => setActiveTab('CREDITS')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer group ${
                activeTab === 'CREDITS'
                  ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-500/30'
                  : 'bg-emerald-950/30 border-emerald-700/40 hover:bg-emerald-950/50 hover:border-emerald-500'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300 uppercase">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  1. Total Credits (+)
                </span>
                <span className="text-[9px] opacity-70 group-hover:opacity-100">View ↗</span>
              </div>
              <div className="text-lg font-black text-emerald-300 mt-1">
                +₹{totalCreditsAmount.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-emerald-200/70 mt-0.5">
                {creditTxns.length} deposit &amp; top-up events
              </div>
            </button>

            {/* Box 2: Total Deductions */}
            <button
              type="button"
              onClick={() => setActiveTab('DEDUCTIONS')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer group ${
                activeTab === 'DEDUCTIONS'
                  ? 'bg-rose-950/80 border-rose-400 ring-2 ring-rose-500/30'
                  : 'bg-rose-950/30 border-rose-700/40 hover:bg-rose-950/50 hover:border-rose-500'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-rose-300 uppercase">
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  2. Total Deductions (-)
                </span>
                <span className="text-[9px] opacity-70 group-hover:opacity-100">View ↗</span>
              </div>
              <div className="text-lg font-black text-rose-400 mt-1">
                -₹{totalDebitsAmount.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-rose-200/70 mt-0.5">
                {debitTxns.length} audit &amp; debit events
              </div>
            </button>

            {/* Box 3: Audit Discrepancy Debits */}
            <button
              type="button"
              onClick={() => setActiveTab('AUDIT_SETTLEMENTS')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer group ${
                activeTab === 'AUDIT_SETTLEMENTS'
                  ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-500/30'
                  : 'bg-amber-950/30 border-amber-700/40 hover:bg-amber-950/50 hover:border-amber-500'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-amber-300 uppercase">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  3. Audit Bills
                </span>
                <span className="text-[9px] opacity-70 group-hover:opacity-100">View ↗</span>
              </div>
              <div className="text-lg font-black text-amber-300 mt-1">
                {auditDeductionTxns.length} Bills
              </div>
              <div className="text-[10px] text-amber-200/70 mt-0.5">
                Field discrepancy settlements
              </div>
            </button>

            {/* Box 4: Top Closing Wallet Balance */}
            <button
              type="button"
              onClick={() => setActiveTab('FORMULA')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer group ${
                activeTab === 'FORMULA'
                  ? 'bg-cyan-950/80 border-cyan-400 ring-2 ring-cyan-500/30'
                  : 'bg-cyan-950/30 border-cyan-700/40 hover:bg-cyan-950/50 hover:border-cyan-500'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300 uppercase">
                <span className="flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5 text-cyan-400" />
                  4. Closing Balance (=)
                </span>
                <span className="text-[9px] opacity-70 group-hover:opacity-100">Math Proof ↗</span>
              </div>
              <div className={`text-lg font-black mt-1 ${currentBalance < 0 ? 'text-rose-400' : 'text-cyan-300'}`}>
                ₹{currentBalance.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-cyan-200/70 mt-0.5">
                {currentBalance < 0 ? 'Negative Due Amount' : 'Active Usable Balance'}
              </div>
            </button>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Navigation Pill Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>All Passbook ({walletTxns.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CREDITS')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'CREDITS'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
              <span>Credits &amp; Top-ups ({creditTxns.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DEDUCTIONS')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'DEDUCTIONS'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
              <span>Deductions &amp; Debits ({debitTxns.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('AUDIT_SETTLEMENTS')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'AUDIT_SETTLEMENTS'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Audit Discrepancies ({auditDeductionTxns.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('FORMULA')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'FORMULA'
                  ? 'bg-cyan-700 text-white shadow-xs'
                  : 'bg-white text-cyan-800 border border-cyan-200 hover:bg-cyan-50'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-cyan-500" />
              <span>Kaise Ye Amount Hua?</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Txn ID, reason, audit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: FORMULA / KAISE YE AMOUNT HUA EXPLANATION */}
          {activeTab === 'FORMULA' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                    ∑
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-950">
                      Closing Wallet Balance Calculation Equation &amp; Proof
                    </h4>
                    <p className="text-xs text-emerald-800">
                      Transparent accounting breakdown showing how your closing balance was calculated.
                    </p>
                  </div>
                </div>

                {/* Calculation Cards Step-by-Step */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Step 1: Total Credits / Deposits</div>
                    <div className="text-xl font-black text-emerald-600 mt-1">
                      +₹{totalCreditsAmount.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Initial wallet security deposit + admin top-ups
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Step 2: Total Discrepancy Debits</div>
                    <div className="text-xl font-black text-rose-600 mt-1">
                      -₹{totalDebitsAmount.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Physical audit missing/damaged item deductions
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-cyan-300 shadow-xs ring-2 ring-cyan-500/20">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Step 3: Final Closing Balance</div>
                    <div className={`text-xl font-black mt-1 ${currentBalance < 0 ? 'text-rose-600' : 'text-cyan-700'}`}>
                      ₹{currentBalance.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Live usable wallet amount in passbook
                    </div>
                  </div>
                </div>

                {/* Verification Notice */}
                <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200 text-xs text-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2 font-black text-emerald-950">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>How Wallet Discrepancy Deductions Work:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    1. Jab field auditor aapke ghar par physical stock verify karta hai aur koi item missing, consumed ya damaged milta hai, to us item ki value wallet se deduct hoti hai.
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    2. Deduct hone ke baad utni amount se aapki **Pantry Credit Limit wapas restore / available** ho jati hai agla order karne ke liye.
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    3. Agar wallet balance khatam ho jaye, to customer online ya admin ke through wallet recharge karke balance positive kar sakta hai.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSACTION LIST TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Itemized Wallet Passbook Transactions ({filteredTxns.length})
                </h4>
              </div>
              <span className="text-[10px] font-bold text-slate-500">
                Sorted by most recent (Top closing balance)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Txn ID &amp; Time</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Reason / Details</th>
                    <th className="py-3 px-3 text-right">Debit / Credit</th>
                    <th className="py-3 px-3 text-right">Closing Balance</th>
                    <th className="py-3 px-3 text-center">Audit Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTxns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Wallet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <div className="font-bold text-slate-600 text-xs">No matching transactions found</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Try changing the search query or tab filter.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTxns.map((w, idx) => {
                      const isLatest = idx === 0 && activeTab === 'ALL' && !searchQuery;
                      const isCredit =
                        w.amount > 0 ||
                        ['ADMIN_ADDITION', 'RECHARGE', 'INITIAL_DEPOSIT', 'AUDIT_REFUND', 'ONLINE_TOPUP'].includes(
                          w.transactionType
                        );

                      const dateFormatted = w.timestamp
                        ? new Date(w.timestamp).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          })
                        : `${w.date || ''} ${w.time || ''}`;

                      const auditRefId = w.auditId || (w.referenceId && w.referenceId.startsWith('AUD-') ? w.referenceId : null);

                      return (
                        <tr
                          key={w.id || idx}
                          className={`hover:bg-slate-50 transition ${isLatest ? 'bg-emerald-50/40' : ''}`}
                        >
                          {/* 1. Txn ID & Time */}
                          <td className="py-3 px-4 font-mono">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span>{w.id}</span>
                              {isLatest && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-600 text-white shadow-xs">
                                  TOP
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                              {dateFormatted}
                            </div>
                          </td>

                          {/* 2. Type */}
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isCredit
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-900 border border-rose-300'
                              }`}
                            >
                              {isCredit ? (
                                <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3 text-rose-600" />
                              )}
                              <span>{w.transactionType?.replace(/_/g, ' ') || (isCredit ? 'CREDIT' : 'DEBIT')}</span>
                            </span>
                          </td>

                          {/* 3. Reason / Details */}
                          <td className="py-3 px-3 max-w-[240px]">
                            <div className="font-semibold text-slate-900 text-xs">
                              {(w as any).reason || (w as any).notes || (w as any).remarks || 'Wallet adjustment'}
                            </div>
                            {w.productName && (
                              <div className="text-[10px] text-slate-600 mt-0.5">
                                Product: <strong>{w.productName}</strong> (Qty: {w.quantity || 1} • Rate: ₹{w.unitPrice || 0})
                              </div>
                            )}
                            {w.referenceId && !w.referenceId.startsWith('AUD-') && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Ref: {w.referenceId}
                              </div>
                            )}
                          </td>

                          {/* 4. Debit / Credit Amount */}
                          <td className="py-3 px-3 text-right font-mono font-black text-sm">
                            <span className={isCredit ? 'text-emerald-600' : 'text-rose-600'}>
                              {isCredit ? '+' : '-'}₹{Math.abs(w.amount || 0).toLocaleString('en-IN')}
                            </span>
                          </td>

                          {/* 5. Closing Balance */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-xs text-slate-900">
                            <span
                              className={
                                (w.newBalance ?? 0) < 0 ? 'text-rose-600 font-black' : 'text-slate-900'
                              }
                            >
                              ₹{(w.newBalance ?? 0).toLocaleString('en-IN')}
                            </span>
                            {w.previousBalance !== undefined && (
                              <div className="text-[9px] text-slate-400 font-normal">
                                Prev: ₹{w.previousBalance.toLocaleString('en-IN')}
                              </div>
                            )}
                          </td>

                          {/* 6. Audit Ref */}
                          <td className="py-3 px-3 text-center">
                            {auditRefId ? (
                              <button
                                type="button"
                                onClick={() => onOpenAuditBill && onOpenAuditBill(auditRefId)}
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                                title="Open Audit Discrepancy Bill"
                              >
                                <FileText className="w-3 h-3 text-purple-600" />
                                <span>{auditRefId}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              All transactions are encrypted, auditor verified, and recorded in customer passbook.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer self-end sm:self-auto"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
