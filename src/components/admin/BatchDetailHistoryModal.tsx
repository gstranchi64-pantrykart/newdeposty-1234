import React, { useState, useEffect } from 'react';
import {
  BatchLifecycleDetails,
  BatchLedgerEntry,
  BatchOrderUsage,
  PurchaseEntry,
} from '../../types';
import { api } from '../../services/api';
import { AppWindowModal } from '../common/AppWindowModal';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { StatusBadge } from '../common/StatusBadge';
import { CustomerPantryHoldingsModal } from './CustomerPantryHoldingsModal';
import {
  Boxes,
  Package,
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
  Store,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Barcode,
  Truck,
  FileText,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  Percent,
  ChevronRight,
  ShieldAlert,
  Info,
  Download,
  Loader2,
} from 'lucide-react';
import { exportElementToPdf } from '../../utils/pdfGenerator';

interface BatchDetailHistoryModalProps {
  batchIdentifier: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenOrder?: (orderId: string) => void;
  onOpenStockAdjust?: (batchId: string, currentQty: number) => void;
  onOpenBarcodeHistory?: (barcode: string) => void;
}

export const BatchDetailHistoryModal: React.FC<BatchDetailHistoryModalProps> = ({
  batchIdentifier,
  isOpen,
  onClose,
  onOpenOrder,
  onOpenStockAdjust,
  onOpenBarcodeHistory,
}) => {
  const [data, setData] = useState<BatchLifecycleDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'PURCHASES' | 'QUICK' | 'PANTRY' | 'RETURNS_AUDITS'>('LEDGER');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'INWARD' | 'SOLD' | 'RETURNS' | 'ADJUSTMENTS'>('ALL');
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [showPantryCustomerModal, setShowPantryCustomerModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const fetchBatchDetails = async (idOrNumber: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getBatchDetails(idOrNumber);
      setData(result);
    } catch (err: any) {
      console.error('Failed to load batch details:', err);
      setError(err.message || 'Could not load batch inventory lifecycle details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && batchIdentifier) {
      fetchBatchDetails(batchIdentifier);
      setActiveTab('LEDGER');
      setLedgerFilter('ALL');
    } else {
      setData(null);
    }
  }, [isOpen, batchIdentifier]);

  if (!isOpen) return null;

  const handleCopyBatch = () => {
    if (!data?.batch.batchNumber) return;
    navigator.clipboard.writeText(data.batch.batchNumber);
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2000);
  };

  const getFilteredLedger = (): BatchLedgerEntry[] => {
    if (!data) return [];
    if (ledgerFilter === 'INWARD') {
      return data.ledgerTimeline.filter((t) => t.type === 'PURCHASE_INWARD');
    }
    if (ledgerFilter === 'SOLD') {
      return data.ledgerTimeline.filter((t) => t.type === 'QUICK_SALE' || t.type === 'PANTRY_SALE');
    }
    if (ledgerFilter === 'RETURNS') {
      return data.ledgerTimeline.filter((t) => t.type === 'CUSTOMER_RETURN');
    }
    if (ledgerFilter === 'ADJUSTMENTS') {
      return data.ledgerTimeline.filter(
        (t) => t.type === 'STOCK_CORRECTION' || t.type === 'DAMAGE_EXPIRY' || t.type === 'AUDIT_VERIFIED'
      );
    }
    return data.ledgerTimeline;
  };

  const filteredLedger = getFilteredLedger();

  return (
    <AppWindowModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-emerald-600" />
          <span>
            Batch Lifecycle Audit: <strong className="font-mono text-emerald-700">#{batchIdentifier}</strong>
          </span>
        </div>
      }
      subtitle="Complete purchase inward history, quick sold vs pantry sold deductions, and timestamped stock ledger"
      size="2xl"
    >
      <div id="printable-batch-ledger-content" className="p-4 sm:p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Loading Batch Audit Ledger...</p>
            <p className="text-xs text-slate-400">Aggregating inward purchases, customer sales, and physical movement trail</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-900">{error}</p>
            <button
              onClick={() => batchIdentifier && fetchBatchDetails(batchIdentifier)}
              className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !data ? null : (
          <>
            {/* Header Hero Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700/60 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/10 p-1 border border-white/20 shrink-0">
                    <ImageWithFallback
                      src={data.product.images?.[0] || ''}
                      alt={data.product.name}
                      className="w-full h-full object-contain rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-base sm:text-lg font-black tracking-tight text-white bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/20 flex items-center gap-1.5">
                        <span>#{data.batch.batchNumber}</span>
                        <button
                          onClick={handleCopyBatch}
                          className="text-slate-400 hover:text-white transition p-0.5 cursor-pointer"
                          title="Copy Batch Number"
                        >
                          {copiedBatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </span>

                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        {data.batch.id}
                      </span>

                      {data.summary.isExpired ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/30 text-rose-300 border border-rose-400/30">
                          🚫 Expired Stock
                        </span>
                      ) : data.summary.isNearExpiry ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-300 border border-amber-400/30">
                          ⏳ Near Expiry ({data.summary.daysRemaining}d left)
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                          ✅ Safe &amp; Fresh
                        </span>
                      )}
                    </div>

                    <h2 className="text-sm sm:text-base font-bold text-white mt-1 line-clamp-1">
                      {data.product.name}
                    </h2>

                    <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5 flex-wrap">
                      <span>Brand: <strong className="text-white">{data.product.brand || 'FMCG'}</strong></span>
                      <span>•</span>
                      <span>Category: <strong className="text-white">{data.product.category}</strong></span>
                      <span>•</span>
                      {onOpenBarcodeHistory ? (
                        <button
                          onClick={() => onOpenBarcodeHistory(data.batch.barcode)}
                          className="font-mono flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-200 border border-indigo-400/30 transition cursor-pointer"
                          title="Click to view merged Barcode-level inventory & sales"
                        >
                          <Barcode className="w-3 h-3 text-indigo-300" />
                          <span>{data.batch.barcode} (Merged Barcode Audit)</span>
                        </button>
                      ) : (
                        <span className="font-mono flex items-center gap-1">
                          <Barcode className="w-3 h-3 text-slate-400" />
                          {data.batch.barcode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side quick action */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-700/50">
                  {onOpenStockAdjust && (
                    <button
                      onClick={() => onOpenStockAdjust(data.batch.id, data.batch.availableQuantity)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition cursor-pointer flex items-center gap-1"
                    >
                      <span>Manual Stock Audit Correction</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Shelf life progress bar */}
              <div className="mt-4 pt-3 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Manufacturing Date</span>
                  <span className="font-mono font-bold text-slate-200">{data.batch.manufacturingDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Expiry Date</span>
                  <span className={`font-mono font-bold ${data.summary.isExpired ? 'text-rose-400' : 'text-slate-200'}`}>
                    {data.batch.expiryDate}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Days to Expiry</span>
                  <span className={`font-mono font-bold ${data.summary.daysRemaining <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {data.summary.daysRemaining} days left
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Shopkeeper Source</span>
                  <span className="font-semibold text-slate-200 truncate block">{data.batch.shopkeeperName || 'Vendor'}</span>
                </div>
              </div>
            </div>

            {/* KPI Summary Cards: Inward vs Outward vs Margin */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* Total Purchased */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-emerald-800 text-[11px] font-bold">
                  <span>Purchased</span>
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-xl font-black font-mono text-emerald-950 mt-1">
                  +{data.summary.initialStockPurchased}
                </div>
                <div className="text-[10px] text-emerald-700 font-medium mt-0.5 truncate">
                  Cost: ₹{data.summary.totalPurchaseCost.toLocaleString()}
                </div>
              </div>

              {/* Current Available Stock */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-blue-800 text-[11px] font-bold">
                  <span>In-Stock Available</span>
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-xl font-black font-mono text-blue-950 mt-1">
                  {data.summary.currentAvailableStock}
                </div>
                <div className="text-[10px] text-blue-700 font-medium mt-0.5">
                  Ready for Delivery
                </div>
              </div>

              {/* Total Down / Consumed */}
              <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-rose-800 text-[11px] font-bold">
                  <span>Total Down Stock</span>
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="text-xl font-black font-mono text-rose-950 mt-1">
                  -{data.summary.totalDownStock}
                </div>
                <div className="text-[10px] text-rose-700 font-medium mt-0.5 truncate">
                  Quick: {data.summary.totalQuickSold} | Pantry: {data.summary.totalPantrySold}
                </div>
              </div>

              {/* Quick Commerce Sold */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-amber-800 text-[11px] font-bold">
                  <span>Quick Sold</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-xl font-black font-mono text-amber-950 mt-1">
                  {data.summary.totalQuickSold}
                </div>
                <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                  COD Orders
                </div>
              </div>

              {/* Pantry Credit Sold */}
              <div
                onClick={() => setShowPantryCustomerModal(true)}
                className="bg-purple-50/80 hover:bg-purple-100/90 border border-purple-200 hover:border-purple-300 rounded-xl p-3 cursor-pointer transition shadow-2xs hover:shadow-xs group"
                title="Click to view which customers currently hold units from this batch (Name & Mobile Number)"
              >
                <div className="flex items-center justify-between text-purple-800 text-[11px] font-bold">
                  <span>Pantry Sold</span>
                  <span className="text-[9px] bg-purple-200 text-purple-900 px-1 py-0.2 rounded font-bold">
                    👥 View Cust.
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-purple-950 mt-1">
                  {data.summary.totalPantrySold}
                </div>
                <div className="text-[10px] text-purple-700 font-medium mt-0.5">
                  Click to see customer details
                </div>
              </div>

              {/* Unit Economics & Margin */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-slate-700 text-[11px] font-bold">
                  <span>Unit Margin</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-base font-black font-mono text-slate-900 mt-1">
                  +₹{data.summary.marginPerUnit}
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                  CP: ₹{data.summary.purchaseRate} • SP: ₹{data.summary.sellingPrice}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setActiveTab('LEDGER')}
                className={`py-2 px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'LEDGER'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Timestamped Stock Ledger</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
                  {data.ledgerTimeline.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('PURCHASES')}
                className={`py-2 px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'PURCHASES'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Purchase Inward Entries</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">
                  {data.purchases.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('QUICK')}
                className={`py-2 px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'QUICK'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Quick Sold Deductions</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono">
                  {data.quickOrders.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('PANTRY')}
                className={`py-2 px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'PANTRY'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Pantry Sold Deductions</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 font-mono">
                  {data.pantryOrders.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('RETURNS_AUDITS')}
                className={`py-2 px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'RETURNS_AUDITS'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Returns &amp; Audits</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-mono">
                  {data.returns.length + data.auditorChecks.length}
                </span>
              </button>
            </div>

            {/* TAB 1: CHRONOLOGICAL STOCK LEDGER */}
            {activeTab === 'LEDGER' && (
              <div className="space-y-3">
                {/* Ledger Quick Subfilters */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-medium">Filter Movement:</span>
                    <button
                      onClick={() => setLedgerFilter('ALL')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        ledgerFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All Events ({data.ledgerTimeline.length})
                    </button>
                    <button
                      onClick={() => setLedgerFilter('INWARD')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        ledgerFilter === 'INWARD' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      📥 Purchase Inward
                    </button>
                    <button
                      onClick={() => setLedgerFilter('SOLD')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        ledgerFilter === 'SOLD' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                      }`}
                    >
                      📤 Sold / Stock Down
                    </button>
                    <button
                      onClick={() => setLedgerFilter('RETURNS')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        ledgerFilter === 'RETURNS' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                      }`}
                    >
                      🔄 Returns Restored
                    </button>
                    <button
                      onClick={() => setLedgerFilter('ADJUSTMENTS')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        ledgerFilter === 'ADJUSTMENTS' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      ⚖️ Audits &amp; Adjustments
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
                    Showing {filteredLedger.length} events
                  </span>
                </div>

                {filteredLedger.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                    No movement events recorded for this filter.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredLedger.map((entry, idx) => {
                      const isPositive = entry.quantityChange > 0;
                      const isNegative = entry.quantityChange < 0;

                      return (
                        <div
                          key={entry.id || idx}
                          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3">
                            {/* Movement Icon Indicator */}
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                                entry.type === 'PURCHASE_INWARD'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : entry.type === 'QUICK_SALE'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : entry.type === 'PANTRY_SALE'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : entry.type === 'CUSTOMER_RETURN'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900">{entry.title}</span>
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  Ref: {entry.referenceId}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-600">
                                {entry.notes}
                              </div>

                              <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                                <span>Party: <strong className="text-slate-700">{entry.partyName}</strong></span>
                                {entry.partyContact && <span>({entry.partyContact})</span>}
                                <span>•</span>
                                <span>Sign/Operator: <strong className="text-slate-700">{entry.operator}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Qty & Timestamp */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0">
                            <div
                              className={`text-sm sm:text-base font-black font-mono ${
                                isPositive
                                  ? 'text-emerald-700'
                                  : isNegative
                                  ? 'text-rose-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              {isPositive ? `+${entry.quantityChange}` : entry.quantityChange} Units
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{entry.timestamp}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PURCHASE INWARD DETAILS */}
            {activeTab === 'PURCHASES' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Vendor Inward &amp; Procurement Receipts for this Batch</span>
                  <span className="font-mono">{data.purchases.length} Inward Records</span>
                </div>

                {data.purchases.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                    No initial purchase inward entries recorded for this batch.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Inward ID</th>
                          <th className="py-2.5 px-3">Date &amp; Timestamp</th>
                          <th className="py-2.5 px-3">Supplier / Shopkeeper</th>
                          <th className="py-2.5 px-3 text-center">Purchased Qty</th>
                          <th className="py-2.5 px-3 text-right">Cost Price (CP)</th>
                          <th className="py-2.5 px-3 text-right">Total Inward Value</th>
                          <th className="py-2.5 px-3">Invoice Ref</th>
                          <th className="py-2.5 px-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {data.purchases.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{p.id}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {p.purchaseDate || p.createdAt}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{p.shopkeeperName}</div>
                              {p.shopkeeperContact && (
                                <div className="text-[10px] text-slate-400 font-mono">{p.shopkeeperContact}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-700">
                              +{p.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                              ₹{p.purchaseRate}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                              ₹{(p.quantity * p.purchaseRate).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                              {p.invoiceReference || 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-[180px] truncate">
                              {p.notes || 'Warehouse inward verification verified'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: QUICK COMMERCE SOLD DETAILS */}
            {activeTab === 'QUICK' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Quick Commerce Customer Orders that deducted stock from this batch</span>
                  <span className="font-mono">{data.quickOrders.length} Orders</span>
                </div>

                {data.quickOrders.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                    No Quick Commerce orders have deducted stock from this batch yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Order ID</th>
                          <th className="py-2.5 px-3">Date &amp; Timestamp</th>
                          <th className="py-2.5 px-3">Customer Details</th>
                          <th className="py-2.5 px-3 text-center">Qty Down</th>
                          <th className="py-2.5 px-3 text-right">Selling Price</th>
                          <th className="py-2.5 px-3 text-right">Item Total</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Delivery Partner</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {data.quickOrders.map((qo) => (
                          <tr key={qo.orderId} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{qo.orderId}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              <div>{qo.createdAt}</div>
                              {qo.deliveredAt && (
                                <div className="text-[10px] text-emerald-600">Delivered: {qo.deliveredAt}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{qo.customerName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">+91 {qo.customerMobile}</div>
                              <div className="text-[10px] text-slate-500 line-clamp-1 max-w-[160px]">{qo.deliveryAddress}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-rose-700">
                              -{qo.quantitySold}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                              ₹{qo.sellingPrice}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                              ₹{qo.totalItemAmount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge status={qo.orderStatus} />
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              {qo.assignedDeliveryBoyName ? (
                                <div className="flex items-center gap-1 text-slate-800 font-medium">
                                  <Truck className="w-3 h-3 text-blue-500 shrink-0" />
                                  <span>{qo.assignedDeliveryBoyName}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-[10px]">Unassigned</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {onOpenOrder && (
                                <button
                                  onClick={() => onOpenOrder(qo.orderId)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold cursor-pointer"
                                >
                                  Inspect
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PANTRY REPLENISHMENT SOLD DETAILS */}
            {activeTab === 'PANTRY' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Pantry Credit Card Replenishments that debited stock from this batch</span>
                  <span className="font-mono">{data.pantryOrders.length} Pantry Orders</span>
                </div>

                {data.pantryOrders.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                    No Pantry Card replenishments have debited stock from this batch yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Order ID</th>
                          <th className="py-2.5 px-3">Date &amp; Timestamp</th>
                          <th className="py-2.5 px-3">Customer Details</th>
                          <th className="py-2.5 px-3 text-center">Debited Qty</th>
                          <th className="py-2.5 px-3 text-right">Pantry Rate</th>
                          <th className="py-2.5 px-3 text-right">Debited Amount</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Delivery Partner</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {data.pantryOrders.map((po) => (
                          <tr key={po.orderId} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{po.orderId}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              <div>{po.createdAt}</div>
                              {po.deliveredAt && (
                                <div className="text-[10px] text-purple-600">Handover: {po.deliveredAt}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{po.customerName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">+91 {po.customerMobile}</div>
                              <div className="text-[10px] text-slate-500 line-clamp-1 max-w-[160px]">{po.deliveryAddress}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-purple-700">
                              -{po.quantitySold}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                              ₹{po.sellingPrice}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                              ₹{po.totalItemAmount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge status={po.orderStatus} />
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              {po.assignedDeliveryBoyName ? (
                                <div className="flex items-center gap-1 text-slate-800 font-medium">
                                  <Truck className="w-3 h-3 text-blue-500 shrink-0" />
                                  <span>{po.assignedDeliveryBoyName}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-[10px]">Unassigned</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {onOpenOrder && (
                                <button
                                  onClick={() => onOpenOrder(po.orderId)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold cursor-pointer"
                                >
                                  Inspect
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: RETURNS & PHYSICAL AUDITS */}
            {activeTab === 'RETURNS_AUDITS' && (
              <div className="space-y-4">
                {/* Returns Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-blue-600" />
                    <span>Customer Returns Restored to this Batch ({data.returns.length})</span>
                  </h4>

                  {data.returns.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs text-center">
                      No returns recorded for this batch.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.returns.map((ret) => (
                        <div
                          key={ret.id}
                          className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              Return {ret.id} • Order Ref: {ret.orderId}
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              Customer: <strong>{ret.customerName}</strong> • Reason: {ret.reason}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Logged: {ret.createdAt} • Restored Status: {ret.status}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-black text-blue-700 text-sm block">
                              +{ret.quantity} Units
                            </span>
                            <span className="text-[10px] text-blue-600 font-bold">Restored to Batch</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auditor Checks Section */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Auditor Physical Spot Checks ({data.auditorChecks.length})</span>
                  </h4>

                  {data.auditorChecks.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs text-center">
                      No physical field audits recorded yet for this batch.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.auditorChecks.map((audit) => (
                        <div
                          key={audit.id}
                          className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              Audit #{audit.id} • Auditor: {audit.auditorName}
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              Customer Inspected: <strong>{audit.customerName}</strong> • Purpose: {audit.purpose || 'Stock and quality verification'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Check Date: {audit.startedAt || audit.visitDate || audit.requestedDate || 'Recent'}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {audit.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="text-slate-500 font-mono text-[11px]">
          Batch ID: <strong className="text-slate-800">{data?.batch.id || batchIdentifier}</strong> • Barcode: {data?.batch.barcode}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setIsGeneratingPdf(true);
              try {
                const batchNum = data?.batch.batchNumber || batchIdentifier || 'batch';
                await exportElementToPdf('printable-batch-ledger-content', {
                  filename: `BatchLedgerReport-${batchNum}.pdf`,
                  orientation: 'portrait',
                });
              } catch (err) {
                console.error('Failed to export batch ledger PDF:', err);
              } finally {
                setIsGeneratingPdf(false);
              }
            }}
            disabled={isGeneratingPdf || !data}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-bold cursor-pointer transition flex items-center gap-1 shadow-xs"
            title="Download Batch Lifecycle Ledger as PDF"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </>
            )}
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold cursor-pointer transition flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Print Ledger</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition shadow-xs"
          >
            Close
          </button>
        </div>
      </div>

      {showPantryCustomerModal && (
        <CustomerPantryHoldingsModal
          isOpen={showPantryCustomerModal}
          onClose={() => setShowPantryCustomerModal(false)}
          batchNumber={data?.batch.batchNumber || batchIdentifier || undefined}
          barcode={data?.batch.barcode}
          productName={data?.batch.productName}
          onOpenOrder={onOpenOrder}
        />
      )}
    </AppWindowModal>
  );
};
