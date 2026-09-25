import React, { useState } from 'react';
import { Customer, Order, PantryCardItem } from '../../types';
import {
  X,
  CreditCard,
  Package,
  Truck,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShoppingBag,
  Info,
  Search,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export type LimitMetricTab = 'APPROVED' | 'HOME_STOCK' | 'IN_TRANSIT' | 'TOTAL_USED' | 'AVAILABLE';

interface CreditLimitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LimitMetricTab;
  customer: Customer;
  pantryItems: (PantryCardItem & {
    daysSinceDelivery?: number;
    isReturnEligible?: boolean;
    isNearExpiry?: boolean;
    isExpired?: boolean;
  })[];
  orders: Order[];
  onOpenStore?: () => void;
}

export const CreditLimitDetailModal: React.FC<CreditLimitDetailModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'TOTAL_USED',
  customer,
  pantryItems,
  orders,
  onOpenStore,
}) => {
  const [activeTab, setActiveTab] = useState<LimitMetricTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // 1. Stock Valuation of active items at home
  const activeStockItems = pantryItems.filter(
    (i) => (i.quantity || 0) > 0 && i.status !== 'RETURNED'
  );
  const stockValuation = activeStockItems.reduce(
    (acc, i) => acc + (i.quantity || 0) * (i.unitPrice || 0),
    0
  );

  // 2. In-Transit Pantry Orders
  const inTransitPantryOrders = orders.filter(
    (o) =>
      o.orderType === 'PANTRY' &&
      ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(
        o.orderStatus
      )
  );
  const inTransitOrdersValue = inTransitPantryOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

  // 3. Approved & Computed Balances
  const approvedLimit = customer.pantryLimit || 0;
  const effectiveUsedLimit = stockValuation + inTransitOrdersValue;
  const effectiveAvailableLimit = Math.max(0, approvedLimit - effectiveUsedLimit);

  // Filtered Stock Items
  const filteredStockItems = activeStockItems.filter(
    (i) =>
      (i.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.barcode || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 text-white p-5 sm:p-6 flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Pantry Credit Limit &amp; Stock Valuation Breakdown
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  Auto-Calculated Live
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-0.5">
                Cardholder: <strong>{customer.fullName}</strong> • ID: <strong>{customer.id}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5-Tabs Navigation Bar */}
        <div className="bg-slate-100 border-b border-slate-200 p-2 flex gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('APPROVED')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'APPROVED'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>1. Approved (₹{approvedLimit.toLocaleString('en-IN')})</span>
          </button>

          <button
            onClick={() => setActiveTab('HOME_STOCK')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'HOME_STOCK'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>2. Home Stock (₹{stockValuation.toLocaleString('en-IN')})</span>
          </button>

          <button
            onClick={() => setActiveTab('IN_TRANSIT')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'IN_TRANSIT'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>3. In-Transit (₹{inTransitOrdersValue.toLocaleString('en-IN')})</span>
          </button>

          <button
            onClick={() => setActiveTab('TOTAL_USED')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'TOTAL_USED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>4. Total Used (₹{effectiveUsedLimit.toLocaleString('en-IN')})</span>
          </button>

          <button
            onClick={() => setActiveTab('AVAILABLE')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'AVAILABLE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>5. Available (₹{effectiveAvailableLimit.toLocaleString('en-IN')})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: APPROVED LIMIT */}
          {activeTab === 'APPROVED' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-200/70 px-2.5 py-0.5 rounded-full">
                    Admin Approved Perpetual Credit Limit
                  </span>
                  <div className="text-3xl font-black text-purple-950">
                    ₹{approvedLimit.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-purple-800">
                    Maximum revolving credit exposure cap set by Admin for household {customer.fullName}.
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-purple-200 text-xs text-slate-700 space-y-1 sm:text-right">
                  <div><strong>Credit Line:</strong> <span className="text-emerald-600 font-bold">All-Time Active</span></div>
                  <div><strong>Billing Cycle:</strong> Continuous Revolving (No Monthly Reset)</div>
                  <div><strong>Total Lifetime Orders:</strong> Unlimited (Rolling Cap)</div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 space-y-2.5">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                  <Info className="w-4 h-4 text-purple-600" />
                  <span>How does your All-Time Revolving Credit Limit work?</span>
                </h4>
                <div className="space-y-2 text-slate-600 leading-relaxed">
                  <p>
                    • <strong>Perpetual Revolving Limit (No Monthly Reset):</strong> Ye credit limit har mahine reset ya expire nahi hota. Admin dwara diya gaya <strong>₹{approvedLimit.toLocaleString('en-IN')}</strong> ka cap hamesha active rehta hai.
                  </p>
                  <p>
                    • <strong>Active Exposure Cap:</strong> Kisi bhi ek samay par aapke ghar ka unpaid Home Stock + In-Transit Orders ka total ₹{approvedLimit.toLocaleString('en-IN')} se zyada nahi ho sakta.
                  </p>
                  <p>
                    • <strong>Unlimited Rolling Consumption (₹15,000, ₹20,000+):</strong> Jaise hi aap products use/consume karke <strong>Pantry Pay / Wallet</strong> se payment karte hain ya items return karte hain, aapka credit limit <strong>turant live restore/increase ho jata hai</strong>. Is tarah aap kitna bhi total purchase aur consumption continuously kar sakte hain!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HOME STOCK VALUE */}
          {activeTab === 'HOME_STOCK' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                    Active Home Stock Valuation
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-amber-950 mt-1">
                    ₹{stockValuation.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Total <strong>{activeStockItems.length} product items</strong> physically present in your home pantry.
                  </p>
                </div>
                <div className="text-xs text-amber-900 bg-white/80 p-3 rounded-xl border border-amber-200/80 max-w-sm">
                  💡 <strong>Consumption / Return Rule:</strong> Jab aap kisi item ko consume karke pay karte hain ya return karte hain, to ye amount kam ho jati hai aur Available Limit turant badh jati hai.
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products currently in your home pantry..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Product List */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {filteredStockItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No matching home pantry stock items found.
                  </div>
                ) : (
                  filteredStockItems.map((item) => {
                    const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-amber-300 transition shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100'}
                            alt={item.productName}
                            className="w-12 h-12 object-contain rounded-xl bg-slate-50 p-1 border border-slate-100 shrink-0"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900">{item.productName}</div>
                            <div className="text-[11px] text-slate-500">
                              {item.brand && `${item.brand} • `}
                              {item.weightSize || 'Unit'} • Barcode: {item.barcode || 'N/A'}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                              Delivered: {item.deliveryDate || 'Active'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-slate-800">
                            {item.quantity} {item.quantity === 1 ? 'unit' : 'units'} × ₹{item.unitPrice}
                          </div>
                          <div className="text-sm font-black text-amber-700 mt-0.5">
                            ₹{itemTotal.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: IN-TRANSIT ORDERS */}
          {activeTab === 'IN_TRANSIT' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 bg-sky-200/80 px-2.5 py-0.5 rounded-full">
                    Active In-Transit / Pending Delivery Orders
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-sky-950 mt-1">
                    ₹{inTransitOrdersValue.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-sky-800 mt-0.5">
                    <strong>{inTransitPantryOrders.length} active orders</strong> currently in packaging or delivery transit.
                  </p>
                </div>
                <div className="text-xs text-sky-900 bg-white/80 p-3 rounded-xl border border-sky-200/80 max-w-sm">
                  🚚 <strong>Seamless Inward:</strong> Delivery complete hote hi ye items bina kisi double deduction ke Home Stock me move ho jayenge.
                </div>
              </div>

              {/* In-Transit Order Cards */}
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {inTransitPantryOrders.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <div className="text-xs font-bold text-slate-700">No active pantry orders in transit</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      All your previous pantry orders have been successfully delivered to your home!
                    </div>
                  </div>
                ) : (
                  inTransitPantryOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-900">
                            #{order.id}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                            {order.orderStatus.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-sm font-black text-sky-900">
                          ₹{order.totalAmount.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>Ordered: {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'Recent'}</span>
                        <span>{order.items.length} product {order.items.length === 1 ? 'item' : 'items'}</span>
                      </div>

                      {/* Items Mini List */}
                      <div className="bg-slate-50 rounded-xl p-2 space-y-1 text-xs">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-700">
                            <span className="truncate max-w-[280px]">
                              {item.productName} ({item.quantity} {(item as any).unit || (item as any).weightSize || 'units'})
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: TOTAL USED RECONCILIATION */}
          {activeTab === 'TOTAL_USED' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-200/80 px-2.5 py-0.5 rounded-full">
                    Total Used Credit Liability
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-rose-950 mt-1">
                    ₹{effectiveUsedLimit.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-rose-800 mt-0.5">
                    Home Stock Value (₹{stockValuation.toLocaleString('en-IN')}) + In-Transit Orders (₹{inTransitOrdersValue.toLocaleString('en-IN')})
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-rose-200 text-xs text-slate-700 space-y-1">
                  <div className="flex justify-between gap-4">
                    <span>Home Stock:</span>
                    <strong className="text-amber-700">₹{stockValuation.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>In-Transit:</span>
                    <strong className="text-sky-700">₹{inTransitOrdersValue.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-1">
                    <span>Total Used:</span>
                    <strong className="text-rose-700">₹{effectiveUsedLimit.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              {/* Combined Itemized Reconciliation Strip */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                  Detailed Itemized Inventory &amp; Order Breakdown
                </h4>

                {/* Section A: Home Stock */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-100 p-3 flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-amber-600" />
                      A. Active Home Pantry Products ({activeStockItems.length} items)
                    </span>
                    <span className="text-amber-800">₹{stockValuation.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto p-2 space-y-1">
                    {activeStockItems.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-xs py-1.5 px-2 text-slate-700">
                        <span className="truncate max-w-[260px] font-medium">{it.productName} ({it.quantity} units)</span>
                        <span className="font-mono font-bold text-slate-900">₹{((it.quantity || 0) * (it.unitPrice || 0)).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section B: In-Transit Orders */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-100 p-3 flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-sky-600" />
                      B. In-Transit Pending Delivery Orders ({inTransitPantryOrders.length} orders)
                    </span>
                    <span className="text-sky-800">₹{inTransitOrdersValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto p-2 space-y-1">
                    {inTransitPantryOrders.length === 0 ? (
                      <div className="text-center py-2 text-slate-400 text-xs">No orders in transit</div>
                    ) : (
                      inTransitPantryOrders.map((ord) => (
                        <div key={ord.id} className="flex items-center justify-between text-xs py-1.5 px-2 text-slate-700">
                          <span>Order #{ord.id} ({ord.orderStatus})</span>
                          <span className="font-mono font-bold text-slate-900">₹{ord.totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AVAILABLE CLOSING LIMIT */}
          {activeTab === 'AVAILABLE' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200 px-2.5 py-0.5 rounded-full">
                    Closing Available Pantry Credit
                  </span>
                  <div className="text-3xl font-black text-emerald-950">
                    ₹{effectiveAvailableLimit.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-emerald-800">
                    Ready for immediate pantry grocery orders with 0% advance payment.
                  </p>
                </div>
                {onOpenStore && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenStore();
                    }}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Shop Grocery Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Equation Box */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Exact Live Financial Balance Sheet</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-800 p-3 rounded-xl">
                    <div className="text-purple-300 text-[10px] font-bold uppercase">Approved Limit</div>
                    <div className="text-lg font-black text-white mt-0.5">₹{approvedLimit.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="bg-slate-800 p-3 rounded-xl">
                    <div className="text-rose-300 text-[10px] font-bold uppercase">Minus Total Used</div>
                    <div className="text-lg font-black text-rose-400 mt-0.5">-₹{effectiveUsedLimit.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="bg-emerald-950 p-3 rounded-xl border border-emerald-500/40">
                    <div className="text-emerald-300 text-[10px] font-bold uppercase">Equals Available</div>
                    <div className="text-lg font-black text-emerald-400 mt-0.5">₹{effectiveAvailableLimit.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            Click any metric tab above to inspect live inventory and order details.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
