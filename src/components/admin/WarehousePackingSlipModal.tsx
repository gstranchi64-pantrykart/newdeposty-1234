import React, { useState, useEffect } from 'react';
import { Order, ProductBatch } from '../../types';
import { api } from '../../services/api';
import { Printer, X, PackageCheck, Download, Loader2, Store, Tag, Barcode, IndianRupee } from 'lucide-react';
import { exportElementToPdf } from '../../utils/pdfGenerator';

interface WarehousePackingSlipModalProps {
  order: Order;
  onClose: () => void;
  onMarkPacked?: () => void;
}

export const WarehousePackingSlipModal: React.FC<WarehousePackingSlipModalProps> = ({
  order,
  onClose,
  onMarkPacked,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [batches, setBatches] = useState<ProductBatch[]>([]);

  useEffect(() => {
    api.getBatches()
      .then((b) => {
        if (b && Array.isArray(b)) setBatches(b);
      })
      .catch((err) => console.error('Failed to load batches for slip:', err));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await exportElementToPdf('printable-packing-slip', {
        filename: `PackingSlip-${order.id}.pdf`,
        orientation: 'portrait',
      });
    } catch (err) {
      console.error('Failed to generate Packing Slip PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Helper to resolve Shopkeeper, MRP, Barcode
  const getItemDetails = (item: Order['items'][0]) => {
    const targetBatchId = item.assignedBatchId || item.batchId;
    const targetBatchNumber = item.assignedBatchNumber || item.batchNumber;
    const matchedBatch = batches.find(
      (b) =>
        (targetBatchId && b.id === targetBatchId) ||
        (targetBatchNumber && b.batchNumber === targetBatchNumber) ||
        b.productId === item.productId
    );
    const shopkeeper = item.shopkeeperName || matchedBatch?.shopkeeperName || 'Vendor';
    const mrp = item.mrp || matchedBatch?.mrp || item.price;
    const barcode = item.barcode || matchedBatch?.barcode || '';
    return { shopkeeper, mrp, barcode, matchedBatch };
  };

  const totalSellingPrice = order.items.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
  const billValue = totalSellingPrice;

  const totalMrp = order.items.reduce((sum, item) => {
    const { mrp } = getItemDetails(item);
    return sum + (mrp * item.quantity);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Controls Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-sm">Warehouse Picking &amp; Packing Slip</h3>
              <p className="text-[11px] text-slate-400 font-mono">Order: {order.id} [INTERNAL USE ONLY]</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {order.packingStatus !== 'PACKED' && onMarkPacked && (
              <button
                onClick={onMarkPacked}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Mark Packed</span>
              </button>
            )}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Download official PDF packing slip"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Packing Slip */}
        <div id="printable-packing-slip" className="p-6 md:p-8 overflow-y-auto flex-1 font-sans text-slate-900 bg-white">
          <div className="border-b-2 border-slate-800 pb-4 mb-4 flex justify-between items-start">
            <div>
              <span className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-900 font-black text-xs uppercase tracking-wider rounded">
                INTERNAL WAREHOUSE DISPATCH SLIP
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">ORDER PICK &amp; PACK LIST</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xs text-slate-500 font-mono">Order ID: {order.id}</p>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Bill Value: ₹{billValue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-2.5 py-1 text-xs font-black rounded-lg ${
                  order.packingStatus === 'PACKED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                STATUS: {order.packingStatus === 'PACKED' ? 'PACKED & SEALED' : 'PENDING PACKING'}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Order Type: <strong className="text-slate-800">{order.orderType}</strong>
              </p>
            </div>
          </div>

          {/* Delivery & Routing Header with Prominent Bill Value */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-5">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Recipient / Customer</p>
              <p className="font-bold text-slate-900 mt-0.5">{order.customerName}</p>
              <p className="text-slate-600 font-mono mt-0.5">📞 {order.customerMobile}</p>
              <p className="text-slate-600 mt-0.5 leading-snug">📍 {order.deliveryAddress}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex flex-col justify-center">
              <p className="text-[10px] text-emerald-800 uppercase font-black tracking-wider">Customer Order Bill Value</p>
              <p className="text-lg font-black text-emerald-950 font-mono mt-0.5">
                ₹{billValue.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-emerald-700 font-medium">
                Selling Price Total ({order.items.reduce((s, i) => s + i.quantity, 0)} units)
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Assignment &amp; Lock Audit</p>
              <p className="text-slate-700 mt-0.5">
                Assignment: <strong className="text-emerald-700">{order.assignmentStatus || 'LOCKED'}</strong>
              </p>
              {order.assignmentLockedBy && (
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Locked By: <strong>{order.assignmentLockedBy}</strong>
                </p>
              )}
              {order.billNumber && (
                <p className="text-slate-500 text-[11px] font-mono mt-0.5">
                  Invoice Ref: <strong>{order.billNumber}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Picking Table With Assigned Batch, Shopkeeper, MRP, Barcode & Selling Total */}
          <div className="mb-6">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Items to Pick from Shelves</span>
              <span className="text-[10px] font-normal text-slate-500">
                Verify each assigned batch &amp; shelf location before bagging
              </span>
            </h4>
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-2.5 w-8 text-center">Pick</th>
                    <th className="py-2.5 px-3">Product Name &amp; Barcode</th>
                    <th className="py-2.5 px-3">Shopkeeper</th>
                    <th className="py-2.5 px-2.5 text-right">MRP</th>
                    <th className="py-2.5 px-2.5 text-right">Price</th>
                    <th className="py-2.5 px-2 text-center font-black">Qty</th>
                    <th className="py-2.5 px-2.5 text-right font-black">Total</th>
                    <th className="py-2.5 px-2.5">Batch #</th>
                    <th className="py-2.5 px-2 text-center">Expiry</th>
                    <th className="py-2.5 px-2 text-center w-10">OK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items.map((item, idx) => {
                    const { shopkeeper, mrp, barcode, matchedBatch } = getItemDetails(item);
                    const itemTotal = (item.price || 0) * item.quantity;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {/* Checkbox box */}
                        <td className="py-3 px-2.5 text-center">
                          <div className="w-5 h-5 border-2 border-slate-400 rounded mx-auto flex items-center justify-center font-mono text-[10px] text-slate-300">
                            [ ]
                          </div>
                        </td>

                        {/* Product Name & Barcode */}
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block leading-tight">{item.productName}</span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-600">
                            {item.brand && (
                              <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                {item.brand}
                              </span>
                            )}
                            {item.weightSize && <span className="text-slate-500">{item.weightSize}</span>}
                            {/* Barcode displayed clearly */}
                            <span className="font-mono text-[10px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 inline-flex items-center gap-1">
                              <Barcode className="w-3 h-3 text-slate-600" />
                              <span>{barcode || item.barcode || 'N/A'}</span>
                            </span>
                          </div>
                        </td>

                        {/* Shopkeeper Name - dark small text, wholesale sourced text removed */}
                        <td className="py-3 px-3">
                          <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5 leading-tight">
                            <Store className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                            <span>{shopkeeper}</span>
                          </div>
                        </td>

                        {/* MRP */}
                        <td className="py-3 px-2.5 text-right font-mono font-bold text-purple-900 text-xs">
                          ₹{mrp}
                        </td>

                        {/* Selling Price */}
                        <td className="py-3 px-2.5 text-right font-mono font-bold text-slate-800 text-xs">
                          ₹{item.price}
                        </td>

                        {/* Pick Qty */}
                        <td className="py-3 px-2 text-center">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 rounded-md font-black text-slate-900 text-xs font-mono border border-slate-200">
                            {item.quantity}
                          </span>
                        </td>

                        {/* Line Total */}
                        <td className="py-3 px-2.5 text-right font-mono font-black text-emerald-900 text-xs">
                          ₹{itemTotal.toLocaleString('en-IN')}
                        </td>

                        {/* Assigned Batch # */}
                        <td className="py-3 px-2.5">
                          <span className="font-bold text-indigo-900 font-mono text-[11px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 whitespace-nowrap">
                            #{item.assignedBatchNumber || item.batchNumber || 'Assigned'}
                          </span>
                          {item.inventoryTransactionId && (
                            <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                              Txn: {item.inventoryTransactionId}
                            </span>
                          )}
                        </td>

                        {/* Expiry */}
                        <td className="py-3 px-2 text-center text-slate-700 font-mono text-[11px] whitespace-nowrap">
                          {item.expiryDate || matchedBatch?.expiryDate || '-'}
                        </td>

                        {/* Verified box */}
                        <td className="py-3 px-2 text-center">
                          <div className="w-5 h-5 border-2 border-slate-400 rounded mx-auto"></div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Picking Summary & Bill Value Row */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs mt-3">
              <div className="flex items-center gap-4 text-slate-600">
                <span>Unique Items: <strong className="text-slate-900 font-bold">{order.items.length}</strong></span>
                <span>Total Units to Pick: <strong className="text-slate-900 font-bold">{order.items.reduce((s, i) => s + i.quantity, 0)} units</strong></span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                  <Tag className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-purple-900 font-medium">Total MRP:</span>
                  <span className="font-black text-purple-950 font-mono text-sm">₹{totalMrp.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-100/90 px-3 py-1 rounded-lg border border-emerald-300">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-800" />
                  <span className="text-emerald-950 font-bold text-xs">Total Bill Value:</span>
                  <span className="font-black text-emerald-950 font-mono text-base">₹{billValue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Signatures */}
          <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-300 grid grid-cols-3 gap-6 text-xs text-slate-600">
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-bold text-slate-800">Picked By</p>
              <p className="text-[10px] text-slate-400 mt-1">Warehouse Staff Signature &amp; Date</p>
            </div>
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-bold text-slate-800">Quality &amp; Expiry Auditor</p>
              <p className="text-[10px] text-slate-400 mt-1">Auditor Signature &amp; Stamp</p>
            </div>
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-bold text-slate-800">Dispatch Bag Sealed By</p>
              <p className="text-[10px] text-slate-400 mt-1">Packer Name &amp; Tote Seal #</p>
            </div>
          </div>
        </div>

        {/* Modal Bottom */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
