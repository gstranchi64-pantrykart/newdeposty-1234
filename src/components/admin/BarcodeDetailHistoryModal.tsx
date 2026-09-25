import React, { useState, useEffect, useMemo } from 'react';
import {
  BarcodeLifecycleDetails,
  BatchLedgerEntry,
  BarcodeMergedBatchSummary,
  BatchOrderUsage,
  CustomerPantryHolding,
  CustomerPantryHoldingsResponse,
} from '../../types';
import { api } from '../../services/api';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { AppWindowModal } from '../common/AppWindowModal';
import { CustomerPantryHoldingsModal } from './CustomerPantryHoldingsModal';
import { getDeliveryDayCount, parseOrderDate } from '../../utils/dateTimeUtils';
import {
  Barcode,
  Boxes,
  Truck,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Ban,
  ArrowDownLeft,
  ArrowUpRight,
  Store,
  User,
  Phone,
  MapPin,
  RefreshCw,
  FileText,
  Search,
  IndianRupee,
  Layers,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  Sparkles,
  ExternalLink,
  PlusCircle,
  Copy,
  Check,
  Printer,
  ChevronRight,
  Users,
  ShieldCheck,
  Filter,
  Download,
} from 'lucide-react';

interface BarcodeDetailHistoryModalProps {
  barcode: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenOrder?: (orderId: string) => void;
  onOpenBatchHistory?: (batchNumber: string) => void;
  onOpenPurchaseInward?: (barcode: string) => void;
  onOpenCustomerProfile?: (customerId: string) => void;
}

