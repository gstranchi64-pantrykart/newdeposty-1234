import React, { useState, useEffect, useMemo } from 'react';
import { CustomerPantryHolding, CustomerPantryHoldingsResponse } from '../../types';
import { api } from '../../services/api';
import { AppWindowModal } from '../common/AppWindowModal';
import { getDeliveryDayCount } from '../../utils/dateTimeUtils';
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
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface CustomerPantryHoldingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcode?: string;
  batchNumber?: string;
  productName?: string;
  onOpenOrder?: (orderId: string) => void;
  onOpenCustomerProfile?: (customerId: string) => void;
}

export const CustomerPantryHoldingsModal: React.FC<CustomerPantryHoldingsModalProps> = ({
  isOpen,
  onClose,
  barcode,
  batchNumber,
  productName,
  onOpenOrder,
  onOpenCustomerProfile,
}) => {
  const [data, setData] = useState<CustomerPantryHoldingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [daysFilter, setDaysFilter] = useState<'ALL' | '5_PLUS' | '10_PLUS' | '15_PLUS' | '30_PLUS'>('ALL');
  const [stockOnly, setStockOnly] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchHoldings = async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPantryHoldings({
        barcode,
        batchNumber,
        search,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load customer pantry holdings:', err);
      setError(err.message || 'Could not load customer pantry distribution.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, [isOpen, barcode, batchNumber]);

  const handleCopyMobile = (mobile: string, id: string) => {
    navigator.clipboard?.writeText(mobile);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    return data.items.filter((item) => {
      // 1. In stock only filter
      if (stockOnly && item.currentPantryQuantity <= 0) {
        return false;
      }

      // 2. Days since delivery filter
      const dayInfo = getDeliveryDayCount(item.deliveryDate);
      const daysCount = item.daysSinceDelivery ?? dayInfo.dayNumber;

      if (daysFilter === '5_PLUS' && daysCount < 5) return false;
      if (daysFilter === '10_PLUS' && daysCount < 10) return false;
      if (daysFilter === '15_PLUS' && daysCount < 15) return false;
      if (daysFilter === '30_PLUS' && daysCount < 30) return false;

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.customerName.toLowerCase().includes(q) ||
          item.customerMobile.toLowerCase().includes(q) ||
          item.customerAddress.toLowerCase().includes(q) ||
          (item.orderId && item.orderId.toLowerCase().includes(q)) ||
          item.productName.toLowerCase().includes(q) ||
          (item.batchNumber && item.batchNumber.toLowerCase().includes(q)) ||
          (item.barcode && item.barcode.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [data, stockOnly, daysFilter, search]);

  if (!isOpen) return null;

  const titlePrefix = batchNumber
    ? `Customer Pantry Stock: Batch #${batchNumber}`
    : barcode
    ? `Customer Pantry Stock: Barcode ${barcode}`
    : 'Customer Pantry Stock Distribution';

  const subtitle = productName
    ? `${productName} ${barcode ? `• Barcode: ${barcode}` : ''} ${batchNumber ? `• Batch: #${batchNumber}` : ''}`
    : 'Live distribution of items currently in customer pantries';

  // Metrics calculation
  const totalFilteredPantryQty = filteredItems.reduce((acc, it) => acc + (it.currentPantryQuantity || 0), 0);
  const totalFilteredValue = filteredItems.reduce((acc, it) => acc + (it.totalValue || (it.currentPantryQuantity * it.unitPrice)), 0);
  const uniqueFilteredCustomers = new Set(filteredItems.map((it) => it.customerId)).size;

  return (
    <AppWindowModal
      isOpen={isOpen}
      onClose={onClose}
      title={titlePrefix}
      subtitle={subtitle}
      icon={<Users className="w-5 h-5 text-purple-600" />}
      size="2xl"
    >
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header Summary Banner */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white border-b border-purple-800/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[11px] font-bold tracking-wide uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Pantry In-Stock Holdings
                </span>
                {barcode && (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white font-mono text-[11px] border border-white/20">
                    Barcode: {barcode}
                  </span>
                )}
                {batchNumber && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[11px] border border-emerald-400/30">
                    Batch: #{batchNumber}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                {productName || data?.items[0]?.productName || 'Customer Pantry In-Stock Ledger'}
              </h2>
              <p className="text-xs text-purple-200/80 mt-0.5">
                Kon item kis customer ke pantry me kitne units in-stock hai aur kitne din delivery hue ho gaye — complete real-time report.
              </p>
            </div>

            <button
              onClick={fetchHoldings}
              disabled={loading}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Quick Metrics */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4 pt-4 border-t border-purple-800/40">
              <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-purple-200 font-medium uppercase tracking-wider">In-Pantry Active Stock</div>
                <div className="text-lg sm:text-xl font-black text-white mt-0.5 flex items-baseline gap-1">
                  <span>{totalFilteredPantryQty}</span>
                  <span className="text-xs font-normal text-purple-200">Units</span>
                </div>
                <div className="text-[10px] text-purple-200/70 mt-0.5">Held currently at home</div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-purple-200 font-medium uppercase tracking-wider">Customer Households</div>
                <div className="text-lg sm:text-xl font-black text-amber-300 mt-0.5 flex items-baseline gap-1">
                  <span>{uniqueFilteredCustomers}</span>
                  <span className="text-xs font-normal text-purple-200">Homes</span>
                </div>
                <div className="text-[10px] text-purple-200/70 mt-0.5">Holding this item</div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-purple-200 font-medium uppercase tracking-wider">Stock Valuation</div>
                <div className="text-lg sm:text-xl font-black text-emerald-300 mt-0.5">
                  ₹{totalFilteredValue.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-purple-200/70 mt-0.5">In customer custody</div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
                <div className="text-[10px] text-purple-200 font-medium uppercase tracking-wider">Original Delivered</div>
                <div className="text-lg sm:text-xl font-black text-white mt-0.5 flex items-baseline gap-1">
                  <span>{data.summary.totalDeliveredQuantity}</span>
                  <span className="text-xs font-normal text-purple-200">Units</span>
                </div>
                <div className="text-[10px] text-purple-200/70 mt-0.5">{data.summary.totalCurrentPantryQuantity} still unconsumed</div>
              </div>
            </div>
          )}
        </div>

        {/* Filter Bar: Days Since Delivery & Search */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Customer Name, Mobile (+91), Address, Barcode, Order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* In-Stock Only Toggle */}
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 transition">
                <input
                  type="checkbox"
                  checked={stockOnly}
                  onChange={(e) => setStockOnly(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                />
                <span>In-Stock Only (&gt; 0 Units)</span>
              </label>
            </div>
          </div>

          {/* Days Since Delivery Quick Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
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
              All Days (Any)
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
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && !data ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-2" />
              <p className="text-sm font-semibold">Locating customer pantries holding this item...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No Customer Records Match Criteria</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {search || daysFilter !== 'ALL' || stockOnly
                  ? `No customer holding matches the filters (Days: ${daysFilter}, StockOnly: ${stockOnly ? 'Yes' : 'No'}). Try resetting filters.`
                  : 'Currently no customer pantries are holding units from this batch/barcode.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-600 flex items-center justify-between px-1">
                <span>Showing {filteredItems.length} Customer Pantry Location{filteredItems.length > 1 ? 's' : ''}</span>
                <span className="text-[11px] text-slate-400 font-normal">Sorted by active in-pantry units &amp; delivery timeline</span>
              </div>

              {filteredItems.map((item, idx) => {
                const isCopied = copiedId === (item.pantryCardItemId || item.orderId);
                const dayInfo = getDeliveryDayCount(item.deliveryDate);
                const exactDays = item.daysSinceDelivery ?? dayInfo.dayNumber;

                return (
                  <div
                    key={item.pantryCardItemId || `${item.orderId}-${idx}`}
                    className="bg-white rounded-xl border border-slate-200 hover:border-purple-300 shadow-2xs hover:shadow-xs transition p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      {/* Customer Info */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-200">
                          {item.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-900 text-sm">{item.customerName}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono font-semibold">
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
                                ? `Active In-Pantry: ${item.currentPantryQuantity} Unit${item.currentPantryQuantity > 1 ? 's' : ''}`
                                : 'Stock Fully Consumed / Returned'}
                            </span>
                          </div>

                          {/* Contact & Mobile Number */}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              <a
                                href={`tel:${item.customerMobile}`}
                                className="hover:underline font-mono"
                                title="Click to call customer"
                              >
                                {item.customerMobile}
                              </a>
                              <button
                                onClick={() => handleCopyMobile(item.customerMobile, item.pantryCardItemId || item.orderId || String(idx))}
                                className="ml-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                                title="Copy mobile number"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>

                            {item.orderId && (
                              <button
                                onClick={() => onOpenOrder && onOpenOrder(item.orderId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold cursor-pointer transition font-mono"
                                title="View original Pantry order"
                              >
                                <span>Order #{item.orderId}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}

                            {onOpenCustomerProfile && (
                              <button
                                onClick={() => onOpenCustomerProfile(item.customerId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold cursor-pointer transition"
                                title="Open 360 Customer Profile"
                              >
                                <Users className="w-3 h-3" />
                                <span>360 Profile</span>
                              </button>
                            )}

                            {/* Delivery Date & Exact Days Counter (Requested by user) */}
                            {item.deliveryDate && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="text-slate-500 text-xs flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Delivered: {item.deliveryDate}</span>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1 shadow-2xs ${
                                    exactDays <= 7
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : exactDays <= 14
                                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                                      : exactDays <= 21
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}
                                  title={`Actual days since delivery: ${exactDays} days`}
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
                            <span className="leading-snug">{item.customerAddress}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stock & Valuation Stats */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 bg-purple-50 sm:bg-transparent p-2.5 sm:p-0 rounded-lg shrink-0 border border-purple-100 sm:border-0">
                        <div className="text-right">
                          <div className="text-[11px] font-semibold text-purple-900">Current In-Pantry Stock</div>
                          <div className="text-lg font-black text-purple-700 font-mono">
                            {item.currentPantryQuantity} Unit{item.currentPantryQuantity > 1 ? 's' : ''}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            (Original Delivered: {item.orderedQuantity})
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] text-slate-500">Holding Value</div>
                          <div className="text-sm font-bold text-slate-900 font-mono">
                            ₹{item.totalValue} <span className="text-[10px] text-slate-400 font-normal">(@ ₹{item.unitPrice})</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Technical details footer: Batch, Barcode, Auditor Verification */}
                    <div className="pt-2.5 mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <Boxes className="w-3 h-3 text-emerald-600" />
                          <span>Batch #{item.batchNumber}</span>
                        </span>

                        <span className="inline-flex items-center gap-1 font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <Barcode className="w-3 h-3 text-indigo-600" />
                          <span>Barcode: {item.barcode}</span>
                        </span>

                        {item.expiryDate && (
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Expiry: {item.expiryDate}</span>
                          </span>
                        )}
                      </div>

                      {/* Auditor Status */}
                      <div className="flex items-center gap-2">
                        {item.auditorVerificationStatus === 'AVAILABLE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Auditor Verified (Available)</span>
                          </span>
                        ) : item.auditorVerificationStatus === 'DAMAGED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Auditor Flagged Damaged</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px]">
                            <Clock className="w-3 h-3" />
                            <span>Pending Auditor Check</span>
                          </span>
                        )}

                        {item.lastAuditorRemarks && (
                          <span className="text-slate-500 italic max-w-xs truncate" title={item.lastAuditorRemarks}>
                            &ldquo;{item.lastAuditorRemarks}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Real-time Pantry Stock &amp; Delivery Days Calculation</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </AppWindowModal>
  );
};

