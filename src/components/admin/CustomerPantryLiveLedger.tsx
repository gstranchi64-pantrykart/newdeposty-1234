import React, { useState, useEffect, useMemo } from 'react';
import { CustomerPantryHolding, CustomerPantryHoldingsResponse } from '../../types';
import { api } from '../../services/api';
import { getDeliveryDayCount, parseOrderDate } from '../../utils/dateTimeUtils';
import {
  Users,
  Search,
  Phone,
  MapPin,
  Calendar,
  Package,
  Barcode,
  Boxes,
  ShieldCheck,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  ShoppingBag,
  Filter,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface NearestDeliverySummary {
  customerName: string;
  deliveryDate: string;
  daysCount: number;
  badgeLabel: string;
}

interface CustomerPantryLiveLedgerProps {
  onOpenOrder?: (orderId: string) => void;
  onOpenBatchHistory?: (batchNumber: string) => void;
  onOpenBarcodeHistory?: (barcode: string) => void;
  onOpenCustomerProfile?: (customerId: string) => void;
}

export const CustomerPantryLiveLedger: React.FC<CustomerPantryLiveLedgerProps> = ({
  onOpenOrder,
  onOpenBatchHistory,
  onOpenBarcodeHistory,
  onOpenCustomerProfile,
}) => {
  const [data, setData] = useState<CustomerPantryHoldingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View Mode: Barcode Grouped (Nearest Delivery Days) vs Customer-Wise Detailed
  const [viewMode, setViewMode] = useState<'BARCODE_GROUPED' | 'CUSTOMER_WISE'>('BARCODE_GROUPED');
  const [expandedBarcodes, setExpandedBarcodes] = useState<Record<string, boolean>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [daysFilter, setDaysFilter] = useState<'ALL' | '5_PLUS' | '10_PLUS' | '15_PLUS' | '30_PLUS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK_ONLY' | 'VERIFIED' | 'PENDING_AUDIT'>('IN_STOCK_ONLY');
  const [sortBy, setSortBy] = useState<'DELIVERY_DESC' | 'DAYS_DESC' | 'QTY_DESC' | 'CUSTOMER_ASC' | 'VALUE_DESC'>('DELIVERY_DESC');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchHoldings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPantryHoldings();
      setData(res);
    } catch (err: any) {
      console.error('Failed to fetch pantry holdings:', err);
      setError(err.message || 'Unable to load live customer pantry stock.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, []);

  const handleCopyMobile = (mobile: string, id: string) => {
    navigator.clipboard?.writeText(mobile);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleBarcodeExpand = (barcodeKey: string) => {
    setExpandedBarcodes((prev) => ({
      ...prev,
      [barcodeKey]: !prev[barcodeKey],
    }));
  };

  const filteredAndSortedItems = useMemo(() => {
    if (!data?.items) return [];

    let result = [...data.items];

    // Status filter
    if (statusFilter === 'IN_STOCK_ONLY') {
      result = result.filter((it) => it.currentPantryQuantity > 0);
    } else if (statusFilter === 'VERIFIED') {
      result = result.filter((it) => it.auditorVerificationStatus === 'AVAILABLE');
    } else if (statusFilter === 'PENDING_AUDIT') {
      result = result.filter((it) => !it.auditorVerificationStatus || it.auditorVerificationStatus === 'PENDING_AUDIT');
    }

    // Days Since Delivery filter
    if (daysFilter !== 'ALL') {
      result = result.filter((it) => {
        const dayInfo = getDeliveryDayCount(it.deliveryDate);
        const daysCount = it.daysSinceDelivery ?? dayInfo.dayNumber;
        if (daysFilter === '5_PLUS') return daysCount >= 5;
        if (daysFilter === '10_PLUS') return daysCount >= 10;
        if (daysFilter === '15_PLUS') return daysCount >= 15;
        if (daysFilter === '30_PLUS') return daysCount >= 30;
        return true;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          it.customerName.toLowerCase().includes(q) ||
          it.customerMobile.toLowerCase().includes(q) ||
          it.customerAddress.toLowerCase().includes(q) ||
          it.productName.toLowerCase().includes(q) ||
          (it.barcode && it.barcode.toLowerCase().includes(q)) ||
          (it.batchNumber && it.batchNumber.toLowerCase().includes(q)) ||
          (it.orderId && it.orderId.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'QTY_DESC') {
        return b.currentPantryQuantity - a.currentPantryQuantity;
      }
      if (sortBy === 'CUSTOMER_ASC') {
        return a.customerName.localeCompare(b.customerName);
      }
      if (sortBy === 'VALUE_DESC') {
        return b.totalValue - a.totalValue;
      }
      if (sortBy === 'DAYS_DESC') {
        const dayA = a.daysSinceDelivery ?? getDeliveryDayCount(a.deliveryDate).dayNumber;
        const dayB = b.daysSinceDelivery ?? getDeliveryDayCount(b.deliveryDate).dayNumber;
        return dayB - dayA;
      }
      // Default: DELIVERY_DESC (nearest delivery date first)
      const tA = parseOrderDate(a.deliveryDate)?.getTime() || 0;
      const tB = parseOrderDate(b.deliveryDate)?.getTime() || 0;
      return tB - tA;
    });

    return result;
  }, [data, statusFilter, daysFilter, searchQuery, sortBy]);

  // Group by Barcode & Product (calculating nearest delivery date & days count)
  const barcodeGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        barcode: string;
        productId: string;
        productName: string;
        brand: string;
        image: string;
        totalCurrentPantryQty: number;
        totalDeliveredQty: number;
        totalValue: number;
        uniqueCustomers: Set<string>;
        items: CustomerPantryHolding[];
        // Nearest delivery tracking across all customers who hold this barcode
        nearestCustomerName: string;
        nearestCustomerMobile: string;
        nearestDeliveryDate: string;
        nearestDaysCount: number;
        nearestDaysBadge: string;
      }
    >();

    filteredAndSortedItems.forEach((item) => {
      const key = item.barcode || item.productId || 'UNKNOWN';
      const dayInfo = getDeliveryDayCount(item.deliveryDate);
      const daysCount = item.daysSinceDelivery ?? dayInfo.dayNumber;

      if (!map.has(key)) {
        map.set(key, {
          key,
          barcode: item.barcode || '',
          productId: item.productId,
          productName: item.productName,
          brand: item.brand || '',
          image: item.image || '',
          totalCurrentPantryQty: 0,
          totalDeliveredQty: 0,
          totalValue: 0,
          uniqueCustomers: new Set(),
          items: [],
          nearestCustomerName: item.customerName,
          nearestCustomerMobile: item.customerMobile,
          nearestDeliveryDate: item.deliveryDate || '',
          nearestDaysCount: daysCount,
          nearestDaysBadge: dayInfo.badgeLabel,
        });
      }

      const g = map.get(key)!;
      g.totalCurrentPantryQty += item.currentPantryQuantity || 0;
      g.totalDeliveredQty += item.orderedQuantity || 0;
      g.totalValue += item.totalValue || 0;
      if (item.customerId) g.uniqueCustomers.add(item.customerId);
      g.items.push(item);

      // Check if this customer delivery is nearer / more recent than current recorded nearest
      const thisTime = parseOrderDate(item.deliveryDate)?.getTime() || 0;
      const nearestTime = parseOrderDate(g.nearestDeliveryDate)?.getTime() || 0;
      if (thisTime > nearestTime || (thisTime === nearestTime && daysCount < g.nearestDaysCount)) {
        g.nearestCustomerName = item.customerName;
        g.nearestCustomerMobile = item.customerMobile;
        g.nearestDeliveryDate = item.deliveryDate || '';
        g.nearestDaysCount = daysCount;
        g.nearestDaysBadge = dayInfo.badgeLabel;
      }
    });

    const list = Array.from(map.values());

    // Sort barcode groups: items with active pantry quantity first, then nearest delivery date
    list.sort((a, b) => {
      if ((b.totalCurrentPantryQty > 0) !== (a.totalCurrentPantryQty > 0)) {
        return b.totalCurrentPantryQty > 0 ? 1 : -1;
      }
      const tA = parseOrderDate(a.nearestDeliveryDate)?.getTime() || 0;
      const tB = parseOrderDate(b.nearestDeliveryDate)?.getTime() || 0;
      return tB - tA;
    });

    return list;
  }, [filteredAndSortedItems]);

  // Aggregate stats from filtered items
  const stats = useMemo<{
    totalItems: number;
    totalPantryQty: number;
    totalDeliveredQty: number;
    totalVal: number;
    uniqueCusts: number;
    nearestCustDelivery: NearestDeliverySummary | null;
  }>(() => {
    const totalItems = filteredAndSortedItems.length;
    const totalPantryQty = filteredAndSortedItems.reduce((acc, it) => acc + (it.currentPantryQuantity || 0), 0);
    const totalDeliveredQty = filteredAndSortedItems.reduce((acc, it) => acc + (it.orderedQuantity || 0), 0);
    const totalVal = filteredAndSortedItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
    const uniqueCusts = new Set(filteredAndSortedItems.map((it) => it.customerId)).size;

    // Overall nearest delivery across all customers
    let nearestCustDelivery: {
      customerName: string;
      deliveryDate: string;
      daysCount: number;
      badgeLabel: string;
    } | null = null;

    if (filteredAndSortedItems.length > 0) {
      let maxTime = -1;
      filteredAndSortedItems.forEach((it) => {
        const t = parseOrderDate(it.deliveryDate)?.getTime() || 0;
        if (t > maxTime) {
          maxTime = t;
          const dayInfo = getDeliveryDayCount(it.deliveryDate);
          nearestCustDelivery = {
            customerName: it.customerName,
            deliveryDate: it.deliveryDate || '',
            daysCount: it.daysSinceDelivery ?? dayInfo.dayNumber,
            badgeLabel: dayInfo.badgeLabel,
          };
        }
      });
    }

    return {
      totalItems,
      totalPantryQty,
      totalDeliveredQty,
      totalVal,
      uniqueCusts,
      nearestCustDelivery,
    };
  }, [filteredAndSortedItems]);

  return (
    <div className="space-y-4">
      {/* Top Banner / Summary */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-sm border border-purple-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[11px] font-bold tracking-wide uppercase flex items-center gap-1">
                <Users className="w-3 h-3 text-purple-300" />
                Customer Pantry Live Inventory
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-semibold">
                ● Live Shelf Custody &amp; Days Counter
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
              <span>Customer Pantry Stock Live Ledger</span>
            </h2>
            <p className="text-xs text-purple-200/80 mt-1 max-w-2xl">
              Track live customer pantry stock, nearest customer delivery days count, and click any barcode to inspect full customer distribution and delivery dates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHoldings}
              disabled={loading}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>

        {/* Quick Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-purple-800/40">
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-purple-200 font-medium uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-300" />
              <span>In-Pantry Active Stock</span>
            </div>
            <div className="text-2xl font-black text-white mt-1 flex items-baseline gap-1">
              <span>{stats.totalPantryQty}</span>
              <span className="text-xs font-normal text-purple-200">Units</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-purple-200 font-medium uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3 text-amber-300" />
              <span>Customer Households</span>
            </div>
            <div className="text-2xl font-black text-amber-300 mt-1 flex items-baseline gap-1">
              <span>{stats.uniqueCusts}</span>
              <span className="text-xs font-normal text-purple-200">Homes</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-purple-200 font-medium uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3 h-3 text-emerald-300" />
              <span>Total Delivered Stock</span>
            </div>
            <div className="text-2xl font-black text-emerald-300 mt-1 flex items-baseline gap-1">
              <span>{stats.totalDeliveredQty}</span>
              <span className="text-xs font-normal text-purple-200">Units</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-purple-200 font-medium uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-sky-300" />
              <span>Holding Valuation</span>
            </div>
            <div className="text-2xl font-black text-white mt-1">
              ₹{stats.totalVal.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Nearest Customer Delivery KPI Card */}
          <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 backdrop-blur-xs p-3 rounded-xl border border-emerald-400/30">
            <div className="text-[10px] text-emerald-200 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-300" />
              <span>Nearest Delivery</span>
            </div>
            {stats.nearestCustDelivery ? (
              <div className="mt-1">
                <div className="text-sm font-black text-emerald-300 truncate" title={stats.nearestCustDelivery.customerName}>
                  {stats.nearestCustDelivery.customerName}
                </div>
                <div className="text-[10px] text-emerald-200/90 flex items-center gap-1 mt-0.5">
                  <span>{stats.nearestCustDelivery.deliveryDate}</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-400/20 font-bold text-white text-[9px]">
                    Day {stats.nearestCustDelivery.daysCount}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-emerald-200/70 mt-1 font-medium">No deliveries yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Days Filter, & View Mode Toggle */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* View Mode Toggle Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('BARCODE_GROUPED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'BARCODE_GROUPED'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>By Barcode &amp; Product ({barcodeGroups.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CUSTOMER_WISE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'CUSTOMER_WISE'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customer-Wise Detail ({filteredAndSortedItems.length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Customer, Mobile, Product, Barcode, Batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* Filter Status */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white font-medium text-slate-700"
              >
                <option value="IN_STOCK_ONLY">📦 Currently In Customer Pantry (&gt; 0 Units)</option>
                <option value="ALL">📋 All Items (Including Consumed &amp; Returned)</option>
                <option value="VERIFIED">🛡️ Verified by Field Auditor</option>
                <option value="PENDING_AUDIT">⏳ Pending Auditor Verification</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white font-medium text-slate-700"
              >
                <option value="DELIVERY_DESC">🕒 Nearest Delivery Date First</option>
                <option value="DAYS_DESC">⏳ Longest Days Since Delivery First</option>
                <option value="QTY_DESC">🔢 Highest In-Pantry Quantity</option>
                <option value="VALUE_DESC">💰 Highest Holding Value (₹)</option>
                <option value="CUSTOMER_ASC">👤 Customer Name (A to Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Days Since Delivery Filter Bar */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mr-1">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            <span>Days Since Delivery:</span>
          </span>

          <button
            type="button"
            onClick={() => setDaysFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              daysFilter === 'ALL'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Days
          </button>

          <button
            type="button"
            onClick={() => setDaysFilter('5_PLUS')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              daysFilter === '5_PLUS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>5+ Days</span>
            <span className="text-[10px] opacity-75">(≥ 5d)</span>
          </button>

          <button
            type="button"
            onClick={() => setDaysFilter('10_PLUS')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              daysFilter === '10_PLUS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>10+ Days</span>
            <span className="text-[10px] opacity-75">(≥ 10d)</span>
          </button>

          <button
            type="button"
            onClick={() => setDaysFilter('15_PLUS')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              daysFilter === '15_PLUS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>15+ Days</span>
            <span className="text-[10px] opacity-75">(≥ 15d)</span>
          </button>

          <button
            type="button"
            onClick={() => setDaysFilter('30_PLUS')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              daysFilter === '30_PLUS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>30+ Days</span>
            <span className="text-[10px] opacity-75">(≥ 30d)</span>
          </button>

          {daysFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setDaysFilter('ALL')}
              className="text-[11px] text-purple-600 font-bold hover:underline ml-2 cursor-pointer"
            >
              Reset Filter
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-medium">
            Showing <strong className="text-purple-700">{viewMode === 'BARCODE_GROUPED' ? barcodeGroups.length : filteredAndSortedItems.length}</strong> records
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && !data ? (
          <div className="py-20 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-2" />
            <p className="text-sm font-semibold">Loading live customer pantry distribution ledger...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No Customer Pantry Stock Found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search query, status filter, or days filter.
            </p>
          </div>
        ) : viewMode === 'BARCODE_GROUPED' ? (
          /* MODE 1: BARCODE GROUPED VIEW (NEAREST DELIVERY DAYS SHOWN) */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Product &amp; Barcode (Click Barcode for All Customers)</th>
                  <th className="py-3 px-3 text-center">Active In-Pantry Qty</th>
                  <th className="py-3 px-3 text-center">Households Holding</th>
                  <th className="py-3 px-3">Delivery &amp; Days Elapsed (Nearest Customer)</th>
                  <th className="py-3 px-3 text-right">Holding Value</th>
                  <th className="py-3 px-4 text-right">Inspect Barcode &amp; Customers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {barcodeGroups.map((group) => {
                  const isExpanded = !!expandedBarcodes[group.key];
                  const exactDays = group.nearestDaysCount;

                  return (
                    <React.Fragment key={group.key}>
                      <tr className="hover:bg-purple-50/40 transition-colors">
                        {/* Product & Barcode Button */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            {group.image && (
                              <img
                                src={group.image}
                                alt={group.productName}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 mt-0.5"
                              />
                            )}
                            <div>
                              <div className="font-bold text-slate-900 text-xs line-clamp-1 max-w-[260px]" title={group.productName}>
                                {group.productName}
                              </div>
                              {group.brand && (
                                <div className="text-[10px] text-slate-400 font-medium">{group.brand}</div>
                              )}
                              {/* Clickable Barcode Button */}
                              {group.barcode ? (
                                <button
                                  onClick={() => onOpenBarcodeHistory && onOpenBarcodeHistory(group.barcode)}
                                  className="font-mono text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 mt-1 inline-flex items-center gap-1.5 transition cursor-pointer font-bold shadow-2xs hover:shadow-xs"
                                  title="Click Barcode to open Barcode Product Management & view all customer delivery dates and days count"
                                >
                                  <Barcode className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>{group.barcode}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No barcode</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* In-Pantry Qty */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                              group.totalCurrentPantryQty > 0
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {group.totalCurrentPantryQty} unit{group.totalCurrentPantryQty > 1 ? 's' : ''}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Delivered: {group.totalDeliveredQty}
                          </div>
                        </td>

                        {/* Unique Customers / Households */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 font-bold border border-amber-200 text-xs">
                            <Users className="w-3 h-3 text-amber-600" />
                            <span>{group.uniqueCustomers.size} Household{group.uniqueCustomers.size > 1 ? 's' : ''}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {group.items.length} delivery record{group.items.length > 1 ? 's' : ''}
                          </div>
                        </td>

                        {/* Delivery & Days Elapsed (Nearest Customer) */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="text-slate-800 text-xs font-semibold flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Nearest: {group.nearestDeliveryDate || 'N/A'}</span>
                          </div>
                          {group.nearestDeliveryDate && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 shadow-2xs ${
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
                                <span>{exactDays} Days Since Delivery ({group.nearestDaysBadge})</span>
                              </span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[180px]">
                            Customer: <strong className="text-slate-700">{group.nearestCustomerName}</strong>
                          </div>
                        </td>

                        {/* Valuation */}
                        <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono">
                          <div className="font-bold text-slate-900 text-xs">
                            ₹{group.totalValue.toLocaleString('en-IN')}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {/* Barcode History / Product Management Button */}
                            {group.barcode && (
                              <button
                                onClick={() => onOpenBarcodeHistory && onOpenBarcodeHistory(group.barcode)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                title="Open Barcode Product Management to view all customers & days in stock"
                              >
                                <Barcode className="w-3.5 h-3.5" />
                                <span>All Customers ({group.uniqueCustomers.size})</span>
                              </button>
                            )}

                            {/* Accordion toggle to expand customers inline */}
                            <button
                              onClick={() => toggleBarcodeExpand(group.key)}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer border border-slate-200"
                              title={isExpanded ? 'Collapse customer list' : 'Expand customer list'}
                            >
                              <span>{isExpanded ? 'Hide' : 'View'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Accordion: View All Customers Holding This Barcode */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-y border-slate-200">
                          <td colSpan={6} className="p-3 pl-8">
                            <div className="bg-white rounded-xl border border-purple-200 p-3 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-purple-600" />
                                  <span>All Customers Holding Barcode #{group.barcode || group.key} ({group.items.length} Records)</span>
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  Every customer's delivery date &amp; exact days elapsed:
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                                {group.items.map((item, cIdx) => {
                                  const cDayInfo = getDeliveryDayCount(item.deliveryDate);
                                  const cExactDays = item.daysSinceDelivery ?? cDayInfo.dayNumber;
                                  const cIsCopied = copiedId === (item.pantryCardItemId || `${item.orderId}-${cIdx}`);

                                  return (
                                    <div
                                      key={item.pantryCardItemId || `${item.orderId}-${cIdx}`}
                                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-purple-50/30 transition space-y-1.5"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="font-bold text-slate-900 text-xs truncate">
                                          {item.customerName}
                                        </div>
                                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                          {item.customerId}
                                        </span>
                                      </div>

                                      {/* Mobile & Call */}
                                      <div className="flex items-center gap-1.5">
                                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono text-[10px]">
                                          <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                          <a href={`tel:${item.customerMobile}`} className="hover:underline">
                                            {item.customerMobile}
                                          </a>
                                          <button
                                            onClick={() => handleCopyMobile(item.customerMobile, item.pantryCardItemId || `${item.orderId}-${cIdx}`)}
                                            className="ml-0.5 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                                            title="Copy mobile number"
                                          >
                                            {cIsCopied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2 h-2" />}
                                          </button>
                                        </div>
                                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                          {item.currentPantryQuantity} unit{item.currentPantryQuantity > 1 ? 's' : ''} in-stock
                                        </span>
                                      </div>

                                      {/* Address preview */}
                                      <div className="text-[10px] text-slate-500 flex items-start gap-1 line-clamp-1" title={item.customerAddress}>
                                        <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0 mt-0.5" />
                                        <span className="truncate">{item.customerAddress}</span>
                                      </div>

                                      {/* Customer Specific Delivery Date & Days Elapsed */}
                                      <div className="pt-1 border-t border-slate-200 flex items-center justify-between gap-1 flex-wrap">
                                        <div className="text-[10px] text-slate-600 flex items-center gap-1">
                                          <Calendar className="w-3 h-3 text-slate-400" />
                                          <span>Delivered: {item.deliveryDate || 'N/A'}</span>
                                        </div>
                                        <span
                                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                                            cExactDays <= 7
                                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                              : cExactDays <= 14
                                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                                              : cExactDays <= 21
                                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                                              : 'bg-rose-100 text-rose-800 border-rose-300'
                                          }`}
                                        >
                                          <Clock className="w-2 h-2" />
                                          <span>{cExactDays} Days ({cDayInfo.badgeLabel})</span>
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* MODE 2: CUSTOMER-WISE DETAILED VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-3">Product &amp; Barcode (Click Barcode for All Customers)</th>
                  <th className="py-3 px-3">Batch</th>
                  <th className="py-3 px-3 text-center">In-Pantry Qty</th>
                  <th className="py-3 px-3 text-right">Holding Value</th>
                  <th className="py-3 px-3">Delivery &amp; Days Elapsed</th>
                  <th className="py-3 px-3">Auditor Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAndSortedItems.map((item, idx) => {
                  const isCopied = copiedId === (item.pantryCardItemId || `${item.orderId}-${idx}`);
                  const dayInfo = getDeliveryDayCount(item.deliveryDate);
                  const exactDays = item.daysSinceDelivery ?? dayInfo.dayNumber;

                  return (
                    <tr
                      key={item.pantryCardItemId || `${item.orderId}-${idx}`}
                      className="hover:bg-purple-50/40 transition-colors"
                    >
                      {/* Customer Details: Name, Mobile, Address */}
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-200 mt-0.5">
                            {item.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                              <span>{item.customerName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({item.customerId})</span>
                            </div>

                            {/* Customer Mobile Number */}
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono text-[11px]">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <a href={`tel:${item.customerMobile}`} className="hover:underline">
                                  {item.customerMobile}
                                </a>
                                <button
                                  onClick={() => handleCopyMobile(item.customerMobile, item.pantryCardItemId || `${item.orderId}-${idx}`)}
                                  className="ml-0.5 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                                  title="Copy mobile number"
                                >
                                  {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                                </button>
                              </div>
                            </div>

                            {/* Address preview */}
                            <div className="text-[11px] text-slate-500 mt-1 flex items-start gap-1 max-w-xs line-clamp-1" title={item.customerAddress}>
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <span className="truncate">{item.customerAddress}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Product Name & Barcode */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.productName}
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <div>
                            <div className="font-bold text-slate-900 text-xs line-clamp-1 max-w-[200px]" title={item.productName}>
                              {item.productName}
                            </div>
                            {item.barcode && (
                              <button
                                onClick={() => onOpenBarcodeHistory && onOpenBarcodeHistory(item.barcode)}
                                className="font-mono text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 mt-0.5 inline-flex items-center gap-1 transition cursor-pointer font-bold"
                                title="Click to view full barcode product management & all customers holding this item"
                              >
                                <Barcode className="w-2.5 h-2.5 text-indigo-600" />
                                <span>{item.barcode}</span>
                                <ExternalLink className="w-2 h-2 text-indigo-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Batch Number */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.batchNumber ? (
                          <button
                            onClick={() => onOpenBatchHistory && onOpenBatchHistory(item.batchNumber)}
                            className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-300 inline-flex items-center gap-1 transition cursor-pointer"
                            title="Click to view full batch history & inward/sales timeline"
                          >
                            <Boxes className="w-3 h-3 text-emerald-600" />
                            <span>#{item.batchNumber}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">N/A</span>
                        )}
                        {item.expiryDate && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            EXP: {item.expiryDate}
                          </div>
                        )}
                      </td>

                      {/* In-Pantry Qty */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
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

                      {/* Value */}
                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono">
                        <div className="font-bold text-slate-900 text-xs">
                          ₹{item.totalValue}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          @ ₹{item.unitPrice}/u
                        </div>
                      </td>

                      {/* Delivery Date & Days Elapsed */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-slate-800 text-xs font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{item.deliveryDate || 'N/A'}</span>
                        </div>
                        {item.deliveryDate && (
                          <div className="mt-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
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
                              <span>{exactDays} Days Since Delivery</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Auditor Verification Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.auditorVerificationStatus === 'AVAILABLE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        ) : item.auditorVerificationStatus === 'DAMAGED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Damaged</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px]">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {onOpenCustomerProfile && (
                            <button
                              onClick={() => onOpenCustomerProfile(item.customerId)}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                              title="View Customer 360 Profile"
                            >
                              <Users className="w-3 h-3" />
                              <span>Profile</span>
                            </button>
                          )}

                          {item.orderId && (
                            <button
                              onClick={() => onOpenOrder && onOpenOrder(item.orderId)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer font-mono"
                              title="View Original Order"
                            >
                              <span>#{item.orderId}</span>
                              <ExternalLink className="w-3 h-3" />
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

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            Displaying <strong>{viewMode === 'BARCODE_GROUPED' ? barcodeGroups.length : filteredAndSortedItems.length}</strong> {viewMode === 'BARCODE_GROUPED' ? 'product barcodes' : 'active customer allocations'}.
          </span>
          <span className="text-[11px] text-slate-400">
            Click any Barcode to open Barcode Product Management and view all customer delivery dates &amp; days in stock.
          </span>
        </div>
      </div>
    </div>
  );
};
