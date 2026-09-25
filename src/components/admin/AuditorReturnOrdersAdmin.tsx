import React, { useState, useEffect } from 'react';
import { AuditorReturnOrder, DeliveryBoy, Auditor, ProductBatch } from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  XCircle,
  Truck,
  Clock,
  User,
  Package,
  Boxes,
  RefreshCw,
  Eye,
  FileText,
  ShieldCheck,
  X,
  Check,
  AlertTriangle,
  ArrowRight,
  Archive,
  Layers,
  Sparkles,
  DollarSign,
  Info,
} from 'lucide-react';

interface AuditorReturnOrdersAdminProps {
  initialStatusFilter?: string;
}

export const AuditorReturnOrdersAdmin: React.FC<AuditorReturnOrdersAdminProps> = ({
  initialStatusFilter,
}) => {
  const [returnOrders, setReturnOrders] = useState<AuditorReturnOrder[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Notification Toast Banner
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatusFilter || 'ALL');
  const [selectedAuditor, setSelectedAuditor] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<AuditorReturnOrder | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReasonCategory, setRejectReasonCategory] = useState('Product quantity mismatch');
  const [rejectCustomReason, setRejectCustomReason] = useState('');
  const [processingReject, setProcessingReject] = useState(false);

  // Assign Delivery Boy Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [selectedDeliveryBoyId, setSelectedDeliveryBoyId] = useState<string>('');
  const [processingAssign, setProcessingAssign] = useState(false);

  // Direct Warehouse Stock Restore Modal
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoringOrder, setRestoringOrder] = useState<AuditorReturnOrder | null>(null);
  const [actualReceivedQty, setActualReceivedQty] = useState<number>(1);
  const [damagedQty, setDamagedQty] = useState<number>(0);
  const [returnCondition, setReturnCondition] = useState<'GOOD' | 'DAMAGED' | 'PARTIAL' | 'OTHER'>('GOOD');
  const [restoreNotes, setRestoreNotes] = useState<string>('');
  const [targetBatchId, setTargetBatchId] = useState<string>('');
  const [processingRestore, setProcessingRestore] = useState(false);

  // Action Loading State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersList, dBoys, auds, batchesList] = await Promise.all([
        api.getAuditorReturnOrders(),
        api.getDeliveryBoys(),
        api.getAuditors(),
        api.getBatches().catch(() => []),
      ]);
      setReturnOrders(ordersList);
      setDeliveryBoys(dBoys.filter((d) => d.status === 'ACTIVE'));
      setAuditors(auds);
      setBatches(batchesList);
      if (dBoys.length > 0) setSelectedDeliveryBoyId(dBoys[0].id);
    } catch (err: any) {
      console.error('Error loading auditor return orders:', err);
      showToast('error', err.message || 'Failed to load return orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Accept Return
  const handleAcceptReturn = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      const updated = await api.acceptAuditorReturnOrder(orderId);
      showToast('success', `Return Order #${orderId} ACCEPTED successfully! Ready for Delivery Pickup or Warehouse Restoration.`);
      await fetchData();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to accept return order');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (orderId: string) => {
    setRejectingOrderId(orderId);
    setRejectReasonCategory('Product quantity mismatch');
    setRejectCustomReason('');
    setIsRejectModalOpen(true);
  };

  // Submit Reject
  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingOrderId) return;
    const finalReason = rejectCustomReason.trim()
      ? `${rejectReasonCategory}: ${rejectCustomReason.trim()}`
      : rejectReasonCategory;

    setProcessingReject(true);
    try {
      const updated = await api.rejectAuditorReturnOrder(rejectingOrderId, finalReason);
      showToast('info', `Return Order #${rejectingOrderId} REJECTED.`);
      setIsRejectModalOpen(false);
      setRejectingOrderId(null);
      await fetchData();
      if (selectedOrder && selectedOrder.id === rejectingOrderId) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reject return order');
    } finally {
      setProcessingReject(false);
    }
  };

  // Open Assign Modal
  const handleOpenAssignModal = (orderId: string) => {
    setAssigningOrderId(orderId);
    if (deliveryBoys.length > 0) setSelectedDeliveryBoyId(deliveryBoys[0].id);
    setIsAssignModalOpen(true);
  };

  // Submit Assign
  const handleSubmitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningOrderId || !selectedDeliveryBoyId) return;

    setProcessingAssign(true);
    try {
      const updated = await api.assignDeliveryBoyToAuditorReturn(assigningOrderId, selectedDeliveryBoyId);
      showToast('success', `Delivery Partner assigned to Return Order #${assigningOrderId} successfully!`);
      setIsAssignModalOpen(false);
      setAssigningOrderId(null);
      await fetchData();
      if (selectedOrder && selectedOrder.id === assigningOrderId) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to assign delivery partner');
    } finally {
      setProcessingAssign(false);
    }
  };

  // Open Direct Warehouse Restore Modal
  const handleOpenRestoreModal = (order: AuditorReturnOrder) => {
    setRestoringOrder(order);
    setActualReceivedQty(order.returnQuantity);
    setDamagedQty(0);
    setReturnCondition('GOOD');
    setRestoreNotes('');

    // Find default batch matching order
    const matchingBatch = batches.find(
      (b) => b.id === order.batchId || (order.batchNumber && b.batchNumber.toLowerCase() === order.batchNumber.toLowerCase())
    );
    if (matchingBatch) {
      setTargetBatchId(matchingBatch.id);
    } else {
      const prodBatch = batches.find((b) => b.productId === order.productId);
      setTargetBatchId(prodBatch?.id || '');
    }

    setIsRestoreModalOpen(true);
  };

  // Submit Direct Warehouse Restore
  const handleSubmitRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoringOrder) return;

    setProcessingRestore(true);
    try {
      const updated = await api.restoreAuditorReturnOrder(restoringOrder.id, {
        actualReceivedQuantity: Number(actualReceivedQty),
        damagedQuantity: Number(damagedQty),
        condition: returnCondition,
        notes: restoreNotes.trim() || 'Admin / Warehouse direct physical stock restoration',
        targetBatchId: targetBatchId || undefined,
      });

      const goodQty = Math.max(0, Number(actualReceivedQty) - Number(damagedQty));
      showToast(
        'success',
        `Stock Restored! ${goodQty} units restored to Batch #${updated.batchNumber || restoringOrder.batchNumber} in Warehouse.`
      );
      setIsRestoreModalOpen(false);
      setRestoringOrder(null);
      await fetchData();
      if (selectedOrder && selectedOrder.id === restoringOrder.id) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to restore stock to batch');
    } finally {
      setProcessingRestore(false);
    }
  };

  // Filtered List
  const filteredOrders = returnOrders.filter((o) => {
    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const match =
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.batchNumber.toLowerCase().includes(q) ||
        o.auditorName.toLowerCase().includes(q) ||
        (o.deliveryBoyName && o.deliveryBoyName.toLowerCase().includes(q)) ||
        (o.returnBillNumber && o.returnBillNumber.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Status Filter
    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'PENDING' && o.status !== 'PENDING') return false;
      if (selectedStatus === 'ACCEPTED' && o.status !== 'ACCEPTED') return false;
      if (selectedStatus === 'REJECTED' && o.status !== 'REJECTED') return false;
      if (selectedStatus === 'DELIVERY_ASSIGNED' && o.status !== 'DELIVERY_ASSIGNED') return false;
      if (selectedStatus === 'COLLECTED' && o.status !== 'COLLECTED' && o.status !== 'PARTIALLY_COLLECTED') return false;
      if (selectedStatus === 'RESTORED' && o.status !== 'RESTORED' && o.status !== 'COMPLETED') return false;
    }

    // Auditor Filter
    if (selectedAuditor !== 'ALL' && o.auditorId !== selectedAuditor) return false;

    // Customer Filter
    if (selectedCustomer !== 'ALL' && o.customerId !== selectedCustomer) return false;

    return true;
  });

  // Unique Customer list for filter
  const customerOptions = Array.from(
    new Set(returnOrders.map((o) => JSON.stringify({ id: o.customerId, name: o.customerName })))
  ).map((str) => JSON.parse(str));

  // Counts
  const pendingCount = returnOrders.filter((o) => o.status === 'PENDING').length;
  const acceptedCount = returnOrders.filter((o) => o.status === 'ACCEPTED' || o.status === 'DELIVERY_ASSIGNED').length;
  const collectedCount = returnOrders.filter((o) => o.status === 'COLLECTED' || o.status === 'PARTIALLY_COLLECTED').length;
  const completedCount = returnOrders.filter((o) => o.status === 'RESTORED' || o.status === 'COMPLETED').length;
  const rejectedCount = returnOrders.filter((o) => o.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
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
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-purple-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Auditor Return Order Management
            </h1>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                {pendingCount} Pending Approval
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Accept or reject auditor return requests, assign delivery boy for physical pickup, and confirm batch-wise warehouse stock restoration.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Orders
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setSelectedStatus('PENDING')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition ${
            selectedStatus === 'PENDING'
              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold mb-1">
            <span>Pending Approval</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-900">{pendingCount}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Needs Admin Action</div>
        </div>

        <div
          onClick={() => setSelectedStatus('ACCEPTED')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition ${
            selectedStatus === 'ACCEPTED'
              ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-400/30'
              : 'bg-white border-slate-200 hover:border-purple-400'
          }`}
        >
          <div className="flex items-center justify-between text-purple-700 text-xs font-bold mb-1">
            <span>Accepted / Assigned</span>
            <Truck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-purple-900">{acceptedCount}</div>
          <div className="text-[11px] text-purple-600 mt-0.5">Pickup in progress</div>
        </div>

        <div
          onClick={() => setSelectedStatus('COLLECTED')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition ${
            selectedStatus === 'COLLECTED'
              ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400/30'
              : 'bg-white border-slate-200 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between text-blue-700 text-xs font-bold mb-1">
            <span>Collected</span>
            <Boxes className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-blue-900">{collectedCount}</div>
          <div className="text-[11px] text-blue-600 mt-0.5">Received from customer</div>
        </div>

        <div
          onClick={() => setSelectedStatus('RESTORED')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition ${
            selectedStatus === 'RESTORED'
              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold mb-1">
            <span>Stock Restored</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-900">{completedCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Restored to Batch</div>
        </div>

        <div
          onClick={() => setSelectedStatus('REJECTED')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition ${
            selectedStatus === 'REJECTED'
              ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-400/30'
              : 'bg-white border-slate-200 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between text-rose-700 text-xs font-bold mb-1">
            <span>Rejected</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-900">{rejectedCount}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">Declined requests</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Return Order ID, Customer, Product, Batch, or Auditor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Dropdown Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="DELIVERY_ASSIGNED">Delivery Assigned</option>
              <option value="COLLECTED">Collected</option>
              <option value="RESTORED">Stock Restored / Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Auditor Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedAuditor}
              onChange={(e) => setSelectedAuditor(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
            >
              <option value="ALL">All Auditors</option>
              {auditors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
            >
              <option value="ALL">All Customers</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Quick Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider shrink-0">
            Quick Filter:
          </span>
          {['ALL', 'PENDING', 'ACCEPTED', 'DELIVERY_ASSIGNED', 'COLLECTED', 'RESTORED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer text-xs shrink-0 ${
                selectedStatus === st
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Orders' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600" />
            <p className="text-sm font-semibold">Loading Auditor Return Orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <RotateCcw className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-base font-bold text-slate-700">No Auditor Return Orders Found</p>
            <p className="text-xs text-slate-400">
              Try adjusting your search query or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Return Order ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Product &amp; Batch</th>
                  <th className="py-3 px-4 text-center">Return Qty</th>
                  <th className="py-3 px-4">Auditor</th>
                  <th className="py-3 px-4">Return Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Delivery Partner</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map((order) => {
                  const isActionBusy = actionLoadingId === order.id;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition">
                      {/* ID & Bill */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-bold text-slate-900 font-mono text-xs flex items-center gap-1.5">
                          <span>#{order.id}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Bill: <span className="font-mono text-purple-700 font-semibold">{order.returnBillNumber}</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-semibold text-slate-800">{order.customerName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{order.customerCode || order.customerId}</div>
                      </td>

                      {/* Product & Batch */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-bold text-slate-900">{order.productName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded font-mono font-semibold">
                            Batch #{order.batchNumber}
                          </span>
                          <span>• {order.sku}</span>
                        </div>
                      </td>

                      {/* Qty */}
                      <td className="py-3 px-4 align-top text-center">
                        <div className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-black text-sm">
                          {order.returnQuantity} {order.unit}
                        </div>
                        {order.actualReceivedQuantity !== undefined && order.actualReceivedQuantity > 0 && (
                          <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                            Rec'd: {order.actualReceivedQuantity}
                          </div>
                        )}
                      </td>

                      {/* Auditor */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-medium text-slate-800">{order.auditorName}</div>
                        <div className="text-[10px] text-slate-400">ID: {order.auditorId}</div>
                      </td>

                      {/* Return Date */}
                      <td className="py-3 px-4 align-top">
                        <div className="text-slate-700 font-medium">{order.returnDate}</div>
                        <div className="text-[10px] text-slate-400">Audit: {order.auditDate}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 align-top">
                        <StatusBadge status={order.status} />
                        {order.stockRestored && (
                          <div className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Stock Restored
                          </div>
                        )}
                      </td>

                      {/* Delivery Partner */}
                      <td className="py-3 px-4 align-top">
                        {order.deliveryBoyName ? (
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-amber-500" />
                              <span>{order.deliveryBoyName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">{order.deliveryBoyMobile}</div>
                          </div>
                        ) : order.status === 'REJECTED' ? (
                          <span className="text-[11px] text-slate-400 italic">Rejected</span>
                        ) : order.stockRestored ? (
                          <span className="text-[11px] text-emerald-600 font-semibold">Warehouse In-Ward</span>
                        ) : (
                          <button
                            onClick={() => handleOpenAssignModal(order.id)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[11px] transition cursor-pointer"
                          >
                            + Assign Partner
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 align-top text-right space-y-1">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* View Detail */}
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsDetailModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>

                          {/* Accept Button (PENDING status) */}
                          {order.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleAcceptReturn(order.id)}
                                disabled={isActionBusy}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Accept Return Order"
                              >
                                {isActionBusy ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Accept
                              </button>

                              <button
                                onClick={() => handleOpenRejectModal(order.id)}
                                disabled={isActionBusy}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Reject Return Order"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          )}

                          {/* Assign / Re-assign Partner */}
                          {(order.status === 'ACCEPTED' || order.status === 'DELIVERY_ASSIGNED') && (
                            <button
                              onClick={() => handleOpenAssignModal(order.id)}
                              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              {order.deliveryBoyId ? 'Re-assign' : 'Assign'}
                            </button>
                          )}

                          {/* Direct Warehouse Stock Restore Button */}
                          {!order.stockRestored && order.status !== 'REJECTED' && (
                            <button
                              onClick={() => handleOpenRestoreModal(order)}
                              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Directly receive and restore batch stock to warehouse"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              Restore Stock
                            </button>
                          )}

                          {/* Re-open / Accept if Rejected */}
                          {order.status === 'REJECTED' && (
                            <button
                              onClick={() => handleAcceptReturn(order.id)}
                              disabled={isActionBusy}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Re-Accept
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

      {/* DETAILED ORDER MODAL */}
      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900 text-white p-5 rounded-t-2xl flex items-center justify-between border-b border-slate-800 z-10">
              <div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-bold">Auditor Return Order #{selectedOrder.id}</h2>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bill No: <span className="font-mono text-purple-300 font-semibold">{selectedOrder.returnBillNumber}</span> • Created on {selectedOrder.createdAt}
                </p>
              </div>

              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* STATUS TIMELINE STEPPER */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                  Return Order Execution Timeline
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-[11px]">
                  {/* Step 1 */}
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold">
                    1. Return Created
                    <div className="text-[9px] font-normal text-emerald-700 mt-0.5">Auditor Logged</div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold">
                    2. Customer Confirmed
                    <div className="text-[9px] font-normal text-emerald-700 mt-0.5">Audit Verified</div>
                  </div>

                  {/* Step 3 */}
                  <div
                    className={`p-2 rounded-lg font-bold border ${
                      selectedOrder.adminApprovalStatus === 'ACCEPTED'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                        : selectedOrder.adminApprovalStatus === 'REJECTED'
                        ? 'bg-rose-100 text-rose-900 border-rose-200'
                        : 'bg-amber-100 text-amber-900 border-amber-200 animate-pulse'
                    }`}
                  >
                    3. Admin Approval
                    <div className="text-[9px] font-normal mt-0.5">{selectedOrder.adminApprovalStatus || 'PENDING'}</div>
                  </div>

                  {/* Step 4 */}
                  <div
                    className={`p-2 rounded-lg font-bold border ${
                      selectedOrder.deliveryBoyId
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                        : selectedOrder.adminApprovalStatus === 'REJECTED'
                        ? 'bg-slate-100 text-slate-400 border-slate-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    4. Delivery Partner
                    <div className="text-[9px] font-normal mt-0.5">
                      {selectedOrder.deliveryBoyName || 'Pending'}
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div
                    className={`p-2 rounded-lg font-bold border ${
                      selectedOrder.deliveryCollectionStatus === 'COLLECTED' || selectedOrder.deliveryCollectionStatus === 'PARTIALLY_COLLECTED'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    5. Product Collected
                    <div className="text-[9px] font-normal mt-0.5">{selectedOrder.deliveryCollectionStatus || 'Pending'}</div>
                  </div>

                  {/* Step 6 */}
                  <div
                    className={`p-2 rounded-lg font-bold border ${
                      selectedOrder.stockRestored
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    6. Stock Restored
                    <div className="text-[9px] font-normal mt-0.5">
                      {selectedOrder.stockRestored ? 'Batch Restored' : 'Pending'}
                    </div>
                  </div>

                  {/* Step 7 */}
                  <div
                    className={`p-2 rounded-lg font-bold border ${
                      selectedOrder.status === 'COMPLETED' || selectedOrder.status === 'RESTORED'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : selectedOrder.status === 'REJECTED'
                        ? 'bg-rose-600 text-white border-rose-700'
                        : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    7. Completed
                    <div className="text-[9px] font-normal mt-0.5">{selectedOrder.status}</div>
                  </div>
                </div>
              </div>

              {/* Grid Information Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Information */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-purple-600" />
                    Customer Information
                  </h4>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-900 text-sm">{selectedOrder.customerName}</p>
                    <p className="text-slate-600">ID: <span className="font-mono text-purple-700">{selectedOrder.customerCode || selectedOrder.customerId}</span></p>
                    <p className="text-slate-600">Mobile: {selectedOrder.customerMobile || 'N/A'}</p>
                    <p className="text-slate-600">Address: {selectedOrder.customerAddress || 'N/A'}</p>
                    {selectedOrder.originalOrderId && (
                      <p className="text-slate-600">Original Order: <span className="font-mono font-semibold">{selectedOrder.originalOrderId}</span></p>
                    )}
                  </div>
                </div>

                {/* Auditor Information */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" />
                    Auditor Information
                  </h4>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-900 text-sm">{selectedOrder.auditorName}</p>
                    <p className="text-slate-600">Auditor ID: <span className="font-mono">{selectedOrder.auditorId}</span></p>
                    <p className="text-slate-600">Audit Date: {selectedOrder.auditDate}</p>
                    <p className="text-slate-600">Return Bill No: <span className="font-mono font-bold text-purple-700">{selectedOrder.returnBillNumber}</span></p>
                  </div>
                </div>

                {/* Product Information */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-600" />
                    Product &amp; Batch Details
                  </h4>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-900 text-sm">{selectedOrder.productName}</p>
                    <p className="text-slate-600">
                      Target Batch: <span className="font-mono px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-bold">#{selectedOrder.batchNumber}</span>
                    </p>
                    <p className="text-slate-600">SKU / Size: {selectedOrder.sku}</p>
                    {selectedOrder.barcode && <p className="text-slate-600">Barcode: <span className="font-mono">{selectedOrder.barcode}</span></p>}
                    <p className="text-slate-600 font-bold text-amber-800">Return Qty: {selectedOrder.returnQuantity} {selectedOrder.unit}</p>
                  </div>
                </div>

                {/* Delivery & Physical Pickup Information */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-amber-600" />
                    Delivery Partner / Warehouse Status
                  </h4>
                  <div className="text-xs space-y-1">
                    {selectedOrder.deliveryBoyName ? (
                      <>
                        <p className="font-bold text-slate-900 text-sm">{selectedOrder.deliveryBoyName}</p>
                        <p className="text-slate-600">Mobile: {selectedOrder.deliveryBoyMobile || 'N/A'}</p>
                        <p className="text-slate-600">Assignment Date: {selectedOrder.deliveryAssignmentDate || selectedOrder.assignedAt || 'N/A'}</p>
                        {selectedOrder.collectedAt && <p className="text-slate-600">Collected At: {selectedOrder.collectedAt}</p>}
                        {selectedOrder.condition && (
                          <p className="text-slate-600">
                            Physical Condition: <span className="font-bold uppercase text-slate-900">{selectedOrder.condition}</span>
                          </p>
                        )}
                      </>
                    ) : selectedOrder.stockRestored ? (
                      <p className="text-emerald-700 font-semibold">Stock Restored to Warehouse Batch.</p>
                    ) : (
                      <p className="text-slate-400 italic">No Delivery Partner assigned yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Rejection Note (If Rejected) */}
              {selectedOrder.status === 'REJECTED' && selectedOrder.rejectionReason && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Admin Rejection Reason
                  </h4>
                  <p className="text-xs text-rose-900">{selectedOrder.rejectionReason}</p>
                  <p className="text-[10px] text-rose-600 mt-1">
                    Rejected by {selectedOrder.rejectedBy} on {selectedOrder.rejectedAt}
                  </p>
                </div>
              )}

              {/* Audit Trail Log */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Full Audit Trail &amp; System Logs
                </h3>
                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono max-h-48 overflow-y-auto space-y-2">
                  {selectedOrder.auditTrail && selectedOrder.auditTrail.length > 0 ? (
                    selectedOrder.auditTrail.map((log) => (
                      <div key={log.id} className="border-b border-slate-800 pb-2 last:border-b-0">
                        <div className="flex items-center justify-between text-purple-400 font-bold">
                          <span>[{log.action}] by {log.user} ({log.role})</span>
                          <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                        </div>
                        <p className="text-slate-300 mt-0.5">{log.notes}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic">No audit trail entries recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-50 p-4 rounded-b-2xl border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedOrder.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleOpenRejectModal(selectedOrder.id)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Reject Return
                    </button>
                    <button
                      onClick={() => handleAcceptReturn(selectedOrder.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Accept Return
                    </button>
                  </>
                )}

                {(selectedOrder.status === 'ACCEPTED' || selectedOrder.status === 'DELIVERY_ASSIGNED') && (
                  <button
                    onClick={() => handleOpenAssignModal(selectedOrder.id)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Truck className="w-4 h-4" />
                    {selectedOrder.deliveryBoyId ? 'Re-assign Delivery Partner' : 'Assign Delivery Partner'}
                  </button>
                )}

                {!selectedOrder.stockRestored && selectedOrder.status !== 'REJECTED' && (
                  <button
                    onClick={() => handleOpenRestoreModal(selectedOrder)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Archive className="w-4 h-4" />
                    Restore Stock to Batch
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT RETURN MODAL */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Reject Return Order #{rejectingOrderId}
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
                  Select Rejection Reason Category *
                </label>
                <select
                  value={rejectReasonCategory}
                  onChange={(e) => setRejectReasonCategory(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                >
                  <option value="Product quantity mismatch">Product quantity mismatch</option>
                  <option value="Wrong batch">Wrong batch number</option>
                  <option value="Damaged product">Damaged / Non-returnable condition</option>
                  <option value="Invalid return">Invalid return request</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Notes / Remarks (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide specific justification for rejecting this return..."
                  value={rejectCustomReason}
                  onChange={(e) => setRejectCustomReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingReject}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  {processingReject && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN DELIVERY BOY MODAL */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600" />
                Assign Delivery Partner for Return Pickup
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Active Delivery Partner *
                </label>
                {deliveryBoys.length === 0 ? (
                  <p className="text-xs text-rose-600 font-semibold p-3 bg-rose-50 rounded-lg">
                    No active Delivery Partners found in system. Please register a Delivery Partner first.
                  </p>
                ) : (
                  <select
                    value={selectedDeliveryBoyId}
                    onChange={(e) => setSelectedDeliveryBoyId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  >
                    {deliveryBoys.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.mobile}) — Vehicle: {d.vehicleNumber || 'Bike'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingAssign || deliveryBoys.length === 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  {processingAssign && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Assign Delivery Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIRECT WAREHOUSE STOCK RESTORE MODAL */}
      {isRestoreModalOpen && restoringOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Archive className="w-5 h-5 text-purple-600" />
                Warehouse Stock Restoration #{restoringOrder.id}
              </h3>
              <button
                onClick={() => setIsRestoreModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Return Order Summary Card */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-1 text-xs">
              <div className="flex justify-between font-bold text-purple-950">
                <span>{restoringOrder.productName}</span>
                <span>Expected: {restoringOrder.returnQuantity} {restoringOrder.unit}</span>
              </div>
              <div className="text-purple-700 flex items-center justify-between">
                <span>Customer: <strong>{restoringOrder.customerName}</strong></span>
                <span>Batch: <strong className="font-mono">#{restoringOrder.batchNumber}</strong></span>
              </div>
              <div className="text-purple-600 text-[11px]">
                Auditor: {restoringOrder.auditorName} • Bill: {restoringOrder.returnBillNumber}
              </div>
            </div>

            <form onSubmit={handleSubmitRestore} className="space-y-4">
              {/* Target Batch Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination Warehouse Batch *
                </label>
                <select
                  value={targetBatchId}
                  onChange={(e) => setTargetBatchId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white font-mono"
                >
                  {batches
                    .filter((b) => b.productId === restoringOrder.productId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        Batch #{b.batchNumber} (Current Stock: {b.availableQuantity} {restoringOrder.unit}) - Exp: {b.expiryDate}
                      </option>
                    ))}
                  {batches.filter((b) => b.productId === restoringOrder.productId).length === 0 && (
                    <option value="">Default Batch #{restoringOrder.batchNumber}</option>
                  )}
                </select>
              </div>

              {/* Quantities Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Actual Received Qty *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={actualReceivedQty}
                    onChange={(e) => setActualReceivedQty(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Damaged / Unusable Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={actualReceivedQty}
                    value={damagedQty}
                    onChange={(e) => setDamagedQty(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Restored Good Quantity Highlight */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-900">Good Stock to Restore:</span>
                  <p className="text-[11px] text-emerald-700">Will be added directly to warehouse batch inventory</p>
                </div>
                <div className="text-xl font-black text-emerald-900">
                  +{Math.max(0, actualReceivedQty - damagedQty)} {restoringOrder.unit}
                </div>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physical Condition Assessment *
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                >
                  <option value="GOOD">GOOD - Sealed &amp; Resellable</option>
                  <option value="DAMAGED">DAMAGED - Broken / Leaked</option>
                  <option value="PARTIAL">PARTIAL - Partial Units Good</option>
                  <option value="OTHER">OTHER - Special Handling</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Warehouse Notes / Verification Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Verified seals intact, restored to warehouse rack A-2..."
                  value={restoreNotes}
                  onChange={(e) => setRestoreNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRestoreModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingRestore}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  {processingRestore && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm &amp; Restore Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
