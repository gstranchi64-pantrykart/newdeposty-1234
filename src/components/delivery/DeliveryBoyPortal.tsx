import React, { useState, useEffect } from 'react';
import { Order, ReplacementRequest, ReturnRequest, DeliveryBoy, AuditorReturnOrder } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  Truck,
  Package,
  MapPin,
  Phone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  CreditCard,
  Banknote,
  Clock,
  Calendar,
  Navigation,
  XCircle,
  RotateCcw,
  ShieldAlert,
  Lock,
  Boxes,
  Eye,
  X,
} from 'lucide-react';
import { parseOrderDate, formatOrderDateTime, getOrderPreciseTimestamp } from '../../utils/dateTimeUtils';

export const DeliveryBoyPortal: React.FC = () => {
  const { user, deliveryBoy } = useAuth();
  const { currentTheme } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [replacements, setReplacements] = useState<ReplacementRequest[]>([]);
  const [auditorReturns, setAuditorReturns] = useState<AuditorReturnOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Failure Modal state
  const [failingOrderId, setFailingOrderId] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState('Customer Not Available');
  const [failureRemarks, setFailureRemarks] = useState('');

  // Auditor Return Collection Modal state
  const [collectingAuditorReturn, setCollectingAuditorReturn] = useState<AuditorReturnOrder | null>(null);
  const [actualReceivedQty, setActualReceivedQty] = useState<number>(0);
  const [damagedQty, setDamagedQty] = useState<number>(0);
  const [returnCondition, setReturnCondition] = useState<'GOOD' | 'DAMAGED' | 'PARTIAL' | 'OTHER'>('GOOD');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [submittingCollection, setSubmittingCollection] = useState(false);

  const fetchData = async () => {
    if (!deliveryBoy && !user?.deliveryBoyId) return;
    const dbId = deliveryBoy?.id || user?.deliveryBoyId || '';
    setLoading(true);
    try {
      const [allOrders, allReturns, allReps, allAudReturns] = await Promise.all([
        api.getOrders({ deliveryBoyId: dbId }),
        api.getReturns(),
        api.getReplacements(),
        api.getAuditorReturnOrders({ deliveryBoyId: dbId }),
      ]);

      setOrders(
        allOrders.sort((a, b) => {
          const tsA = getOrderPreciseTimestamp(a);
          const tsB = getOrderPreciseTimestamp(b);
          const dateA = parseOrderDate(tsA);
          const dateB = parseOrderDate(tsB);
          const timeA = dateA ? dateA.getTime() : 0;
          const timeB = dateB ? dateB.getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          return b.id.localeCompare(a.id);
        })
      );
      setReturns(allReturns.filter((r) => r.assignedDeliveryBoyId === dbId));
      setReplacements(allReps.filter((r) => r.assignedDeliveryBoyId === dbId));
      setAuditorReturns(allAudReturns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = api.subscribeRealtime(() => {
      fetchData();
    });
    return () => unsubscribe();
  }, [deliveryBoy?.id, user?.deliveryBoyId]);

  // Handle Order Accept
  const handleAcceptOrder = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      await api.acceptOrderDelivery(orderId);
      alert('Order delivery accepted successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Mark Out for Delivery
  const handleMarkOutForDelivery = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      await api.markOrderOutForDelivery(orderId);
      alert('Order is now Out for Delivery!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Mark Delivered (Cash Collected for Quick COD)
  const handleMarkDelivered = async (orderId: string) => {
    if (!window.confirm('Confirm that this order has been safely delivered to the customer?')) return;
    setUpdatingId(orderId);
    try {
      await api.markOrderDelivered(orderId);
      alert('Order marked as Delivered & Completed successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Mark Failed
  const handleMarkFailedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failingOrderId) return;
    setUpdatingId(failingOrderId);
    try {
      await api.markOrderFailed(failingOrderId, failureReason, failureRemarks);
      alert('Order marked as Delivery Failed.');
      setFailingOrderId(null);
      setFailureRemarks('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Return pickup workflow
  const handleAcceptReturn = async (returnId: string) => {
    setUpdatingId(returnId);
    try {
      await api.updateReturnPickupStatus(returnId, 'ACCEPTED');
      alert('Return pickup accepted!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkReturnOut = async (returnId: string) => {
    setUpdatingId(returnId);
    try {
      await api.updateReturnPickupStatus(returnId, 'OUT_FOR_PICKUP');
      alert('Return is now Out for Pickup!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCompleteReturnPickup = async (returnId: string) => {
    if (!window.confirm('Are you sure you have collected the physical items for this return request?')) return;
    setUpdatingId(returnId);
    try {
      await api.updateReturnPickupStatus(returnId, 'COMPLETED');
      alert('Return pickup completed! Stock and customer credit limits are automatically restored.');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Replacement delivery workflow
  const handleAcceptReplacement = async (repId: string) => {
    setUpdatingId(repId);
    try {
      await api.updateReplacementDeliveryStatus(repId, 'ACCEPTED');
      alert('Replacement task accepted!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkReplacementOut = async (repId: string) => {
    setUpdatingId(repId);
    try {
      await api.updateReplacementDeliveryStatus(repId, 'OUT_FOR_DELIVERY');
      alert('Replacement is now Out for Delivery!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCompleteReplacementDelivery = async (repId: string) => {
    if (!window.confirm('Confirm that you have handed over the fresh replacement unit to the customer?')) return;
    setUpdatingId(repId);
    try {
      await api.updateReplacementDeliveryStatus(repId, 'COMPLETED');
      alert('Replacement delivery completed successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenCollectModal = (audOrder: AuditorReturnOrder) => {
    setCollectingAuditorReturn(audOrder);
    setActualReceivedQty(audOrder.returnQuantity);
    setDamagedQty(0);
    setReturnCondition('GOOD');
    setCollectionNotes('');
  };

  const handleConfirmAuditorCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingAuditorReturn) return;
    setSubmittingCollection(true);
    try {
      await api.confirmDeliveryBoyReturnCollection(collectingAuditorReturn.id, {
        actualReceivedQuantity: actualReceivedQty,
        damagedQuantity: damagedQty,
        condition: returnCondition,
        notes: collectionNotes,
      });
      alert(`Return Order #${collectingAuditorReturn.id} physical collection confirmed! Batch stock restored successfully.`);
      setCollectingAuditorReturn(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm return collection');
    } finally {
      setSubmittingCollection(false);
    }
  };

  const activeOrders = orders.filter((o) => o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'CANCELLED');
  const completedOrders = orders.filter((o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED');

  const totalCODToCollect = activeOrders
    .filter((o) => o.orderType === 'QUICK' && o.orderStatus === 'OUT_FOR_DELIVERY')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-16">
      {/* Header Profile Card */}
      <div
        style={{
          backgroundColor: currentTheme.surfaceDark,
          borderColor: currentTheme.surfaceDarkBorder,
        }}
        className="border rounded-2xl p-5 text-white shadow-xl relative overflow-hidden"
      >
        <div
          style={{ backgroundColor: currentTheme.primary }}
          className="absolute right-0 top-0 w-32 h-32 opacity-10 rounded-full blur-2xl"
        ></div>
        <div className="flex items-center gap-3 relative z-10">
          <div
            style={{
              backgroundColor: currentTheme.primary,
              color: currentTheme.textOnPrimary,
            }}
            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow"
          >
            {deliveryBoy?.fullName?.charAt(0) || 'D'}
          </div>
          <div>
            <div
              style={{ color: currentTheme.primary }}
              className="text-[10px] font-bold uppercase tracking-wider"
            >
              Logistics Fleet Partner
            </div>
            <h2 className="text-base font-bold text-white">{deliveryBoy?.fullName || user?.name}</h2>
            <div className="text-[10px] text-slate-300 font-mono">
              ID: {deliveryBoy?.id || 'DB-ACTIVE'} • Area: {deliveryBoy?.assignedArea || 'Ranchi'}
            </div>
          </div>
        </div>

        {/* Live COD collected stat */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Banknote className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Cash in Hand (COD):</span>
          </div>
          <span className="font-mono font-black text-emerald-400 text-sm">₹{totalCODToCollect}</span>
        </div>
      </div>

      {/* Metrics mini grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Run</div>
          <div className="text-lg font-black text-slate-800 mt-1">{activeOrders.length}</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pickups</div>
          <div className="text-lg font-black text-indigo-600 mt-1">
            {returns.filter(r => r.status !== 'COMPLETED' && r.status !== 'REJECTED').length}
          </div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Done Today</div>
          <div className="text-lg font-black text-emerald-600 mt-1">{completedOrders.length}</div>
        </div>
      </div>

      {/* Active Deliveries Run list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1">
            <Package className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>Assigned Deliveries ({activeOrders.length})</span>
          </h3>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1 text-slate-500 hover:text-slate-800 transition rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-400 bg-white border rounded-xl">
            Syncing active fleet delivery run state...
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-xs">All Deliveries Done!</p>
            <p className="text-[10px] text-slate-400 mt-1">Check back later for new dispatches from Admin.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-mono font-black text-slate-900 text-xs block">{order.id}</span>
                    {(() => {
                      const dt = formatOrderDateTime(getOrderPreciseTimestamp(order));
                      return (
                        <div className="flex flex-col text-[10px] font-mono mt-1 leading-tight">
                          <div className="flex items-center gap-1 text-slate-700 font-semibold">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{dt.date}</span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-500 font-medium mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span>{dt.time || 'N/A'}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked Step
                    </span>
                    <StatusBadge status={order.orderStatus} />
                  </div>
                </div>

                {/* Kahan Pahucha Live Location */}
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <Navigation className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Kahan Pahucha: <strong className="text-indigo-900">{order.currentLocation || 'Warehouse Dispatch / In Route'}</strong></span>
                </div>

                {/* Customer Coordinates */}
                <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1.5 border border-slate-100/50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{order.customerName}</span>
                    <a
                      href={`tel:+91${order.customerMobile}`}
                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md font-mono font-black text-[11px] flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" /> Call Partner
                    </a>
                  </div>
                  <div className="text-slate-700 flex items-start gap-1 font-medium text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{order.deliveryAddress}</span>
                  </div>
                </div>

                {/* COD Cash to collect pill */}
                {order.orderType === 'QUICK' ? (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs flex justify-between items-center text-amber-900">
                    <span className="font-bold flex items-center gap-1"><Banknote className="w-4 h-4 text-amber-600 animate-pulse" /> Cash to Collect:</span>
                    <span className="font-mono font-black text-sm text-amber-800">₹{order.totalAmount}</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200 text-xs flex justify-between items-center text-purple-900">
                    <span className="font-semibold flex items-center gap-1"><CreditCard className="w-4 h-4 text-purple-600" /> Digital Pantry Card:</span>
                    <span className="font-bold text-xs text-purple-800">₹0 COD</span>
                  </div>
                )}

                {/* Items loop */}
                <div className="text-[10px] text-slate-500">
                  <strong className="text-slate-700 uppercase tracking-wider font-bold">Parcel:</strong> {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                </div>

                {/* Fail State Buttons */}
                {failingOrderId === order.id && (
                  <form onSubmit={handleMarkFailedSubmit} className="mt-2 p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-3">
                    <div className="text-xs font-bold text-rose-900 flex items-center gap-1">
                      <ShieldAlert className="w-4 h-4" /> State Delivery Failure Cause
                    </div>
                    <div>
                      <label className="block text-[10px] text-rose-700 font-bold mb-1">Select Reason</label>
                      <select
                        value={failureReason}
                        onChange={(e) => setFailureReason(e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-rose-300 rounded-lg focus:outline-none font-semibold text-slate-800"
                      >
                        <option value="Customer Not Available">Customer Not Available</option>
                        <option value="Rejected by Customer">Customer Rejected Delivery</option>
                        <option value="Wrong Address / Out of Area">Incorrect Delivery Address</option>
                        <option value="Phone Unreachable">Phone Unreachable / Switched Off</option>
                        <option value="Insufficient Cash / Change Issues">Insufficient Cash for COD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-rose-700 font-bold mb-1">Internal Remarks</label>
                      <input
                        type="text"
                        placeholder="Remarks (e.g. called 3 times, neighbor confirmed out of town)"
                        value={failureRemarks}
                        onChange={(e) => setFailureRemarks(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFailingOrderId(null)}
                        className="px-2.5 py-1 bg-white text-rose-700 border border-rose-300 rounded-lg text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
                      >
                        Confirm Failure
                      </button>
                    </div>
                  </form>
                )}

                {/* Handshakes & Actions (Rule 6) */}
                {failingOrderId !== order.id && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-50 gap-2">
                    {order.orderStatus === 'ASSIGNED' && (
                      <button
                        onClick={() => handleAcceptOrder(order.id)}
                        disabled={!!updatingId}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Lock &amp; Accept Delivery</span>
                      </button>
                    )}

                    {order.orderStatus === 'ACCEPTED' && (
                      <button
                        onClick={() => handleMarkOutForDelivery(order.id)}
                        disabled={!!updatingId}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Lock &amp; Start Run (Out For Delivery)</span>
                      </button>
                    )}

                    {order.orderStatus === 'OUT_FOR_DELIVERY' && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => setFailingOrderId(order.id)}
                          disabled={!!updatingId}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition flex items-center justify-center cursor-pointer"
                        >
                          Failed
                        </button>

                        <button
                          onClick={() => handleMarkDelivered(order.id)}
                          disabled={!!updatingId}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{order.orderType === 'QUICK' ? 'Lock & Confirm Cash Collected' : 'Lock & Confirm Handover'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Return Pickup Tasks Loop */}
      {returns.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider px-1 flex items-center gap-1">
            <RotateCcw className="w-4 h-4 text-rose-500" />
            <span>Assigned Return Pickups ({returns.length})</span>
          </h3>

          <div className="space-y-3">
            {returns.map((ret) => (
              <div key={ret.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-mono font-black text-slate-900 text-xs">{ret.id}</span>
                  <StatusBadge status={ret.status} />
                </div>

                <div className="bg-rose-50/50 p-2.5 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-slate-950">Return: {ret.productName} (Qty: {ret.quantity})</div>
                  <div>Customer: <strong>{ret.customerName}</strong> (ID: {ret.customerId})</div>
                  <div className="text-slate-600 font-medium">Reference Order ID: {ret.orderId}</div>
                </div>

                {/* Return Actions */}
                <div className="flex justify-end pt-1">
                  {ret.status === 'ASSIGNED' && (
                    <button
                      onClick={() => handleAcceptReturn(ret.id)}
                      disabled={!!updatingId}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Accept Return Pickup Request
                    </button>
                  )}

                  {ret.status === 'ACCEPTED' && (
                    <button
                      onClick={() => handleMarkReturnOut(ret.id)}
                      disabled={!!updatingId}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Mark Out for Pickup
                    </button>
                  )}

                  {ret.status === 'OUT_FOR_PICKUP' && (
                    <button
                      onClick={() => handleCompleteReturnPickup(ret.id)}
                      disabled={!!updatingId}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Complete Pickup &amp; Verify Item Count
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Replacement Handover Tasks Loop */}
      {replacements.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider px-1 flex items-center gap-1">
            <RefreshCw className="w-4 h-4 text-cyan-500 animate-spin-slow" />
            <span>Assigned Replacements ({replacements.length})</span>
          </h3>

          <div className="space-y-3">
            {replacements.map((rep) => (
              <div key={rep.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-mono font-black text-slate-900 text-xs">{rep.id}</span>
                  <StatusBadge status={rep.status} />
                </div>

                <div className="bg-cyan-50/50 p-2.5 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-slate-950">Replace: {rep.productName} (Qty: {rep.quantity})</div>
                  <div>Customer: <strong>{rep.customerName}</strong></div>
                  <div>Exchange original Batch: #{rep.originalBatchNumber} with replacement unit</div>
                </div>

                {/* Replacement Actions */}
                <div className="flex justify-end pt-1">
                  {rep.status === 'ASSIGNED' && (
                    <button
                      onClick={() => handleAcceptReplacement(rep.id)}
                      disabled={!!updatingId}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Accept Replacement Request
                    </button>
                  )}

                  {rep.status === 'ACCEPTED' && (
                    <button
                      onClick={() => handleMarkReplacementOut(rep.id)}
                      disabled={!!updatingId}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Mark Out for Replacement Delivery
                    </button>
                  )}

                  {rep.status === 'OUT_FOR_DELIVERY' && (
                    <button
                      onClick={() => handleCompleteReplacementDelivery(rep.id)}
                      disabled={!!updatingId}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Complete Handover of Fresh Unit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auditor Return Pickups Section */}
      {auditorReturns.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider px-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-purple-700">
              <RotateCcw className="w-4 h-4 text-purple-600 animate-pulse" />
              <span>Auditor Return Pickups ({auditorReturns.length})</span>
            </span>
          </h3>

          <div className="space-y-3">
            {auditorReturns.map((aud) => (
              <div key={aud.id} className="bg-white rounded-2xl border border-purple-200 p-4 space-y-3 shadow-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-purple-900 text-xs">#{aud.id}</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-mono px-2 py-0.5 rounded font-bold">
                      Batch #{aud.batchNumber}
                    </span>
                  </div>
                  <StatusBadge status={aud.status} />
                </div>

                <div className="bg-purple-50/60 p-3 rounded-xl text-xs space-y-1.5 border border-purple-100">
                  <div className="font-bold text-slate-900 text-sm">{aud.productName}</div>
                  <div className="text-slate-700">
                    Expected Return Qty: <strong className="text-purple-800 text-sm">{aud.returnQuantity} {aud.unit}</strong>
                  </div>
                  <div className="text-slate-600">
                    Customer: <strong>{aud.customerName}</strong> ({aud.customerMobile || 'No Mobile'})
                  </div>
                  <div className="text-slate-600 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{aud.customerAddress || 'Customer Pantry Address'}</span>
                  </div>
                  <div className="text-slate-500 text-[11px] pt-1 border-t border-purple-100/80">
                    Reason: <em>{aud.returnReason}</em>
                  </div>
                </div>

                {/* Pickup Actions */}
                <div className="pt-1">
                  {aud.stockRestored ? (
                    <div className="w-full py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl text-center border border-emerald-200 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Collected &amp; Stock Restored to Batch #{aud.batchNumber}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenCollectModal(aud)}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Boxes className="w-4 h-4" />
                      COLLECT RETURN FROM CUSTOMER
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DELIVERY BOY RETURN COLLECTION CONFIRMATION MODAL */}
      {collectingAuditorReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-purple-600" />
                Confirm Physical Return Collection
              </h3>
              <button
                onClick={() => setCollectingAuditorReturn(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAuditorCollection} className="space-y-4 text-xs">
              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm">
                  {collectingAuditorReturn.productName}
                </div>
                <div className="text-purple-800 font-mono text-xs">
                  Target Batch: #{collectingAuditorReturn.batchNumber}
                </div>
                <div className="text-slate-600">
                  Customer: <strong>{collectingAuditorReturn.customerName}</strong>
                </div>
                <div className="text-slate-700 font-bold mt-1">
                  Expected Return Qty: {collectingAuditorReturn.returnQuantity} {collectingAuditorReturn.unit}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Actual Physical Quantity Received *
                </label>
                <input
                  type="number"
                  min={0}
                  max={collectingAuditorReturn.returnQuantity * 2}
                  value={actualReceivedQty}
                  onChange={(e) => setActualReceivedQty(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Physical Condition *
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                >
                  <option value="GOOD">Good / Saleable (Restore to Stock)</option>
                  <option value="DAMAGED">Damaged / Non-saleable</option>
                  <option value="PARTIAL">Partial Return</option>
                  <option value="OTHER">Other Issue</option>
                </select>
              </div>

              {returnCondition === 'DAMAGED' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Damaged Quantity Count
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={actualReceivedQty}
                    value={damagedQty}
                    onChange={(e) => setDamagedQty(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <p className="text-[10px] text-amber-600 mt-1">
                    Good units ({Math.max(0, actualReceivedQty - damagedQty)}) will be restored to Batch #{collectingAuditorReturn.batchNumber}.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Collection Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="E.g., Goods received intact from customer, sealed package..."
                  value={collectionNotes}
                  onChange={(e) => setCollectionNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Confirming this collection will automatically restore physical stock to Batch #{collectingAuditorReturn.batchNumber} and update warehouse inventory logs.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCollectingAuditorReturn(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCollection}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {submittingCollection && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  CONFIRM RETURN RECEIVED
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
