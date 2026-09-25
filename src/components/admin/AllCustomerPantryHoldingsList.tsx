import React, { useState, useEffect, useMemo } from 'react';
import { CustomerPantryHolding, CustomerPantryHoldingsResponse } from '../../types';
import { api } from '../../services/api';
import { getDeliveryDayCount, parseOrderDate } from '../../utils/dateTimeUtils';
import { ImageWithFallback } from '../common/ImageWithFallback';
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
  Filter,
  Layers,
  ArrowUpDown,
  Download,
  IndianRupee,
  CheckCircle,
  XCircle,
  Tag,
  Store,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface AllCustomerPantryHoldingsListProps {
  onOpenOrder?: (orderId: string) => void;
  onOpenBatchHistory?: (batchNumber: string) => void;
  onOpenBarcodeHistory?: (barcode: string) => void;
  onOpenCustomerProfile?: (customerId: string) => void;
}

export const AllCustomerPantryHoldingsList: React.FC<AllCustomerPantryHoldingsListProps> = ({
  onOpenOrder,
  onOpenBatchHistory,
  onOpenBarcodeHistory,
  onOpenCustomerProfile,
}) => {
  const [data, setData] = useState<CustomerPantryHoldingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'EXPIRED' | 'NEAR_EXPIRY' | 'SAFE' | 'WITH_MFG_EXP'>('ALL');
  const [daysFilter, setDaysFilter] = useState<'ALL' | 'LE_7' | '8_15' | '16_30' | '30_PLUS'>('ALL');
  const [inStockOnly, setInStockOnly] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<
    'DELIVERY_DESC' | 'DELIVERY_ASC' | 'DAYS_DESC' | 'DAYS_ASC' | 'QTY_DESC' | 'EXPIRY_ASC' | 'MRP_DESC'
  >('DELIVERY_DESC');

  // Copy mobile helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchHoldings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPantryHoldings();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load customer pantry holdings:', err);
      setError(err.message || 'Failed to load customer pantry holdings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, []);

  const rawItems = data?.items || [];

  // Extract unique customers for customer dropdown filter
  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>();
    rawItems.forEach((it) => {
      if (it.customerId && it.customerName) {
        map.set(it.customerId, it.customerName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rawItems]);

  // Filtered and Sorted Items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rawItems
      .filter((item) => {
        // Stock only filter
        if (inStockOnly && item.currentPantryQuantity <= 0) return false;

        // Customer filter
        if (selectedCustomerId !== 'ALL' && item.customerId !== selectedCustomerId) return false;

        // Search across customer, product, barcode, batch, order
        if (q) {
          const matchCustName = item.customerName?.toLowerCase().includes(q);
          const matchMobile = item.customerMobile?.toLowerCase().includes(q);
          const matchAddr = item.customerAddress?.toLowerCase().includes(q);
          const matchProd = item.productName?.toLowerCase().includes(q);
          const matchBarcode = item.barcode?.toLowerCase().includes(q);
          const matchBatch = item.batchNumber?.toLowerCase().includes(q);
          const matchOrderId = item.orderId?.toLowerCase().includes(q);
          if (!matchCustName && !matchMobile && !matchAddr && !matchProd && !matchBarcode && !matchBatch && !matchOrderId) {
            return false;
          }
        }

        // Delivery Days elapsed filter
        const dayInfo = getDeliveryDayCount(item.deliveryDate);
        const days = item.daysSinceDelivery ?? dayInfo.dayNumber;

        if (daysFilter === 'LE_7' && days > 7) return false;
        if (daysFilter === '8_15' && (days < 8 || days > 15)) return false;
        if (daysFilter === '16_30' && (days < 16 || days > 30)) return false;
        if (daysFilter === '30_PLUS' && days < 30) return false;

        // Expiry filter
        if (expiryFilter === 'EXPIRED' && !item.isExpired) return false;
        if (expiryFilter === 'NEAR_EXPIRY' && !item.isNearExpiry) return false;
        if (expiryFilter === 'SAFE' && (item.isExpired || item.isNearExpiry)) return false;
        if (expiryFilter === 'WITH_MFG_EXP' && (!item.manufacturingDate || !item.expiryDate)) return false;

        return true;
      })
      .sort((a, b) => {
        const timeA = a.deliveryDate ? parseOrderDate(a.deliveryDate)?.getTime() || 0 : 0;
        const timeB = b.deliveryDate ? parseOrderDate(b.deliveryDate)?.getTime() || 0 : 0;

        const dayInfoA = getDeliveryDayCount(a.deliveryDate);
        const dayInfoB = getDeliveryDayCount(b.deliveryDate);
        const daysA = a.daysSinceDelivery ?? dayInfoA.dayNumber;
        const daysB = b.daysSinceDelivery ?? dayInfoB.dayNumber;

        if (sortBy === 'DELIVERY_DESC') return timeB - timeA;
        if (sortBy === 'DELIVERY_ASC') return timeA - timeB;
        if (sortBy === 'DAYS_DESC') return daysB - daysA;
        if (sortBy === 'DAYS_ASC') return daysA - daysB;
        if (sortBy === 'QTY_DESC') return (b.currentPantryQuantity || 0) - (a.currentPantryQuantity || 0);
        if (sortBy === 'MRP_DESC') return (b.mrp || b.unitPrice || 0) - (a.mrp || a.unitPrice || 0);
        if (sortBy === 'EXPIRY_ASC') {
          const expA = a.expiryDate ? parseOrderDate(a.expiryDate)?.getTime() || Infinity : Infinity;
          const expB = b.expiryDate ? parseOrderDate(b.expiryDate)?.getTime() || Infinity : Infinity;
          return expA - expB;
        }
        return 0;
      });
  }, [rawItems, search, selectedCustomerId, expiryFilter, daysFilter, inStockOnly, sortBy]);

  // Aggregate stats from the filtered list
  const metrics = useMemo(() => {
    const totalRecords = filteredItems.length;
    const totalHoldQuantity = filteredItems.reduce((acc, it) => acc + (it.currentPantryQuantity || 0), 0);
    const totalDeliveredQuantity = filteredItems.reduce((acc, it) => acc + (it.orderedQuantity || 0), 0);
    const totalHoldingValue = filteredItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
    const totalMrpValue = filteredItems.reduce(
      (acc, it) => acc + ((it.mrp || it.unitPrice || 0) * (it.currentPantryQuantity || 0)),
      0
    );

    const uniqueProductIds = new Set(filteredItems.map((it) => it.productId || it.barcode));
    const uniqueCustomerIds = new Set(filteredItems.map((it) => it.customerId));

    const expiredCount = filteredItems.filter((it) => it.isExpired).length;
    const nearExpiryCount = filteredItems.filter((it) => it.isNearExpiry).length;

    // Nearest customer delivery
    let nearestDelivery: {
      customerName: string;
      deliveryDate: string;
      daysCount: number;
    } | null = null;

    if (filteredItems.length > 0) {
      let maxTime = -1;
      for (const it of filteredItems) {
        const t = parseOrderDate(it.deliveryDate)?.getTime() || 0;
        if (t > maxTime) {
          maxTime = t;
          const dayInfo = getDeliveryDayCount(it.deliveryDate);
          nearestDelivery = {
            customerName: it.customerName,
            deliveryDate: it.deliveryDate || '',
            daysCount: it.daysSinceDelivery ?? dayInfo.dayNumber,
          };
        }
      }
    }

    return {
      totalRecords,
      totalHoldQuantity,
      totalDeliveredQuantity,
      totalHoldingValue,
      totalMrpValue,
      uniqueProductsCount: uniqueProductIds.size,
      uniqueCustomersCount: uniqueCustomerIds.size,
      expiredCount,
      nearExpiryCount,
      nearestDelivery,
    };
  }, [filteredItems]);

  // Excel / CSV Export Function
  const handleExportToExcel = () => {
    if (!filteredItems.length) {
      alert('No customer hold pantry items available to export.');
      return;
    }

    const headers = [
      'Customer Name',
      'Customer Mobile',
      'Customer Address',
      'Customer ID',
      'Product Name',
      'Barcode',
      'Brand',
      'Batch Number',
      'MRP (INR)',
      'Unit Price (INR)',
      'Hold Qty in Pantry',
      'Total Delivered Qty',
      'Total Holding Value (INR)',
      'Delivery Date',
      'Delivery Day to Live Day Count',
      'Manufacturing Date (MFG)',
      'Expiry Date (EXP)',
      'MFG to Expiry Days (Total Lifespan)',
      'Days Remaining to Expiry',
      'Expiry Status',
      'Order ID',
      'Auditor Verification Status',
      'Pantry Card Item ID',
    ];

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredItems.map((item) => {
      const dayInfo = getDeliveryDayCount(item.deliveryDate);
      const daysCount = item.daysSinceDelivery ?? dayInfo.dayNumber;

      const expiryStatus = item.isExpired
        ? 'EXPIRED'
        : item.isNearExpiry
        ? 'NEAR_EXPIRY'
        : item.daysToExpiry !== undefined && item.daysToExpiry < 999
        ? 'SAFE'
        : 'NO_EXPIRY_SET';

      return [
        escapeCsv(item.customerName),
        escapeCsv(item.customerMobile),
        escapeCsv(item.customerAddress),
        escapeCsv(item.customerId),
        escapeCsv(item.productName),
        escapeCsv(item.barcode),
        escapeCsv(item.brand || ''),
        escapeCsv(item.batchNumber),
        escapeCsv(item.mrp || item.unitPrice || 0),
        escapeCsv(item.unitPrice),
        escapeCsv(item.currentPantryQuantity),
        escapeCsv(item.orderedQuantity),
        escapeCsv(item.totalValue),
        escapeCsv(item.deliveryDate || ''),
        escapeCsv(`${daysCount} Days Elapsed`),
        escapeCsv(item.manufacturingDate || ''),
        escapeCsv(item.expiryDate || ''),
        escapeCsv(item.mfgToExpiryDays ? `${item.mfgToExpiryDays} Days` : 'N/A'),
        escapeCsv(item.daysToExpiry !== undefined && item.daysToExpiry < 999 ? item.daysToExpiry : 'N/A'),
        escapeCsv(expiryStatus),
        escapeCsv(item.orderId || ''),
        escapeCsv(item.auditorVerificationStatus || 'PENDING_AUDIT'),
        escapeCsv(item.pantryCardItemId || ''),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `All_Customer_Hold_In_Pantry_Items_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyMobile = (id: string, mobile: string) => {
    navigator.clipboard?.writeText(mobile);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 p-5 rounded-2xl border border-purple-800/40 text-white shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-[11px] font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1">
                <Boxes className="w-3 h-3 text-purple-300" />
                <span>Pantry In-Stock Live Shelf Audit</span>
              </span>
              <span className="text-[11px] text-purple-300">
                • Auto-updates upon every order delivery
              </span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
              <span>All Customer Hold in Pantry Items List</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                {metrics.totalHoldQuantity} Units On Hold
              </span>
            </h3>
            <p className="text-xs text-purple-200/80 max-w-3xl mt-1">
              Complete register of all products currently held in customer pantries: Customer Name, Product Name, MRP, Batch #, MFG Date, EXP Date, MFG to Expiry Days Lifespan, Delivery Date, and Live Days Elapsed count.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchHoldings}
              disabled={loading}
              className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Refresh Live Customer Pantry Holdings"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Excel Export Button */}
            <button
              onClick={handleExportToExcel}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer border border-emerald-400/30 hover:scale-[1.01]"
              title="Export complete customer hold pantry items list to Excel (.csv)"
            >
              <Download className="w-4 h-4 text-emerald-100" />
              <span>Export to Excel (.csv)</span>
            </button>
          </div>
        </div>

        {/* 6 Metric KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-purple-800/40 text-xs">
          {/* Total Quantity in Hold Pantry */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-purple-200 uppercase font-semibold flex items-center gap-1">
              <Package className="w-3 h-3 text-purple-300" />
              <span>Hold Qty in Pantry</span>
            </div>
            <div className="text-xl font-black text-white mt-1">
              {metrics.totalHoldQuantity} <span className="text-xs font-normal text-purple-200">units</span>
            </div>
            <div className="text-[10px] text-purple-300/80 mt-0.5">
              Delivered: {metrics.totalDeliveredQuantity} units
            </div>
          </div>

          {/* Total Hold Products */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-purple-200 uppercase font-semibold flex items-center gap-1">
              <Tag className="w-3 h-3 text-indigo-300" />
              <span>Hold Products</span>
            </div>
            <div className="text-xl font-black text-indigo-200 mt-1">
              {metrics.uniqueProductsCount} <span className="text-xs font-normal text-purple-200">SKUs</span>
            </div>
            <div className="text-[10px] text-purple-300/80 mt-0.5">
              Across {metrics.totalRecords} allocations
            </div>
          </div>

          {/* Customer Households */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-purple-200 uppercase font-semibold flex items-center gap-1">
              <Users className="w-3 h-3 text-amber-300" />
              <span>Hold Households</span>
            </div>
            <div className="text-xl font-black text-amber-200 mt-1">
              {metrics.uniqueCustomersCount} <span className="text-xs font-normal text-purple-200">cust.</span>
            </div>
            <div className="text-[10px] text-purple-300/80 mt-0.5">
              Active pantry card holders
            </div>
          </div>

          {/* Total Valuation (Selling & MRP) */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[10px] text-purple-200 uppercase font-semibold flex items-center gap-1">
              <IndianRupee className="w-3 h-3 text-emerald-300" />
              <span>Holding Valuation</span>
            </div>
            <div className="text-xl font-black text-emerald-300 mt-1 font-mono">
              ₹{metrics.totalHoldingValue.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-purple-300/80 mt-0.5">
              MRP: ₹{metrics.totalMrpValue.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Nearest Delivery */}
          <div className="bg-emerald-500/20 backdrop-blur-xs p-3 rounded-xl border border-emerald-400/40">
            <div className="text-[10px] text-emerald-200 uppercase font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-300" />
              <span>Nearest Delivery</span>
            </div>
            {metrics.nearestDelivery ? (
              <div className="mt-1">
                <div className="text-sm font-black text-emerald-300 truncate" title={metrics.nearestDelivery.customerName}>
                  {metrics.nearestDelivery.customerName}
                </div>
                <div className="text-[10px] text-emerald-200/90 mt-0.5 flex items-center gap-1">
                  <span>{metrics.nearestDelivery.deliveryDate}</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-400/30 text-white font-bold text-[9px]">
                    Day {metrics.nearestDelivery.daysCount}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-emerald-200/70 mt-1">No deliveries</div>
            )}
          </div>

          {/* Expiry Attention */}
          <div className="bg-rose-500/20 backdrop-blur-xs p-3 rounded-xl border border-rose-400/40">
            <div className="text-[10px] text-rose-200 uppercase font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-300" />
              <span>Expiry Risk</span>
            </div>
            <div className="text-xl font-black text-rose-200 mt-1">
              {metrics.expiredCount + metrics.nearExpiryCount}{' '}
              <span className="text-xs font-normal text-rose-200/80">items</span>
            </div>
            <div className="text-[10px] text-rose-200/80 mt-0.5">
              {metrics.expiredCount} Expired • {metrics.nearExpiryCount} Near Exp.
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Free text search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search Customer, Mobile, Product, Barcode, Batch #, Order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="ALL">All Customers ({uniqueCustomers.length})</option>
              {uniqueCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Days Elapsed Filter */}
          <div>
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
            >
              <option value="ALL">Days Since Delivery: All</option>
              <option value="LE_7">Fresh (Within 7 Days)</option>
              <option value="8_15">Mid (8 to 15 Days)</option>
              <option value="16_30">Aging (16 to 30 Days)</option>
              <option value="30_PLUS">High Aging (30+ Days)</option>
            </select>
          </div>

          {/* Expiry Filter */}
          <div>
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
            >
              <option value="ALL">Expiry Status: All Items</option>
              <option value="WITH_MFG_EXP">Has MFG &amp; EXP Date</option>
              <option value="EXPIRED">Expired Items Only ⚠️</option>
              <option value="NEAR_EXPIRY">Near Expiry (&le; 30 Days)</option>
              <option value="SAFE">Safe / Fresh Shelf Life</option>
            </select>
          </div>
        </div>

        {/* Secondary Bar: Sort & In-Stock Switch */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-slate-300 cursor-pointer"
              />
              <span className="font-semibold text-slate-900">
                Show Active Pantry Hold Only (&gt;0 Units)
              </span>
            </label>

            <span className="text-slate-300">|</span>

            <span className="text-slate-500">
              Showing <strong className="text-slate-900">{filteredItems.length}</strong> of{' '}
              <strong className="text-slate-900">{rawItems.length}</strong> hold items
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Sort By:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
            >
              <option value="DELIVERY_DESC">Delivery Date: Nearest First</option>
              <option value="DELIVERY_ASC">Delivery Date: Oldest First</option>
              <option value="DAYS_DESC">Days Elapsed: Highest First</option>
              <option value="DAYS_ASC">Days Elapsed: Lowest First</option>
              <option value="QTY_DESC">Hold Quantity: Highest First</option>
              <option value="MRP_DESC">MRP: Highest First</option>
              <option value="EXPIRY_ASC">Expiry Date: Nearest Expiry</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table: All Customer Hold in Pantry Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {loading && !data ? (
            <div className="py-16 text-center text-slate-500 text-xs space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-purple-600 mb-2" />
              <div className="font-bold text-slate-700">Loading All Customer Hold Pantry Items...</div>
              <div className="text-[11px] text-slate-400">Aggregating live customer shelf holdings &amp; shelf lifespans</div>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-500 text-xs space-y-2">
              <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-rose-600" />
              <div className="font-bold">{error}</div>
              <button
                onClick={fetchHoldings}
                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 cursor-pointer font-semibold text-xs mt-2"
              >
                Retry
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs space-y-2">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-bold text-slate-700 text-sm">No Customer Hold Items Found</div>
              <div className="text-slate-400 max-w-sm mx-auto">
                No customer pantry holdings matched your active search query or filters.
              </div>
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCustomerId('ALL');
                  setExpiryFilter('ALL');
                  setDaysFilter('ALL');
                  setInStockOnly(false);
                }}
                className="mt-2 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold cursor-pointer border border-purple-200"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Customer Details</th>
                  <th className="py-3 px-3">Product Name &amp; Barcode</th>
                  <th className="py-3 px-3">Batch Number</th>
                  <th className="py-3 px-3 text-right">MRP &amp; Unit Price</th>
                  <th className="py-3 px-3 text-center">Hold Qty in Pantry</th>
                  <th className="py-3 px-3">Delivery Date &amp; Live Day Count</th>
                  <th className="py-3 px-3">MFG &amp; EXP Date (Lifespan Days)</th>
                  <th className="py-3 px-3">Order &amp; Auditor Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => {
                  const dayInfo = getDeliveryDayCount(item.deliveryDate);
                  const exactDays = item.daysSinceDelivery ?? dayInfo.dayNumber;
                  const itemKey = item.pantryCardItemId || `hold-${item.customerId}-${item.productId}-${idx}`;
                  const isCopied = copiedId === itemKey;

                  const mrpDisplay = item.mrp || item.unitPrice || 0;

                  return (
                    <tr key={itemKey} className="hover:bg-purple-50/20 transition">
                      {/* 1. Customer Details */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-200 mt-0.5">
                            {item.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{item.customerName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({item.customerId})</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono text-[10px]">
                                <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                <a href={`tel:${item.customerMobile}`} className="hover:underline">
                                  {item.customerMobile}
                                </a>
                                <button
                                  onClick={() => copyMobile(itemKey, item.customerMobile)}
                                  className="ml-0.5 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                                  title="Copy phone"
                                >
                                  {isCopied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2 h-2" />}
                                </button>
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-start gap-1 max-w-[220px] truncate" title={item.customerAddress}>
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0 mt-0.5" />
                              <span className="truncate">{item.customerAddress}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Product Name & Barcode */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 mt-0.5">
                            <ImageWithFallback
                              src={item.image}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {item.productName}
                            </div>
                            {item.brand && (
                              <div className="text-[10px] text-slate-500 font-medium">
                                Brand: {item.brand}
                              </div>
                            )}
                            {item.barcode ? (
                              <button
                                onClick={() => onOpenBarcodeHistory && onOpenBarcodeHistory(item.barcode)}
                                className="mt-1 font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 inline-flex items-center gap-1 cursor-pointer transition"
                                title="Click to view full Barcode Product Management"
                              >
                                <Barcode className="w-3 h-3 text-indigo-600" />
                                <span>#{item.barcode}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">No barcode</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Batch Number */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.batchNumber ? (
                          <button
                            onClick={() => onOpenBatchHistory && onOpenBatchHistory(item.batchNumber)}
                            className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-300 inline-flex items-center gap-1 transition cursor-pointer"
                            title="Click to view Batch Lifecycle"
                          >
                            <Boxes className="w-3 h-3 text-emerald-600" />
                            <span>#{item.batchNumber}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">N/A</span>
                        )}
                      </td>

                      {/* 4. MRP & Unit Price */}
                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono">
                        <div className="font-bold text-slate-900 text-xs flex items-center justify-end gap-1">
                          <span className="text-[10px] text-slate-400 uppercase font-sans">MRP:</span>
                          <span className="text-purple-900 font-black">₹{mrpDisplay}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Selling: ₹{item.unitPrice}/u
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                          Hold Val: ₹{item.totalValue}
                        </div>
                      </td>

                      {/* 5. Hold Qty in Pantry */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-3 py-1 rounded-full font-black text-xs ${
                            item.currentPantryQuantity > 0
                              ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {item.currentPantryQuantity} unit{item.currentPantryQuantity > 1 ? 's' : ''}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1 font-medium">
                          Delivered: {item.orderedQuantity}
                        </div>
                      </td>

                      {/* 6. Delivery Date & Live Day Count */}
                      <td className="py-3 px-3 whitespace-nowrap">
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

                      {/* 7. MFG & EXP Date (Lifespan Days) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-[11px] text-slate-700 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase w-8">MFG:</span>
                            <span className="font-semibold text-slate-800">{item.manufacturingDate || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase w-8">EXP:</span>
                            <span className={`font-semibold ${item.isExpired ? 'text-rose-700 font-bold' : 'text-slate-800'}`}>
                              {item.expiryDate || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* MFG to Expiry Days count */}
                        {item.mfgToExpiryDays ? (
                          <div className="mt-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                              <span>{item.mfgToExpiryDays} Days Total Shelf Life</span>
                            </span>
                          </div>
                        ) : null}

                        {/* Live Expiry Status Badge */}
                        <div className="mt-1">
                          {item.isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Expired Item</span>
                            </span>
                          ) : item.isNearExpiry ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Expires in {item.daysToExpiry} Days</span>
                            </span>
                          ) : item.expiryDate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-2.5 h-2.5" />
                              <span>Safe ({item.daysToExpiry}d left)</span>
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* 8. Order & Auditor Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.orderId ? (
                          <div>
                            <button
                              onClick={() => onOpenOrder && onOpenOrder(item.orderId)}
                              className="font-mono text-[10px] text-indigo-700 hover:underline inline-flex items-center gap-0.5 cursor-pointer font-bold"
                            >
                              <span>Order #{item.orderId}</span>
                              <ExternalLink className="w-2 h-2" />
                            </button>
                          </div>
                        ) : null}

                        <div className="mt-1">
                          {item.auditorVerificationStatus === 'AVAILABLE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              <span>Auditor Verified</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] border border-slate-200">
                              <Clock className="w-2.5 h-2.5 text-slate-400" />
                              <span>Pending Audit</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 9. Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.barcode && onOpenBarcodeHistory && (
                            <button
                              onClick={() => onOpenBarcodeHistory(item.barcode)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                              title="Inspect Barcode Product Management"
                            >
                              Barcode
                            </button>
                          )}
                          {onOpenCustomerProfile && (
                            <button
                              onClick={() => onOpenCustomerProfile(item.customerId)}
                              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                              title="View Customer Profile & Pantry Card"
                            >
                              Profile
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
