import React, { useState, useEffect } from 'react';
import { Order, AuditorCheck, AuditLog } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import { AuditBillModal } from '../common/AuditBillModal';
import { CustomerBillModal } from '../admin/CustomerBillModal';
import {
  ShoppingBag,
  CreditCard,
  Truck,
  Calendar,
  Package,
  MapPin,
  RefreshCw,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ClipboardCheck,
  UserCheck,
  Activity,
  Phone,
  AlertCircle,
  FileText,
  Lock,
  Eye,
  Receipt,
  Download,
} from 'lucide-react';
import { parseOrderDate, formatOrderDateTime, getOrderPreciseTimestamp } from '../../utils/dateTimeUtils';

export const CustomerOrdersHistory: React.FC = () => {
  const { customer, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [audits, setAudits] = useState<AuditorCheck[]>([]);
  const [myLogs, setMyLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'AUDITS' | 'LOGS'>('ORDERS');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PANTRY' | 'QUICK'>('ALL');
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [selectedAuditForView, setSelectedAuditForView] = useState<AuditorCheck | null>(null);
  const [selectedOrderForBill, setSelectedOrderForBill] = useState<Order | null>(null);

  const fetchData = async (isSilent = false) => {
    if (!customer) return;
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const [orderList, auditList, allLogs] = await Promise.all([
        api.getOrders({ customerId: customer.id }),
        api.getAuditorChecks(customer.id),
        api.getAuditLogs().catch(() => []),
      ]);
      setOrders(orderList);
      setAudits(auditList);

      // Filter customer logs
      const userMobile = customer.mobile || user?.mobile || '';
      const filteredLogs = allLogs.filter(
        (l) =>
          l.userMobile === userMobile ||
          l.who === customer.fullName ||
          l.entityId === customer.id ||
          (l.role === 'CUSTOMER' && l.who === user?.name)
      );
      setMyLogs(filteredLogs);
    } catch (err) {
      console.error('Error fetching customer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = api.subscribeRealtime(() => {
      fetchData(true);
    });
    return () => unsubscribe();
  }, [customer?.id]);

  const handleGrantPermission = async (auditId: string) => {
    setGrantingId(auditId);
    try {
      await api.confirmAuditByCustomer(auditId);
      alert('Auditor Inspection Permission granted successfully! The auditor can now review items and generate the audit bill.');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to grant permission');
    } finally {
      setGrantingId(null);
    }
  };

  const handleConfirmAuditBill = async (auditId: string): Promise<AuditorCheck | void> => {
    try {
      const updated = await api.confirmAuditBill(auditId);
      alert('Audit Settlement Bill confirmed and locked successfully!');
      fetchData();
      return updated;
    } catch (err: any) {
      alert(err.message || 'Failed to confirm bill.');
    }
  };

  const handleDisputeAuditBill = async (auditId: string, remarks: string): Promise<AuditorCheck | void> => {
    try {
      const updated = await api.disputeAuditBill(auditId, remarks);
      alert('Audit Settlement Bill marked as Disputed. The Field Auditor and Admin have been notified.');
      fetchData();
      return updated;
    } catch (err: any) {
      alert(err.message || 'Failed to submit dispute.');
    }
  };

  const filteredOrders = orders
    .filter((o) => {
      if (activeFilter === 'PANTRY') return o.orderType === 'PANTRY';
      if (activeFilter === 'QUICK') return o.orderType === 'QUICK';
      return true;
    })
    .sort((a, b) => {
      const tsA = getOrderPreciseTimestamp(a);
      const tsB = getOrderPreciseTimestamp(b);
      const dateA = parseOrderDate(tsA);
      const dateB = parseOrderDate(tsB);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

  const pendingPermissionAudits = audits.filter(
    (a) => !a.isPermissionGranted && a.status !== 'CUSTOMER_CONFIRMED' && !a.customerConfirmedAt
  );

  return (
    <div className="space-y-6">
      {/* Pending Permission Notice Banner */}
      {pendingPermissionAudits.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white p-5 rounded-2xl shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-100 animate-bounce" />
              <h3 className="font-bold text-base">Auditor Inspection Permission Required</h3>
            </div>
            <span className="bg-amber-950/40 text-amber-100 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/30">
              {pendingPermissionAudits.length} Action Needed
            </span>
          </div>

          <p className="text-xs text-amber-100 leading-relaxed">
            An official auditor has requested to conduct a physical pantry verification visit. Your explicit permission is required before the auditor can inspect items or generate your audit settlement bill.
          </p>

          <div className="space-y-2 pt-1">
            {pendingPermissionAudits.map((a) => (
              <div
                key={a.id}
                className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>Request #{a.id}</span>
                    <span className="bg-white text-amber-900 font-extrabold text-[10px] px-2 py-0.5 rounded">
                      Scheduled: {a.requestedDate} {a.requestedTime}
                    </span>
                  </div>
                  <div className="text-amber-100 text-[11px] mt-0.5">
                    Auditor: <strong>{a.auditorName}</strong> • Purpose: {a.purpose || 'Routine Physical Verification'}
                  </div>
                </div>

                <button
                  onClick={() => handleGrantPermission(a.id)}
                  disabled={grantingId === a.id}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {grantingId === a.id ? 'Granting...' : 'CONFIRM & GRANT AUDITOR PERMISSION'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ORDERS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            My Orders ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab('AUDITS')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'AUDITS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-purple-600" />
            Auditor Permissions ({audits.length})
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'LOGS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4 text-blue-600" />
            My Activity History ({myLogs.length})
          </button>
        </div>

        {activeTab === 'ORDERS' && (
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter('PANTRY')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeFilter === 'PANTRY' ? 'bg-purple-600 text-white' : 'text-slate-600'
              }`}
            >
              Pantry Card
            </button>
            <button
              onClick={() => setActiveFilter('QUICK')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeFilter === 'QUICK' ? 'bg-amber-600 text-white' : 'text-slate-600'
              }`}
            >
              Quick COD
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: ORDERS LIST */}
      {activeTab === 'ORDERS' && (
        loading ? (
          <div className="py-12 text-center text-slate-400">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No orders placed yet</p>
            <p className="text-xs text-slate-400 mt-1">Browse groceries to place your first order!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4"
              >
                {/* Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="font-mono font-bold text-slate-900 text-base">{order.id}</div>
                    {order.orderType === 'PANTRY' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        <CreditCard className="w-3.5 h-3.5" /> Pantry Card (0 COD)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <ShoppingBag className="w-3.5 h-3.5" /> Quick Order (Cash COD)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {(() => {
                      const dt = formatOrderDateTime(getOrderPreciseTimestamp(order));
                      return (
                        <div className="flex flex-col items-end text-right font-mono leading-tight">
                          <span className="flex items-center gap-1 text-slate-700 font-bold text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{dt.date}</span>
                          </span>
                          <span className="flex items-center gap-1 text-slate-500 font-medium text-[11px] mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span>{dt.time || 'N/A'}</span>
                          </span>
                        </div>
                      );
                    })()}
                    <StatusBadge status={order.orderStatus} />
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Ordered Items ({order.items.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 text-xs"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0">
                          <img
                            src={item.image}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {item.productName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            Qty: {item.quantity} {item.weightSize ? `• ${item.weightSize}` : ''}
                          </div>
                          <div className="font-bold text-slate-800 text-xs">
                            ₹{item.price * item.quantity}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 bg-slate-50/50 p-3 rounded-xl">
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-md">{order.deliveryAddress}</span>
                    </div>
                    {order.assignedDeliveryBoyName && (
                      <div className="flex items-center gap-1.5 text-blue-700 font-medium">
                        <Truck className="w-3.5 h-3.5 shrink-0" />
                        <span>Delivery Partner: <strong>{order.assignedDeliveryBoyName}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total Order Value</div>
                    <div className="text-xl font-extrabold text-slate-900">₹{order.totalAmount}</div>
                    <div className="text-[11px] font-semibold text-emerald-700">
                      Payment: {order.paymentStatus}
                    </div>
                  </div>
                </div>

                {/* Bill Download & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                  <div className="text-[11px] text-slate-500 font-mono">
                    Bill Ref: <strong className="text-slate-800">{order.billNumber || `INV-${order.id}`}</strong>
                  </div>
                  <button
                    onClick={() => setSelectedOrderForBill(order)}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
                    title="View bill and download official PDF copy"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>View & Download Bill (PDF)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB 2: AUDITOR PERMISSIONS LIST */}
      {activeTab === 'AUDITS' && (
        <div className="space-y-4">
          {audits.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No Auditor Inspections Requested</p>
              <p className="text-xs text-slate-400 mt-1">Field audit requests scheduled by auditors will appear here for your confirmation.</p>
            </div>
          ) : (
            audits.map((a) => {
              const isGranted = a.isPermissionGranted || a.status === 'CUSTOMER_CONFIRMED' || !!a.customerConfirmedAt;

              return (
                <div
                  key={a.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span>Audit Verification #{a.id}</span>
                        {isGranted ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Permission Granted
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-600" /> Permission Pending
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Scheduled Date: <strong>{a.requestedDate}</strong> {a.requestedTime} • Auditor: <strong>{a.auditorName}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isGranted && (
                        <button
                          onClick={() => handleGrantPermission(a.id)}
                          disabled={grantingId === a.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <UserCheck className="w-4 h-4" />
                          {grantingId === a.id ? 'Granting...' : 'Grant Auditor Permission'}
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedAuditForView(a)}
                        className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-purple-200" />
                        <span>View Settlement Bill Details</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Audit Status</span>
                      <span className="font-bold text-slate-900">{a.status}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Permission Timestamp</span>
                      <span className="font-mono font-bold text-slate-900">
                        {a.customerConfirmedAt || 'Not Granted Yet'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Items Inspected</span>
                      <span className="font-bold text-slate-900">{a.totalItemsCount || 0} items</span>
                    </div>
                    <div
                      className="cursor-pointer group hover:bg-purple-50/50 p-1 rounded transition"
                      onClick={() => setSelectedAuditForView(a)}
                    >
                      <span className="text-slate-400 block text-[10px]">Settlement Bill (Click to View)</span>
                      <div className="font-bold text-purple-700 group-hover:text-purple-900 underline flex items-center gap-1 mt-0.5">
                        <Eye className="w-3 h-3 text-purple-600 inline" />
                        <span>{a.billId || 'View Bill Details'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: CUSTOMER TIMESTAMPED ACTIVITY LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Customer Personal Activity &amp; Audit Log History</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono font-bold">{myLogs.length} Trace Records</span>
          </div>

          {myLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">No activity records recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Reference ID</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {log.timestamp || `${log.date || ''} ${log.time || ''}`}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700 whitespace-nowrap">
                        {log.action.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 font-bold whitespace-nowrap">
                        {log.entityId || log.entity || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {log.details || log.newValue || log.reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW AUDIT REPORT MODAL */}
      {selectedAuditForView && (
        <AuditBillModal
          audit={selectedAuditForView}
          onClose={() => setSelectedAuditForView(null)}
          onConfirmBill={handleConfirmAuditBill}
          onDisputeBill={handleDisputeAuditBill}
          isCustomerView={true}
        />
      )}

      {/* VIEW & DOWNLOAD ORDER BILL MODAL */}
      {selectedOrderForBill && (
        <CustomerBillModal
          order={selectedOrderForBill}
          onClose={() => setSelectedOrderForBill(null)}
        />
      )}
    </div>
  );
};
