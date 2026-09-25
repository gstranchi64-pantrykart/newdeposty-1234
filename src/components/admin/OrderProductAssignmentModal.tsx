import React, { useState, useEffect } from 'react';
import { Order, ProductBatch, Product } from '../../types';
import { api } from '../../services/api';
import { CustomerBillModal } from './CustomerBillModal';
import { WarehousePackingSlipModal } from './WarehousePackingSlipModal';
import {
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  Package,
  Layers,
  FileText,
  Printer,
  ShieldAlert,
  Clock,
  Sparkles,
  X,
  Truck,
  ArrowRight,
  RefreshCw,
  Box,
  Calendar,
  Store,
  Barcode,
} from 'lucide-react';

interface OrderProductAssignmentModalProps {
  order: Order;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: Order) => void;
}

export const OrderProductAssignmentModal: React.FC<OrderProductAssignmentModalProps> = ({
  order: initialOrder,
  onClose,
  onOrderUpdated,
}) => {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [batchesByProduct, setBatchesByProduct] = useState<Record<string, ProductBatch[]>>({});
  const [loadingBatches, setLoadingBatches] = useState(true);

  // Staged batch selections: map of itemIndex -> batchId
  const [stagedAssignments, setStagedAssignments] = useState<Record<number, string>>({});
  const [submittingLock, setSubmittingLock] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirmLockDialog, setShowConfirmLockDialog] = useState(false);

  // Modals for Bill and Packing Slip
  const [showCustomerBillModal, setShowCustomerBillModal] = useState(false);
  const [showPackingSlipModal, setShowPackingSlipModal] = useState(false);
  const [generatingBill, setGeneratingBill] = useState(false);
  const [markingPacked, setMarkingPacked] = useState(false);

  // Fetch available batches for all products in this order
  useEffect(() => {
    let isMounted = true;
    const loadBatches = async () => {
      setLoadingBatches(true);
      try {
        const uniqueProductIds = Array.from(new Set(order.items.map((i) => i.productId)));
        const batchMap: Record<string, ProductBatch[]> = {};

        await Promise.all(
          uniqueProductIds.map(async (pId) => {
            const batches = await api.getBatchesByProduct(pId);
            batchMap[pId] = batches || [];
          })
        );

        if (isMounted) {
          setBatchesByProduct(batchMap);

          // Pre-populate staged assignments from existing item assignments if any
          const initialStaged: Record<number, string> = {};
          order.items.forEach((item, index) => {
            if (item.assignedBatchId) {
              initialStaged[index] = item.assignedBatchId;
            } else if (item.batchId) {
              initialStaged[index] = item.batchId;
            }
          });
          setStagedAssignments(initialStaged);
        }
      } catch (err: any) {
        if (isMounted) setActionError(err.message || 'Failed to fetch inventory batches.');
      } finally {
        if (isMounted) setLoadingBatches(false);
      }
    };

    loadBatches();
    return () => {
      isMounted = false;
    };
  }, [order.id]);

  const isLocked = order.assignmentStatus === 'ASSIGNED_AND_LOCKED';

  // Handle batch selection change for an item row
  const handleSelectBatch = (itemIndex: number, batchId: string) => {
    if (isLocked) return;
    setStagedAssignments((prev) => ({
      ...prev,
      [itemIndex]: batchId,
    }));
    setActionError(null);
  };

  // Auto FEFO selection helper
  const handleAutoFefoAssign = () => {
    if (isLocked) return;
    const newStaged: Record<number, string> = { ...stagedAssignments };

    order.items.forEach((item, idx) => {
      const productBatches = batchesByProduct[item.productId] || [];
      // Filter unexpired and sufficient stock batches
      const candidates = productBatches
        .filter((b) => {
          const isNotExpired = new Date(b.expiryDate).getTime() >= new Date().getTime();
          return isNotExpired && b.availableQuantity >= item.quantity;
        })
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

      if (candidates.length > 0) {
        newStaged[idx] = candidates[0].id;
      }
    });

    setStagedAssignments(newStaged);
  };

  // Check readiness to confirm and lock
  const validateAssignments = (): { valid: boolean; reason?: string } => {
    for (let idx = 0; idx < order.items.length; idx++) {
      const item = order.items[idx];
      const batchId = stagedAssignments[idx];

      if (!batchId) {
        return {
          valid: false,
          reason: `Product "${item.productName}" has no batch assigned.`,
        };
      }

      const productBatches = batchesByProduct[item.productId] || [];
      const batch = productBatches.find((b) => b.id === batchId);

      if (!batch) {
        return {
          valid: false,
          reason: `Assigned batch for "${item.productName}" not found in current inventory.`,
        };
      }

      const isExpired = new Date(batch.expiryDate).getTime() < new Date().getTime();
      if (isExpired) {
        return {
          valid: false,
          reason: `Batch ${batch.batchNumber} for "${item.productName}" is expired (${batch.expiryDate}).`,
        };
      }

      if (batch.availableQuantity < item.quantity) {
        return {
          valid: false,
          reason: `Batch ${batch.batchNumber} for "${item.productName}" has only ${batch.availableQuantity} available units (need ${item.quantity}).`,
        };
      }
    }
    return { valid: true };
  };

  const validationResult = validateAssignments();

  // Execute confirm and lock
  const handleConfirmAndLock = async () => {
    if (!validationResult.valid) {
      setActionError(validationResult.reason || 'Invalid batch assignments.');
      return;
    }

    setSubmittingLock(true);
    setActionError(null);

    try {
      const payloadAssignments = Object.entries(stagedAssignments).map(([idxStr, bId]) => ({
        itemIndex: Number(idxStr),
        batchId: bId,
      }));

      const updated = await api.confirmAndLockOrderAssignment(order.id, payloadAssignments);
      setOrder(updated);
      onOrderUpdated(updated);
      setShowConfirmLockDialog(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to confirm and lock product assignment.');
    } finally {
      setSubmittingLock(false);
    }
  };

  // Generate Bill action
  const handleGenerateBill = async () => {
    setGeneratingBill(true);
    setActionError(null);
    try {
      const updated = await api.generateOrderBill(order.id);
      setOrder(updated);
      onOrderUpdated(updated);
      setShowCustomerBillModal(true);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate bill.');
    } finally {
      setGeneratingBill(false);
    }
  };

  // Mark Packed action
  const handleMarkPacked = async () => {
    setMarkingPacked(true);
    setActionError(null);
    try {
      const updated = await api.markOrderPacked(order.id);
      setOrder(updated);
      onOrderUpdated(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to mark order as packed.');
    } finally {
      setMarkingPacked(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isLocked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
              {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black tracking-tight">
                  Admin Product & Batch Assignment
                </h2>
                <span
                  className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                    isLocked
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {isLocked ? '🔒 Assigned & Locked' : 'Pending Assignment'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span>Order Ref: <strong className="font-mono text-white">{order.id}</strong></span>
                <span>•</span>
                <span>Customer: <strong className="text-white">{order.customerName}</strong></span>
                <span>•</span>
                <span className="font-semibold text-purple-300">
                  {order.orderType === 'PANTRY' ? 'Pantry Card Order' : 'Quick COD Order'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Business Logic Workflow Stepper Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            {/* Step 1: Order Created */}
            <div className="flex items-center gap-1.5 justify-center py-1 text-slate-500 font-medium">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center">
                ✓
              </span>
              <span className="truncate">1. Order Created</span>
            </div>

            {/* Step 2: Batch Assignment & Lock */}
            <div
              className={`flex items-center gap-1.5 justify-center py-1 font-bold ${
                isLocked ? 'text-emerald-700' : 'text-indigo-700 bg-indigo-50 px-2 rounded-lg'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                  isLocked ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-600 text-white'
                }`}
              >
                {isLocked ? '✓' : '2'}
              </span>
              <span className="truncate">2. Batch Assign & Lock</span>
            </div>

            {/* Step 3: Batch Stock Deduct */}
            <div
              className={`flex items-center gap-1.5 justify-center py-1 ${
                isLocked ? 'text-emerald-700 font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                  isLocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isLocked ? '✓' : '3'}
              </span>
              <span className="truncate">3. Stock Deducted</span>
            </div>

            {/* Step 4: Bill Generation */}
            <div
              className={`flex items-center gap-1.5 justify-center py-1 ${
                order.billNumber ? 'text-emerald-700 font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                  order.billNumber ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {order.billNumber ? '✓' : '4'}
              </span>
              <span className="truncate">4. Bill Generate</span>
            </div>

            {/* Step 5: Packing & Delivery */}
            <div
              className={`flex items-center gap-1.5 justify-center py-1 ${
                order.packingStatus === 'PACKED' ? 'text-emerald-700 font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                  order.packingStatus === 'PACKED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {order.packingStatus === 'PACKED' ? '✓' : '5'}
              </span>
              <span className="truncate">5. Pack & Deliver</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Locked Notice Banner */}
          {isLocked ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-emerald-950">
                    Product Assignment Locked & Inventory Deducted
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Locked by <strong>{order.assignmentLockedBy || 'Admin'}</strong> on{' '}
                    {order.assignmentLockedAt
                      ? new Date(order.assignmentLockedAt).toLocaleString('en-IN')
                      : 'Recently'}
                    . Batch stock has been atomically deducted from warehouse inventory.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowCustomerBillModal(true)}
                  className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-900 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>Customer Bill</span>
                </button>
                <button
                  onClick={() => setShowPackingSlipModal(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Warehouse Slip</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-amber-950">
                  Select Actual Warehouse Batch for Each Product
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Stock deduction is currently suspended. Select the physical batch you are packing. Once you click Confirm & Lock, batch quantities will be deducted immediately.
                </p>
              </div>
              <button
                onClick={handleAutoFefoAssign}
                disabled={loadingBatches}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Auto Select FEFO Batches</span>
              </button>
            </div>
          )}

          {/* Ordered Products & Batch Assignment Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                  Ordered Products ({order.items.length} items)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Total Order Value: <strong className="text-slate-900">₹{order.totalAmount}</strong>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500">
                  Delivery Address: <strong className="text-slate-800">{order.deliveryAddress}</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Product Details</th>
                    <th className="py-3 px-3 text-center">Ordered Qty</th>
                    <th className="py-3 px-4">Actual Batch / Inventory Selection</th>
                    <th className="py-3 px-3 text-center">Stock Status</th>
                    <th className="py-3 px-3 text-center">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item, idx) => {
                    const productBatches = batchesByProduct[item.productId] || [];
                    const selectedBatchId = stagedAssignments[idx] || item.assignedBatchId || item.batchId;
                    const selectedBatch = productBatches.find((b) => b.id === selectedBatchId);

                    const isAssigned = Boolean(selectedBatchId && selectedBatch);
                    const isSufficient = selectedBatch ? selectedBatch.availableQuantity >= item.quantity : false;
                    const isExpired = selectedBatch ? new Date(selectedBatch.expiryDate).getTime() < new Date().getTime() : false;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        {/* Product Info */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.productName}
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                              />
                            )}
                            <div>
                              <p className="font-extrabold text-slate-900 text-xs">
                                {item.productName}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                {item.brand && (
                                  <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                                    {item.brand}
                                  </span>
                                )}
                                {item.weightSize && <span>{item.weightSize}</span>}
                                {item.barcode && (
                                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 inline-flex items-center gap-1">
                                    <Barcode className="w-3 h-3 text-slate-500" />
                                    <span>{item.barcode}</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px]">
                                <span className="font-black text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  MRP: ₹{item.mrp || selectedBatch?.mrp || item.price}
                                </span>
                                <span className="text-slate-500 font-medium">Price: ₹{item.price}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Ordered Quantity */}
                        <td className="py-3 px-3 text-center">
                          <span className="font-black text-slate-900 text-sm bg-slate-100 px-2 py-1 rounded-md">
                            {item.quantity}
                          </span>
                        </td>

                        {/* Batch Selector */}
                        <td className="py-3 px-4 min-w-[260px]">
                          {isLocked ? (
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 font-mono text-xs">
                                  Batch #{item.assignedBatchNumber || item.batchNumber}
                                </span>
                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                                  LOCKED
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-800 font-bold flex items-center gap-1">
                                <Store className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>Shopkeeper: <strong className="text-indigo-950">{item.shopkeeperName || selectedBatch?.shopkeeperName || 'Vendor'}</strong></span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5 border-t border-slate-200">
                                <span className="font-black text-purple-900 font-mono text-[11px]">
                                  MRP: ₹{item.mrp || selectedBatch?.mrp || item.price}
                                </span>
                                <span>Exp: {item.expiryDate || 'N/A'} • Deducted: {item.quantity}</span>
                              </div>
                              {item.inventoryTransactionId && (
                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                  Txn: {item.inventoryTransactionId}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <select
                                value={selectedBatchId || ''}
                                onChange={(e) => handleSelectBatch(idx, e.target.value)}
                                disabled={loadingBatches}
                                className="w-full text-xs font-medium border border-slate-300 rounded-xl px-2.5 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              >
                                <option value="">-- Select Actual Batch --</option>
                                {productBatches.map((b) => {
                                  const expired = new Date(b.expiryDate).getTime() < new Date().getTime();
                                  return (
                                    <option
                                      key={b.id}
                                      value={b.id}
                                      disabled={expired || b.availableQuantity === 0}
                                    >
                                      Batch #{b.batchNumber} • Shopkeeper: {b.shopkeeperName} • MRP: ₹{b.mrp} (Avail: {b.availableQuantity}, Exp: {b.expiryDate})
                                      {expired ? ' [EXPIRED]' : ''}
                                      {b.availableQuantity < item.quantity ? ' [LOW STOCK]' : ''}
                                    </option>
                                  );
                                })}
                              </select>

                              {selectedBatch && (
                                <div className="mt-1.5 p-2 bg-indigo-50/60 rounded-lg border border-indigo-100 text-[11px] space-y-0.5">
                                  <div className="flex items-center justify-between font-bold text-slate-800">
                                    <span className="flex items-center gap-1">
                                      <Store className="w-3.5 h-3.5 text-indigo-600" />
                                      Shopkeeper: <strong className="text-indigo-950">{selectedBatch.shopkeeperName}</strong>
                                    </span>
                                    <span className="text-purple-900 font-black">MRP: ₹{selectedBatch.mrp}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span>Avail: {selectedBatch.availableQuantity} units</span>
                                    <span>Exp: {selectedBatch.expiryDate}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Stock Status Indicator */}
                        <td className="py-3 px-3 text-center">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Deducted</span>
                            </span>
                          ) : isAssigned ? (
                            isExpired ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <span>Expired</span>
                              </span>
                            ) : isSufficient ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <span>In Stock ✓</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <span>Low Stock</span>
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Not Assigned</span>
                          )}
                        </td>

                        {/* State Badge */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black rounded-md ${
                              isLocked
                                ? 'bg-emerald-100 text-emerald-900'
                                : isAssigned
                                ? 'bg-indigo-100 text-indigo-900'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isLocked ? 'LOCKED' : isAssigned ? 'STAGED' : 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit History Log (If Assignment Locked) */}
          {order.assignmentAuditHistory && order.assignmentAuditHistory.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Batch Assignment Audit Trail ({order.assignmentAuditHistory.length} records)</span>
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3">Assigned Batch</th>
                      <th className="py-2 px-3 text-center">Deducted Qty</th>
                      <th className="py-2 px-3">Admin</th>
                      <th className="py-2 px-3">Locked Timestamp</th>
                      <th className="py-2 px-3">Inventory Txn Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {order.assignmentAuditHistory.map((audit) => (
                      <tr key={audit.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-sans font-bold text-slate-900">
                          {audit.productName}
                        </td>
                        <td className="py-2 px-3 text-indigo-700 font-bold">
                          #{audit.assignedBatchNumber}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-800">
                          -{audit.assignedQuantity}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-700">{audit.adminName}</td>
                        <td className="py-2 px-3 text-slate-500">
                          {new Date(audit.lockedAt).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-slate-400">{audit.inventoryTransactionId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Current Order Status:{' '}
              <strong className="text-slate-900 uppercase font-mono">{order.orderStatus}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Close
            </button>

            {!isLocked ? (
              <button
                onClick={() => setShowConfirmLockDialog(true)}
                disabled={!validationResult.valid || submittingLock}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Confirm & Lock Assignment</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPackingSlipModal(true)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  title="Generate Order Pick & Pack Slip"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Pick & Pack Slip</span>
                </button>

                {!order.billNumber && (
                  <button
                    onClick={handleGenerateBill}
                    disabled={generatingBill}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Generate Bill</span>
                  </button>
                )}

                {order.packingStatus !== 'PACKED' && (
                  <button
                    onClick={handleMarkPacked}
                    disabled={markingPacked}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Box className="w-4 h-4" />
                    <span>Mark as Packed</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Strict Confirm & Lock Confirmation Dialog */}
        {showConfirmLockDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-center text-slate-900">
                Confirm Product Assignment & Lock?
              </h3>
              <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
                By confirming, you will finalize the physical batch selections for all {order.items.length} items.
                <strong> The specified quantities will be immediately and atomically deducted from warehouse inventory.</strong>
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1 mt-4">
                <p>• Deduct from assigned batches: <strong>Confirmed</strong></p>
                <p>• Inventory Transaction logs: <strong>Generated</strong></p>
                <p>• Order progression: <strong>Advanced to Confirmed</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => setShowConfirmLockDialog(false)}
                  disabled={submittingLock}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAndLock}
                  disabled={submittingLock}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submittingLock ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Locking...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Lock & Deduct Stock</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customer Bill Modal */}
        {showCustomerBillModal && (
          <CustomerBillModal
            order={order}
            onClose={() => setShowCustomerBillModal(false)}
          />
        )}

        {/* Warehouse Packing Slip Modal */}
        {showPackingSlipModal && (
          <WarehousePackingSlipModal
            order={order}
            onClose={() => setShowPackingSlipModal(false)}
            onMarkPacked={handleMarkPacked}
          />
        )}
      </div>
    </div>
  );
};