export const BarcodeDetailHistoryModal: React.FC<BarcodeDetailHistoryModalProps> = ({
  barcode,
  isOpen,
  onClose,
  onOpenOrder,
  onOpenBatchHistory,
  onOpenPurchaseInward,
  onOpenCustomerProfile,
}) => {
  const [data, setData] = useState<BarcodeLifecycleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState(false);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'all' | 'pantryCustomers' | 'purchases' | 'sales' | 'batches' | 'ledger'>('all');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUST'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [showPantryCustomerModal, setShowPantryCustomerModal] = useState(false);

  // Customer Pantry Live Holdings state for this barcode
  const [pantryData, setPantryData] = useState<CustomerPantryHoldingsResponse | null>(null);
  const [pantryLoading, setPantryLoading] = useState(false);
  const [pantryDaysFilter, setPantryDaysFilter] = useState<'ALL' | '5_PLUS' | '10_PLUS' | '15_PLUS' | '30_PLUS'>('ALL');
  const [pantryStockOnly, setPantryStockOnly] = useState(true);
  const [pantrySearchQuery, setPantrySearchQuery] = useState('');
  const [copiedMobileId, setCopiedMobileId] = useState<string | null>(null);

  const fetchPantryHoldings = async () => {
    if (!barcode) return;
    setPantryLoading(true);
    try {
      const res = await api.getPantryHoldings({ barcode });
      setPantryData(res);
    } catch (e) {
      console.error('Failed to load barcode customer pantry holdings:', e);
    } finally {
      setPantryLoading(false);
    }
  };

  const fetchDetails = async () => {
    if (!barcode) return;
    setLoading(true);
    setError(null);
    try {
      const [res, pHoldings] = await Promise.all([
        api.getBarcodeDetails(barcode),
        api.getPantryHoldings({ barcode }),
      ]);
      setData(res);
      setPantryData(pHoldings);
    } catch (err: any) {
      console.error('Failed to load barcode lifecycle details:', err);
      setError(err?.message || 'Failed to fetch details for this barcode.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && barcode) {
      fetchDetails();
    }
  }, [isOpen, barcode]);

  // Nearest and oldest customer delivery dates & days elapsed across all customers holding this barcode
  const { pantryNearestDelivery, pantryOldestDelivery } = useMemo(() => {
    const items = pantryData?.items || [];
    if (!items.length) return { pantryNearestDelivery: null, pantryOldestDelivery: null };

    let nearest = items[0];
    let oldest = items[0];
    let maxTime = parseOrderDate(nearest.deliveryDate)?.getTime() || 0;
    let minTime = parseOrderDate(oldest.deliveryDate)?.getTime() || Infinity;

    items.forEach((it) => {
      const t = parseOrderDate(it.deliveryDate)?.getTime() || 0;
      if (t > maxTime) {
        maxTime = t;
        nearest = it;
      }
      if (t < minTime && t > 0) {
        minTime = t;
        oldest = it;
      }
    });

    const nearInfo = getDeliveryDayCount(nearest.deliveryDate);
    const oldInfo = getDeliveryDayCount(oldest.deliveryDate);

    return {
      pantryNearestDelivery: {
        customerName: nearest.customerName,
        deliveryDate: nearest.deliveryDate || '',
        daysCount: nearest.daysSinceDelivery ?? nearInfo.dayNumber,
        badgeLabel: nearInfo.badgeLabel,
      },
      pantryOldestDelivery: {
        customerName: oldest.customerName,
        deliveryDate: oldest.deliveryDate || '',
        daysCount: oldest.daysSinceDelivery ?? oldInfo.dayNumber,
        badgeLabel: oldInfo.badgeLabel,
      },
    };
  }, [pantryData]);

  const handleExportPantryHoldingsCsv = () => {
    const items = pantryData?.items || [];
    if (!items.length) {
      alert('No customer pantry holdings found for this barcode.');
      return;
    }

    const headers = [
      'Customer Name',
      'Customer Mobile',
      'Customer Address',
      'Customer ID',
      'Product Name',
      'Barcode',
      'Batch Number',
      'MRP (INR)',
      'Unit Price (INR)',
      'Hold Qty in Pantry',
      'Total Delivered Qty',
      'Total Value (INR)',
      'Delivery Date',
      'Days Since Delivery',
      'Manufacturing Date (MFG)',
      'Expiry Date (EXP)',
      'MFG to Expiry Days (Lifespan)',
      'Expiry Status',
      'Order ID',
      'Auditor Verification Status',
    ];

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = items.map((it) => {
      const dayInfo = getDeliveryDayCount(it.deliveryDate);
      const daysCount = it.daysSinceDelivery ?? dayInfo.dayNumber;
      return [
        escapeCsv(it.customerName),
        escapeCsv(it.customerMobile),
        escapeCsv(it.customerAddress),
        escapeCsv(it.customerId),
        escapeCsv(it.productName),
        escapeCsv(it.barcode),
        escapeCsv(it.batchNumber),
        escapeCsv(it.mrp || it.unitPrice || 0),
        escapeCsv(it.unitPrice),
        escapeCsv(it.currentPantryQuantity),
        escapeCsv(it.orderedQuantity),
        escapeCsv(it.totalValue),
        escapeCsv(it.deliveryDate || ''),
        escapeCsv(`${daysCount} Days Elapsed`),
        escapeCsv(it.manufacturingDate || ''),
        escapeCsv(it.expiryDate || ''),
        escapeCsv(it.mfgToExpiryDays ? `${it.mfgToExpiryDays} Days` : 'N/A'),
        escapeCsv(it.isExpired ? 'EXPIRED' : it.isNearExpiry ? 'NEAR_EXPIRY' : 'SAFE'),
        escapeCsv(it.orderId || ''),
        escapeCsv(it.auditorVerificationStatus || 'PENDING_AUDIT'),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Barcode_${barcode}_Customer_Pantry_Holdings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(true);
    setTimeout(() => setCopiedBarcode(false), 2000);
  };

  const product = data?.product;
  const summary = data?.summary;
  const batches = data?.batches || [];
  const purchases = data?.purchases || [];
  const quickOrders = data?.quickOrders || [];
  const pantryOrders = data?.pantryOrders || [];
  const returns = data?.returns || [];
  const ledgerTimeline = data?.ledgerTimeline || [];

  // Filtered ledger
  const filteredLedger = ledgerTimeline.filter((entry) => {
    if (ledgerFilter === 'PURCHASE' && entry.type !== 'PURCHASE_INWARD') return false;
    if (ledgerFilter === 'SALE' && entry.type !== 'QUICK_SALE' && entry.type !== 'PANTRY_SALE') return false;
    if (ledgerFilter === 'RETURN' && entry.type !== 'CUSTOMER_RETURN') return false;
    if (ledgerFilter === 'ADJUST' && entry.type !== 'STOCK_CORRECTION' && entry.type !== 'DAMAGE_EXPIRY') return false;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.referenceId.toLowerCase().includes(q) ||
        (entry.partyName && entry.partyName.toLowerCase().includes(q)) ||
        (entry.notes && entry.notes.toLowerCase().includes(q)) ||
        (entry.operator && entry.operator.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const allSales: (BatchOrderUsage & { saleSource: 'QUICK' | 'PANTRY' })[] = [
    ...quickOrders.map((qo) => ({ ...qo, saleSource: 'QUICK' as const })),
    ...pantryOrders.map((po) => ({ ...po, saleSource: 'PANTRY' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <AppWindowModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Barcode className="w-5 h-5 text-indigo-600" />
          <span>
            Barcode Product Management: <strong className="font-mono text-indigo-700">{barcode}</strong>
          </span>
        </div>
      }
      subtitle="Merged batch inventory, complete inward purchases history, customer order debits, and unified ledger"
      size="2xl"
    >
      <div className="p-4 sm:p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-9 h-9 animate-spin text-indigo-600 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Aggregating Merged Barcode Records...</p>
            <p className="text-xs text-slate-400">Joining all batches, supplier inward purchases, and sales down stock</p>
          </div>
        ) : error ? (
          <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
            <h4 className="text-base font-bold text-rose-900">Barcode Lookup Failed</h4>
            <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchDetails}
              className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Try Again
            </button>
          </div>
        ) : !data || !summary ? (
          <div className="p-8 text-center text-slate-500 text-xs">No records available for this barcode.</div>
        ) : (
          <>
            {/* Header Hero Card: Product & Barcode Summary */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-800/40 relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                {/* Left: Product & Barcode Info */}
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl bg-white/10 p-1.5 border border-white/10 shrink-0 overflow-hidden shadow-inner">
                    <ImageWithFallback
                      src={product?.images?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'}
                      alt={product?.name || 'Product'}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold uppercase tracking-wider">
                        {product?.category || 'General'}
                      </span>
                      {summary.totalAvailableStock === 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/30 text-rose-200 border border-rose-400/30 text-[10px] font-bold flex items-center gap-1">
                          <Ban className="w-3 h-3" /> Out of Stock
                        </span>
                      ) : summary.totalAvailableStock <= 5 ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-200 border border-amber-400/30 text-[10px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> In Stock
                        </span>
                      )}
                      {summary.hasNearExpiry && (
                        <span className="px-2 py-0.5 rounded-md bg-orange-500/30 text-orange-200 border border-orange-400/30 text-[10px] font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Batch Near Expiry
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-white leading-tight">
                      {product?.name || 'Product Item'}
                    </h3>
                    <p className="text-xs text-indigo-200/80 mt-0.5 font-medium">
                      {product?.brand ? `${product.brand} • ` : ''}{product?.weightSize ? `${product.weightSize} • ` : ''}Product ID: {product?.id}
                    </p>

                    {/* Barcode Tag with Copy */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/40 border border-indigo-400/40 font-mono font-bold text-xs text-emerald-300">
                        <Barcode className="w-4 h-4 text-indigo-400" />
                        <span>{barcode}</span>
                      </div>
                      <button
                        onClick={handleCopyBarcode}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
                        title="Copy Barcode"
                      >
                        {copiedBarcode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onOpenPurchaseInward && (
                    <button
                      onClick={() => onOpenPurchaseInward(barcode)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>New Purchase Inward</span>
                    </button>
                  )}
                  <button
                    onClick={fetchDetails}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition cursor-pointer"
                    title="Refresh Data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Merged KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mt-5 pt-4 border-t border-white/10">
                <div className="bg-white/5 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
                  <div className="text-[10px] text-slate-300 font-medium uppercase tracking-wider flex items-center gap-1">
                    <Boxes className="w-3 h-3 text-emerald-400" />
                    <span>Merged Stock</span>
                  </div>
                  <div className="text-xl font-black text-emerald-400 mt-1">
                    {summary.totalAvailableStock} <span className="text-xs font-normal text-slate-300">units</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Across {summary.totalBatchesCount} batches</div>
                </div>

                <div className="bg-white/5 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
                  <div className="text-[10px] text-slate-300 font-medium uppercase tracking-wider flex items-center gap-1">
                    <ArrowDownLeft className="w-3 h-3 text-indigo-400" />
                    <span>Total Purchased</span>
                  </div>
                  <div className="text-xl font-black text-white mt-1">
                    {summary.totalInitialPurchased} <span className="text-xs font-normal text-slate-300">units</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">₹{(summary.totalPurchaseCost).toLocaleString('en-IN')} CP</div>
                </div>

                <div className="bg-white/5 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
                  <div className="text-[10px] text-slate-300 font-medium uppercase tracking-wider flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3 text-rose-400" />
                    <span>Quick Sold</span>
                  </div>
                  <div className="text-xl font-black text-rose-300 mt-1">
                    {summary.totalQuickSold} <span className="text-xs font-normal text-slate-300">units</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{quickOrders.length} customer orders</div>
                </div>

                <div
                  onClick={() => setActiveTab('pantryCustomers')}
                  className="bg-white/5 hover:bg-purple-900/40 p-2.5 rounded-xl border border-white/10 hover:border-purple-400/50 cursor-pointer transition shadow-2xs hover:shadow-xs group"
                  title="Click to view Customer Pantry Stock & Days in Stock for all customers holding this barcode"
                >
                  <div className="text-[10px] text-purple-200 font-medium uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-purple-400" />
                      <span>Pantry In-Stock</span>
                    </span>
                    <span className="text-[9px] bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded-full font-bold group-hover:bg-purple-500 group-hover:text-white transition">
                      {pantryData?.summary.uniqueCustomersCount ?? 0} Cust. 👥
                    </span>
                  </div>
                  <div className="text-xl font-black text-purple-300 mt-1">
                    {pantryData?.summary.totalCurrentPantryQuantity ?? summary.totalPantrySold} <span className="text-xs font-normal text-slate-300">units</span>
                  </div>
                  <div className="text-[10px] text-purple-200/80 mt-0.5 truncate">
                    {pantryNearestDelivery
                      ? `Nearest: Day ${pantryNearestDelivery.daysCount} (${pantryNearestDelivery.customerName})`
                      : 'View customer delivery days'}
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
                  <div className="text-[10px] text-slate-300 font-medium uppercase tracking-wider flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-sky-400" />
                    <span>Returned</span>
                  </div>
                  <div className="text-xl font-black text-sky-300 mt-1">
                    {summary.totalReturnedStock} <span className="text-xs font-normal text-slate-300">units</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Restored to inventory</div>
                </div>

                <div className="bg-white/5 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
                  <div className="text-[10px] text-slate-300 font-medium uppercase tracking-wider flex items-center gap-1">
                    <IndianRupee className="w-3 h-3 text-amber-400" />
                    <span>Realized Profit</span>
                  </div>
                  <div className="text-xl font-black text-amber-300 mt-1">
                    ₹{Math.max(0, summary.profitEarned).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{summary.marginPercent}% avg margin</div>
                </div>
              </div>
            </div>

            {/* Price & Expiry Meta Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                  ₹
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Pricing Economics</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    Avg Inward CP: <strong className="text-indigo-700">₹{summary.averagePurchaseRate}</strong> • SP: <strong className="text-emerald-700">₹{summary.sellingPrice}</strong> (MRP ₹{summary.mrp})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Active Batches Merged</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {summary.activeBatchesCount} Active Batches with In-Stock Quantity ({summary.totalBatchesCount} total recorded)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${summary.daysToNearestExpiry <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-slate-500 font-medium">Earliest Expiry Batch</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {summary.nearestExpiryDate ? (
                      <span>{summary.nearestExpiryDate} ({summary.daysToNearestExpiry > 0 ? `${summary.daysToNearestExpiry} days left` : 'Expired'})</span>
                    ) : (
                      <span>No expiry recorded</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Overview & All Batches ({batches.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('pantryCustomers')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'pantryCustomers'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-purple-500" />
                <span>Customer Pantry Stock &amp; Days ({pantryData?.summary.totalCurrentPantryQuantity ?? summary.totalPantrySold} In-Stock)</span>
              </button>

              <button
                onClick={() => setActiveTab('purchases')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'purchases'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Purchase Inward History ({purchases.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('sales')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'sales'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                <span>Sales Deductions ({allSales.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('batches')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'batches'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Batch Level Stock Breakdown ({batches.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Chronological Ledger ({ledgerTimeline.length})</span>
              </button>
            </div>

            {/* TAB: CUSTOMER PANTRY IN-STOCK HOLDINGS & DELIVERY DAYS */}
            {activeTab === 'pantryCustomers' && (
              <div className="space-y-4">
                {/* Header & Days Filter Card */}
                <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-950 rounded-2xl text-white shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-300" />
                        <span>Live Customer Pantry In-Stock Distribution for Barcode #{barcode}</span>
                      </h4>
                      <p className="text-xs text-purple-200/80 mt-0.5">
                        Shows which customer currently has this item at home, how many units in-stock, and exact days since delivery.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportPantryHoldingsCsv}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-emerald-400/40 cursor-pointer shadow-xs transition"
                        title="Export this barcode's customer pantry holdings to Excel (.csv)"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Excel (.csv)</span>
                      </button>
                      <button
                        onClick={fetchPantryHoldings}
                        disabled={pantryLoading}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-white/20 cursor-pointer self-start sm:self-auto"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${pantryLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-purple-800/50 text-xs">
                    <div className="bg-white/10 p-2 rounded-lg">
                      <div className="text-[10px] text-purple-200 uppercase">Active In-Pantry</div>
                      <div className="text-lg font-black text-white">{pantryData?.summary.totalCurrentPantryQuantity ?? 0} Units</div>
                    </div>
                    <div className="bg-white/10 p-2 rounded-lg">
                      <div className="text-[10px] text-purple-200 uppercase">Total Delivered</div>
                      <div className="text-lg font-black text-emerald-300">{pantryData?.summary.totalDeliveredQuantity ?? 0} Units</div>
                    </div>
                    <div className="bg-white/10 p-2 rounded-lg">
                      <div className="text-[10px] text-purple-200 uppercase">Unique Households</div>
                      <div className="text-lg font-black text-amber-300">{pantryData?.summary.uniqueCustomersCount ?? 0} Customers</div>
                    </div>
                    <div className="bg-white/10 p-2 rounded-lg">
                      <div className="text-[10px] text-purple-200 uppercase">Holding Value</div>
                      <div className="text-lg font-black text-white">₹{(pantryData?.summary.totalValue ?? 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-400/30">
                      <div className="text-[10px] text-emerald-200 uppercase font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-300" />
                        <span>Nearest Delivery</span>
                      </div>
                      <div className="text-xs font-black text-emerald-300 truncate mt-0.5" title={pantryNearestDelivery?.customerName}>
                        {pantryNearestDelivery ? `Day ${pantryNearestDelivery.daysCount} (${pantryNearestDelivery.deliveryDate})` : 'N/A'}
                      </div>
                      <div className="text-[10px] text-emerald-200/80 truncate">
                        {pantryNearestDelivery?.customerName || 'None'}
                      </div>
                    </div>
                    <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-400/30">
                      <div className="text-[10px] text-blue-200 uppercase font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-blue-300" />
                        <span>Oldest Delivery</span>
                      </div>
                      <div className="text-xs font-black text-blue-300 truncate mt-0.5" title={pantryOldestDelivery?.customerName}>
                        {pantryOldestDelivery ? `Day ${pantryOldestDelivery.daysCount} (${pantryOldestDelivery.deliveryDate})` : 'N/A'}
                      </div>
                      <div className="text-[10px] text-blue-200/80 truncate">
                        {pantryOldestDelivery?.customerName || 'None'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter Toolbar: Search & Days */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter by customer name, phone (+91), address, batch #..."
                        value={pantrySearchQuery}
                        onChange={(e) => setPantrySearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={pantryStockOnly}
                        onChange={(e) => setPantryStockOnly(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                      />
                      <span>In-Stock Only (&gt; 0 Units)</span>
                    </label>
                  </div>

                  {/* Quick Days Filter Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
                      <Clock className="w-3.5 h-3.5 text-purple-600" />
                      <span>Filter By Days Since Delivery:</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => setPantryDaysFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        pantryDaysFilter === 'ALL'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      All Days
                    </button>

                    <button
                      type="button"
                      onClick={() => setPantryDaysFilter('5_PLUS')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        pantryDaysFilter === '5_PLUS'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>5+ Days</span>
                      <span className="text-[10px] opacity-75">(≥ 5d)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPantryDaysFilter('10_PLUS')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        pantryDaysFilter === '10_PLUS'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>10+ Days</span>
                      <span className="text-[10px] opacity-75">(≥ 10d)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPantryDaysFilter('15_PLUS')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        pantryDaysFilter === '15_PLUS'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>15+ Days</span>
                      <span className="text-[10px] opacity-75">(≥ 15d)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPantryDaysFilter('30_PLUS')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        pantryDaysFilter === '30_PLUS'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>30+ Days</span>
                      <span className="text-[10px] opacity-75">(≥ 30d)</span>
                    </button>

                    {pantryDaysFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setPantryDaysFilter('ALL')}
                        className="text-[11px] text-purple-600 font-bold hover:underline ml-2 cursor-pointer"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer Cards List */}
                {(() => {
                  const filtered = (pantryData?.items || []).filter((it) => {
                    if (pantryStockOnly && it.currentPantryQuantity <= 0) return false;
                    const dayInfo = getDeliveryDayCount(it.deliveryDate);
                    const daysCount = it.daysSinceDelivery ?? dayInfo.dayNumber;
                    if (pantryDaysFilter === '5_PLUS' && daysCount < 5) return false;
                    if (pantryDaysFilter === '10_PLUS' && daysCount < 10) return false;
                    if (pantryDaysFilter === '15_PLUS' && daysCount < 15) return false;
                    if (pantryDaysFilter === '30_PLUS' && daysCount < 30) return false;

                    if (pantrySearchQuery.trim()) {
                      const q = pantrySearchQuery.toLowerCase();
                      return (
                        it.customerName.toLowerCase().includes(q) ||
                        it.customerMobile.toLowerCase().includes(q) ||
                        it.customerAddress.toLowerCase().includes(q) ||
                        (it.batchNumber && it.batchNumber.toLowerCase().includes(q)) ||
                        (it.orderId && it.orderId.toLowerCase().includes(q))
                      );
                    }
                    return true;
                  });

                  if (pantryLoading && !pantryData) {
                    return (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                        Loading customer holdings for this barcode...
                      </div>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <div className="font-bold">No Customer Records Found</div>
                        <p className="text-slate-400 mt-0.5">
                          {pantrySearchQuery || pantryDaysFilter !== 'ALL' || pantryStockOnly
                            ? 'No customer pantry matches your current filters. Try resetting the days/in-stock filters.'
                            : 'No customer pantries currently hold this barcode item.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      <div className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                        <span>Showing {filtered.length} Customer Pantry Location{filtered.length > 1 ? 's' : ''}</span>
                        <span className="text-[11px] text-slate-400">Sorted by live in-pantry stock &amp; delivery timeline</span>
                      </div>

                      {filtered.map((item, idx) => {
                        const dayInfo = getDeliveryDayCount(item.deliveryDate);
                        const exactDays = item.daysSinceDelivery ?? dayInfo.dayNumber;
                        const isCopied = copiedMobileId === (item.pantryCardItemId || String(idx));

                        return (
                          <div
                            key={item.pantryCardItemId || `${item.orderId}-${idx}`}
                            className="bg-white p-4 rounded-xl border border-slate-200 hover:border-purple-300 shadow-2xs transition"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-200">
                                  {item.customerName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="font-bold text-slate-900 text-sm">{item.customerName}</h5>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
                                      ID: {item.customerId}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        item.currentPantryQuantity > 0
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}
                                    >
                                      {item.currentPantryQuantity > 0
                                        ? `In-Pantry Stock: ${item.currentPantryQuantity} Unit${item.currentPantryQuantity > 1 ? 's' : ''}`
                                        : 'Stock Consumed / Returned'}
                                    </span>
                                  </div>

                                  {/* Contact & Actions */}
                                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs">
                                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                      <a href={`tel:${item.customerMobile}`} className="hover:underline font-mono">
                                        {item.customerMobile}
                                      </a>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard?.writeText(item.customerMobile);
                                          setCopiedMobileId(item.pantryCardItemId || String(idx));
                                          setTimeout(() => setCopiedMobileId(null), 2000);
                                        }}
                                        className="ml-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                                        title="Copy mobile number"
                                      >
                                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>

                                    {item.orderId && (
                                      <button
                                        onClick={() => onOpenOrder && onOpenOrder(item.orderId)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold cursor-pointer font-mono"
                                      >
                                        <span>Order #{item.orderId}</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    )}

                                    {onOpenCustomerProfile && (
                                      <button
                                        onClick={() => onOpenCustomerProfile(item.customerId)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold cursor-pointer"
                                      >
                                        <Users className="w-3 h-3" />
                                        <span>360 Profile</span>
                                      </button>
                                    )}

                                    {/* Exact Days Since Delivery Badge */}
                                    {item.deliveryDate && (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-slate-500 text-xs flex items-center gap-1">
                                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                          <span>Delivered: {item.deliveryDate}</span>
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1 ${
                                            exactDays <= 7
                                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                              : exactDays <= 14
                                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                                              : exactDays <= 21
                                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                                              : 'bg-rose-100 text-rose-800 border-rose-300'
                                          }`}
                                        >
                                          <Clock className="w-3 h-3 shrink-0" />
                                          <span>{exactDays} Days Since Delivery ({dayInfo.badgeLabel})</span>
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Address */}
                                  <div className="flex items-start gap-1.5 mt-2 text-xs text-slate-600">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                    <span>{item.customerAddress}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Quantity & Value */}
                              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 bg-purple-50 sm:bg-transparent p-2 sm:p-0 rounded-lg shrink-0">
                                <div className="text-right">
                                  <div className="text-[11px] font-semibold text-purple-900">Current In-Pantry Stock</div>
                                  <div className="text-lg font-black text-purple-700 font-mono">
                                    {item.currentPantryQuantity} Unit{item.currentPantryQuantity > 1 ? 's' : ''}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    (Delivered: {item.orderedQuantity})
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-[11px] text-slate-500 font-medium">MRP &amp; Valuation</div>
                                  <div className="text-sm font-bold text-slate-900 font-mono">
                                    ₹{item.totalValue} <span className="text-[10px] text-purple-700 font-bold">(MRP: ₹{item.mrp || item.unitPrice})</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    @ Selling ₹{item.unitPrice}/u
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Batch, Lifespan & Status footer */}
                            <div className="pt-2 mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-slate-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  <Boxes className="w-3 h-3 text-emerald-600" />
                                  <span>Batch #{item.batchNumber}</span>
                                </span>
                                {item.manufacturingDate && (
                                  <span className="text-slate-600 text-[10px]">
                                    MFG: <strong className="text-slate-800">{item.manufacturingDate}</strong>
                                  </span>
                                )}
                                {item.expiryDate && (
                                  <span className={`text-[10px] ${item.isExpired ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                                    EXP: <strong>{item.expiryDate}</strong>
                                  </span>
                                )}
                                {item.mfgToExpiryDays ? (
                                  <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 text-[10px]">
                                    {item.mfgToExpiryDays} Days Total Shelf Life
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-2">
                                {item.isExpired ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <span>Expired</span>
                                  </span>
                                ) : item.isNearExpiry ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Expires in {item.daysToExpiry}d</span>
                                  </span>
                                ) : null}

                                {item.auditorVerificationStatus === 'AVAILABLE' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Auditor Verified (Available)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                                    <Clock className="w-3 h-3" />
                                    <span>Active Record</span>
                                  </span>
                                )}
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

            {/* TAB 1: OVERVIEW & ALL BATCHES */}
            {activeTab === 'all' && (
              <div className="space-y-5">
                {/* PROMINENT CUSTOMER PANTRY IN-STOCK & DAYS ELAPSED SECTION */}
                <div className="bg-white rounded-xl border border-purple-200 overflow-hidden shadow-xs">
                  <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 border-b border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-purple-950 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-700" />
                        <span>Customer Pantry Stock &amp; Days in Stock ({(pantryData?.items || []).length} Customers • {pantryData?.summary.totalCurrentPantryQuantity ?? summary.totalPantrySold} Units In-Stock)</span>
                      </h4>
                      <p className="text-[11px] text-purple-700/80 mt-0.5">
                        Live customer shelf holdings for Barcode #{barcode}: verified customer name, mobile, address, delivery date, and exact days elapsed.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {pantryNearestDelivery && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1.5 shadow-2xs">
                          <Clock className="w-3.5 h-3.5 text-purple-700" />
                          <span>Nearest Delivery: {pantryNearestDelivery.deliveryDate} (Day {pantryNearestDelivery.daysCount})</span>
                        </span>
                      )}
                      <button
                        onClick={() => setActiveTab('pantryCustomers')}
                        className="text-xs font-bold px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <span>Manage All Customers</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Customer Records Table in Overview */}
                  <div className="overflow-x-auto">
                    {pantryLoading && !pantryData ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-600 mb-1.5" />
                        Loading customer pantry holdings...
                      </div>
                    ) : (pantryData?.items || []).length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <Users className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                        No customers currently holding this barcode item in pantry.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/75 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Customer Details</th>
                            <th className="py-2.5 px-3">Batch &amp; Order</th>
                            <th className="py-2.5 px-3 text-center">In-Pantry Qty</th>
                            <th className="py-2.5 px-3 text-right">MRP &amp; Value</th>
                            <th className="py-2.5 px-3">Delivery Date &amp; Days Elapsed (Every Customer)</th>
                            <th className="py-2.5 px-3">MFG / EXP (Lifespan)</th>
                            <th className="py-2.5 px-3">Auditor Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(pantryData?.items || []).map((item, idx) => {
                            const dayInfo = getDeliveryDayCount(item.deliveryDate);
                            const exactDays = item.daysSinceDelivery ?? dayInfo.dayNumber;
                            const isCopied = copiedMobileId === (item.pantryCardItemId || `ov-${idx}`);

                            return (
                              <tr key={item.pantryCardItemId || `ov-${idx}`} className="hover:bg-purple-50/30 transition">
                                <td className="py-2.5 px-3">
                                  <div className="flex items-start gap-2">
                                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-200 mt-0.5">
                                      {item.customerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                        <span>{item.customerName}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">({item.customerId})</span>
                                      </div>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono text-[10px]">
                                          <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                          <a href={`tel:${item.customerMobile}`} className="hover:underline">
                                            {item.customerMobile}
                                          </a>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard?.writeText(item.customerMobile);
                                              setCopiedMobileId(item.pantryCardItemId || `ov-${idx}`);
                                              setTimeout(() => setCopiedMobileId(null), 2000);
                                            }}
                                            className="ml-0.5 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                                            title="Copy mobile number"
                                          >
                                            {isCopied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2 h-2" />}
                                          </button>
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-start gap-1 max-w-xs truncate" title={item.customerAddress}>
                                        <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0 mt-0.5" />
                                        <span className="truncate">{item.customerAddress}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {item.batchNumber ? (
                                    <button
                                      onClick={() => onOpenBatchHistory && onOpenBatchHistory(item.batchNumber)}
                                      className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 inline-flex items-center gap-1 transition cursor-pointer"
                                      title="Open Batch Lifecycle"
                                    >
                                      <Boxes className="w-3 h-3 text-emerald-600" />
                                      <span>#{item.batchNumber}</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 text-xs italic">N/A</span>
                                  )}
                                  {item.orderId && (
                                    <div className="mt-1">
                                      <button
                                        onClick={() => onOpenOrder && onOpenOrder(item.orderId)}
                                        className="font-mono text-[10px] text-indigo-700 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                      >
                                        <span>Order #{item.orderId}</span>
                                        <ExternalLink className="w-2 h-2" />
                                      </button>
                                    </div>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                                      item.currentPantryQuantity > 0
                                        ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {item.currentPantryQuantity} unit{item.currentPantryQuantity > 1 ? 's' : ''}
                                  </span>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    Delivered: {item.orderedQuantity}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono">
                                  <div className="font-bold text-slate-900 text-xs">
                                    ₹{item.totalValue}
                                  </div>
                                  <div className="text-[10px] text-purple-700 font-bold">
                                    MRP: ₹{item.mrp || item.unitPrice}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    @ ₹{item.unitPrice}/u
                                  </div>
                                </td>

                                {/* Delivery Date & Days Elapsed - Calculated for every customer from their delivery date */}
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="text-slate-800 text-xs font-semibold flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    <span>{item.deliveryDate || 'N/A'}</span>
                                  </div>
                                  {item.deliveryDate && (
                                    <div className="mt-1">
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 shadow-2xs ${
                                          exactDays <= 7
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                            : exactDays <= 14
                                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                                            : exactDays <= 21
                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                            : 'bg-rose-100 text-rose-800 border-rose-300'
                                        }`}
                                      >
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>{exactDays} Days Since Delivery ({dayInfo.badgeLabel})</span>
                                      </span>
                                    </div>
                                  )}
                                </td>

                                {/* MFG / EXP & Lifespan */}
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="text-[11px] text-slate-700 font-medium">
                                    MFG: {item.manufacturingDate || 'N/A'}
                                  </div>
                                  <div className={`text-[11px] ${item.isExpired ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                                    EXP: {item.expiryDate || 'N/A'}
                                  </div>
                                  {item.mfgToExpiryDays ? (
                                    <div className="mt-0.5">
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                                        {item.mfgToExpiryDays}d Lifespan
                                      </span>
                                    </div>
                                  ) : null}
                                </td>

                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {item.auditorVerificationStatus === 'AVAILABLE' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                                      <CheckCircle className="w-2.5 h-2.5" />
                                      <span>Verified</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px]">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>Pending Audit</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  {onOpenCustomerProfile && (
                                    <button
                                      onClick={() => onOpenCustomerProfile(item.customerId)}
                                      className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                                      title="Open 360 Customer Profile"
                                    >
                                      Profile
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Batches Merged Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-indigo-600" />
                      <span>Physical Batches Merged Under Barcode #{barcode}</span>
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Total {summary.totalAvailableStock} Available / {summary.totalInitialPurchased} Purchased
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/75 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Batch Number</th>
                          <th className="py-2.5 px-3">MFG & EXP Date</th>
                          <th className="py-2.5 px-3 text-center">Purchased</th>
                          <th className="py-2.5 px-3 text-center">In-Stock</th>
                          <th className="py-2.5 px-3 text-center">Quick Sold</th>
                          <th className="py-2.5 px-3 text-center">Pantry Sold</th>
                          <th className="py-2.5 px-3">Inward Supplier</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batches.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                              No batches recorded for this barcode yet.
                            </td>
                          </tr>
                        ) : (
                          batches.map((b) => (
                            <tr key={b.batchId} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3">
                                <button
                                  onClick={() => onOpenBatchHistory && onOpenBatchHistory(b.batchNumber)}
                                  className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono font-bold border border-indigo-200 transition cursor-pointer text-xs"
                                  title="Click to view full batch lifecycle audit"
                                >
                                  <Boxes className="w-3 h-3 text-indigo-500 group-hover:scale-110 transition-transform" />
                                  <span>#{b.batchNumber}</span>
                                </button>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="text-[11px] font-semibold text-slate-800">EXP: {b.expiryDate}</div>
                                <div className="text-[10px] text-slate-400">MFG: {b.manufacturingDate}</div>
                                {b.isExpired ? (
                                  <span className="text-[9px] font-bold text-rose-600 flex items-center gap-0.5">
                                    <Ban className="w-2.5 h-2.5" /> Expired
                                  </span>
                                ) : b.isNearExpiry ? (
                                  <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" /> {b.daysToExpiry}d left
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-emerald-600 flex items-center gap-0.5">
                                    <CheckCircle className="w-2.5 h-2.5" /> Safe
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-700">{b.purchaseQuantity}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${
                                    b.availableQuantity === 0
                                      ? 'bg-rose-100 text-rose-800'
                                      : b.availableQuantity <= 5
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {b.availableQuantity}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600">{b.quickSoldQuantity}</td>
                              <td className="py-2.5 px-3 text-center text-slate-600">{b.pantrySoldQuantity}</td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-700 max-w-[140px] truncate">
                                {b.shopkeeperName}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => onOpenBatchHistory && onOpenBatchHistory(b.batchNumber)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer"
                                >
                                  Batch History
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Inward & Outward Summary Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Latest Purchases */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                        <span>Recent Inward Purchases</span>
                      </h4>
                      <button
                        onClick={() => setActiveTab('purchases')}
                        className="text-[11px] text-indigo-600 font-semibold hover:underline"
                      >
                        View All ({purchases.length})
                      </button>
                    </div>

                    <div className="space-y-2">
                      {purchases.slice(0, 3).map((p) => (
                        <div key={p.id} className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">
                              +{p.quantity} Units Inward (Batch #{p.batchNumber})
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Supplier: <strong>{p.shopkeeperName}</strong> • ₹{p.purchaseRate}/unit
                            </div>
                            <div className="text-[10px] text-emerald-700 font-mono mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{p.purchaseDate || p.createdAt}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-800 text-xs">
                              ₹{(p.quantity * p.purchaseRate).toLocaleString('en-IN')}
                            </span>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">{p.id}</div>
                          </div>
                        </div>
                      ))}
                      {purchases.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-xs">No purchase inward records.</div>
                      )}
                    </div>
                  </div>

                  {/* Latest Customer Orders */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ArrowUpRight className="w-4 h-4 text-rose-600" />
                        <span>Recent Customer Order Deductions</span>
                      </h4>
                      <button
                        onClick={() => setActiveTab('sales')}
                        className="text-[11px] text-indigo-600 font-semibold hover:underline"
                      >
                        View All ({allSales.length})
                      </button>
                    </div>

                    <div className="space-y-2">
                      {allSales.slice(0, 3).map((s) => (
                        <div key={s.orderId} className="p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl text-xs flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1">
                              <span>-{s.quantitySold} Units</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${s.saleSource === 'QUICK' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                                {s.saleSource}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Customer: <strong>{s.customerName}</strong> ({s.customerMobile})
                            </div>
                            <div className="text-[10px] text-rose-700 font-mono mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{s.createdAt}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            {onOpenOrder ? (
                              <button
                                onClick={() => onOpenOrder(s.orderId)}
                                className="text-xs font-bold text-indigo-700 hover:underline flex items-center gap-0.5"
                              >
                                <span>{s.orderId}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-xs font-mono font-bold text-slate-700">{s.orderId}</span>
                            )}
                            <div className="text-[10px] font-bold text-slate-900 mt-0.5">
                              ₹{(s.quantitySold * s.sellingPrice).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      ))}
                      {allSales.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-xs">No sales deductions recorded.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ALL PURCHASES INWARD */}
            {activeTab === 'purchases' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <div className="text-xs text-emerald-900 font-medium">
                    Total Inward for Barcode: <strong>{summary.totalInitialPurchased} units</strong> across {purchases.length} purchase entries. Total CP: <strong>₹{summary.totalPurchaseCost.toLocaleString('en-IN')}</strong>
                  </div>
                  {onOpenPurchaseInward && (
                    <button
                      onClick={() => onOpenPurchaseInward(barcode)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add Purchase Entry</span>
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Purchase Date & Time</th>
                        <th className="py-2.5 px-3">Purchase ID</th>
                        <th className="py-2.5 px-3">Batch Number</th>
                        <th className="py-2.5 px-3">Supplier / Shopkeeper</th>
                        <th className="py-2.5 px-3 text-center">Inward Qty</th>
                        <th className="py-2.5 px-3">Rate (CP)</th>
                        <th className="py-2.5 px-3">Total Amount</th>
                        <th className="py-2.5 px-3">Invoice / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchases.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-400">
                            No purchase entries found for this barcode.
                          </td>
                        </tr>
                      ) : (
                        purchases.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-800">{p.purchaseDate || p.createdAt}</div>
                              <div className="text-[10px] text-slate-400">Inward Timestamp</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{p.id}</td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => onOpenBatchHistory && onOpenBatchHistory(p.batchNumber)}
                                className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono font-bold border border-indigo-200 text-xs transition cursor-pointer"
                              >
                                #{p.batchNumber}
                              </button>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{p.shopkeeperName}</div>
                              {p.shopkeeperContact && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>{p.shopkeeperContact}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-700">+{p.quantity}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">₹{p.purchaseRate}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              ₹{(p.quantity * p.purchaseRate).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-[160px] truncate">
                              {p.invoiceReference ? `Inv: ${p.invoiceReference}` : p.notes || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: ALL SALES (QUICK & PANTRY) */}
            {activeTab === 'sales' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500">Total Units Sold Down:</span>
                    <div className="font-bold text-slate-900 text-sm">{summary.totalDownStock} Units</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Quick Commerce Orders:</span>
                    <div className="font-bold text-amber-700 text-sm">{summary.totalQuickSold} Units ({quickOrders.length} orders)</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Pantry Card Deductions:</span>
                    <div className="font-bold text-purple-700 text-sm">{summary.totalPantrySold} Units ({pantryOrders.length} orders)</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Order Date & Time</th>
                        <th className="py-2.5 px-3">Order ID & Type</th>
                        <th className="py-2.5 px-3">Customer Details</th>
                        <th className="py-2.5 px-3 text-center">Qty Sold</th>
                        <th className="py-2.5 px-3">Rate</th>
                        <th className="py-2.5 px-3">Total Amount</th>
                        <th className="py-2.5 px-3">Delivery Partner</th>
                        <th className="py-2.5 px-3">Order Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allSales.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-400">
                            No customer order debits recorded for this barcode yet.
                          </td>
                        </tr>
                      ) : (
                        allSales.map((s) => (
                          <tr key={`${s.saleSource}-${s.orderId}`} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-800">{s.createdAt}</div>
                              {s.deliveredAt && (
                                <div className="text-[10px] text-emerald-600">Delivered: {s.deliveredAt}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {onOpenOrder ? (
                                <button
                                  onClick={() => onOpenOrder(s.orderId)}
                                  className="font-mono font-bold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{s.orderId}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              ) : (
                                <div className="font-mono font-bold text-slate-800">{s.orderId}</div>
                              )}
                              <span
                                className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold mt-0.5 ${
                                  s.saleSource === 'QUICK'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {s.saleSource === 'QUICK' ? 'Quick 15-Min Delivery' : 'Pantry Card Debit'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{s.customerName}</div>
                              <div className="text-[10px] text-slate-500">{s.customerMobile}</div>
                              <div className="text-[10px] text-slate-400 line-clamp-1 max-w-[140px]">{s.deliveryAddress}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-rose-700">-{s.quantitySold}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">₹{s.sellingPrice}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              ₹{(s.quantitySold * s.sellingPrice).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-700">
                              {s.assignedDeliveryBoyName ? (
                                <div className="flex items-center gap-1">
                                  <Truck className="w-3 h-3 text-indigo-500" />
                                  <span>{s.assignedDeliveryBoyName}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">Unassigned</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                {s.orderStatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: BATCH LEVEL STOCK BREAKDOWN */}
            {activeTab === 'batches' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {batches.map((b) => (
                    <div
                      key={b.batchId}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-300 transition space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Boxes className="w-4 h-4 text-indigo-600" />
                          <span className="font-mono font-bold text-indigo-800 text-sm">#{b.batchNumber}</span>
                        </div>
                        {b.isExpired ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                            Expired
                          </span>
                        ) : b.isNearExpiry ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            {b.daysToExpiry}d left
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Safe
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-400 block">Available In-Stock</span>
                          <span className="text-base font-black text-emerald-700">{b.availableQuantity} units</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-400 block">Initial Purchased</span>
                          <span className="text-base font-bold text-slate-800">{b.purchaseQuantity} units</span>
                        </div>
                      </div>

                      <div className="text-[11px] space-y-1 text-slate-600">
                        <div>MFG: <strong>{b.manufacturingDate}</strong> • EXP: <strong>{b.expiryDate}</strong></div>
                        <div>Inward Supplier: <strong>{b.shopkeeperName}</strong></div>
                        <div>Cost Price: <strong>₹{b.purchaseRate}</strong> • Selling Price: <strong>₹{b.sellingPrice}</strong></div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono">ID: {b.batchId}</span>
                        <button
                          onClick={() => onOpenBatchHistory && onOpenBatchHistory(b.batchNumber)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>Full Batch Ledger</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: CHRONOLOGICAL UNIFIED LEDGER */}
            {activeTab === 'ledger' && (
              <div className="space-y-3">
                {/* Ledger Filter Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setLedgerFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        ledgerFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      All Events ({ledgerTimeline.length})
                    </button>
                    <button
                      onClick={() => setLedgerFilter('PURCHASE')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        ledgerFilter === 'PURCHASE' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      + Inward Purchases ({purchases.length})
                    </button>
                    <button
                      onClick={() => setLedgerFilter('SALE')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        ledgerFilter === 'SALE' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      - Customer Sales ({allSales.length})
                    </button>
                    <button
                      onClick={() => setLedgerFilter('RETURN')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        ledgerFilter === 'RETURN' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      + Returns ({returns.length})
                    </button>
                    <button
                      onClick={() => setLedgerFilter('ADJUST')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        ledgerFilter === 'ADJUST' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Audit Adjustments
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search ledger..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                    />
                  </div>
                </div>

                {/* Ledger Timeline List */}
                <div className="space-y-2">
                  {filteredLedger.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">
                      No matching events found in chronological audit trail.
                    </div>
                  ) : (
                    filteredLedger.map((entry) => {
                      const isPositive = entry.quantityChange > 0;
                      const isNegative = entry.quantityChange < 0;

                      return (
                        <div
                          key={entry.id}
                          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          {/* Left: Event & Details */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  entry.badgeVariant === 'green'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : entry.badgeVariant === 'red'
                                    ? 'bg-rose-100 text-rose-800'
                                    : entry.badgeVariant === 'purple'
                                    ? 'bg-purple-100 text-purple-800'
                                    : entry.badgeVariant === 'blue'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {entry.type.replace(/_/g, ' ')}
                              </span>

                              <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{entry.timestamp}</span>
                              </div>
                            </div>

                            <div className="font-bold text-slate-900 text-xs">
                              {entry.title}
                            </div>

                            <div className="text-[11px] text-slate-500">
                              {entry.partyName && <span>Party: <strong>{entry.partyName}</strong> • </span>}
                              <span>Operator: <strong>{entry.operator}</strong> ({entry.operatorRole})</span>
                            </div>

                            {entry.notes && (
                              <div className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                                {entry.notes}
                              </div>
                            )}
                          </div>

                          {/* Right: Quantity Change & Reference */}
                          <div className="sm:text-right shrink-0">
                            <div
                              className={`text-base font-black ${
                                isPositive
                                  ? 'text-emerald-600'
                                  : isNegative
                                  ? 'text-rose-600'
                                  : 'text-slate-600'
                              }`}
                            >
                              {isPositive ? `+${entry.quantityChange}` : entry.quantityChange} units
                            </div>

                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              Ref: {entry.referenceId}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showPantryCustomerModal && (
        <CustomerPantryHoldingsModal
          isOpen={showPantryCustomerModal}
          onClose={() => setShowPantryCustomerModal(false)}
          barcode={barcode}
          productName={data?.product?.name}
          onOpenOrder={onOpenOrder}
        />
      )}
    </AppWindowModal>
  );
};
