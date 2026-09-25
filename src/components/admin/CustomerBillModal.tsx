import React, { useState } from 'react';
import { Order } from '../../types';
import { Printer, X, CheckCircle, FileText, Building2, Download, Loader2 } from 'lucide-react';
import { exportElementToPdf } from '../../utils/pdfGenerator';

interface CustomerBillModalProps {
  order: Order;
  onClose: () => void;
}

export const CustomerBillModal: React.FC<CustomerBillModalProps> = ({ order, onClose }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const invNum = order.billNumber || `INV-${order.id}`;
      await exportElementToPdf('printable-bill', {
        filename: `${invNum}.pdf`,
        orientation: 'portrait',
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const invoiceNumber = order.billNumber || `INV-${order.id}`;
  const invoiceDate = order.billGeneratedAt
    ? new Date(order.billGeneratedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Controls (Hidden during print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Customer Retail Tax Invoice</h3>
              <p className="text-[11px] text-slate-400">Order ID: {order.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Download official PDF invoice file"
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
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div id="printable-bill" className="p-6 md:p-8 overflow-y-auto flex-1 font-sans text-slate-900 bg-white">
          {/* Store / Merchant Header */}
          <div className="border-b border-slate-300 pb-5 mb-5 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <Building2 className="w-6 h-6 text-emerald-600" />
                <h1 className="text-xl font-black tracking-tight">KISAN SUPER MART & PANTRY</h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Central Distribution Center, Main Road, Ranchi, Jharkhand - 834001
              </p>
              <p className="text-xs text-slate-500">
                GSTIN: 20AAAAA0000A1Z5 • Support: care@kisansmart.com | +91 98765 43210
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-900 font-extrabold text-xs rounded-md">
                ORIGINAL TAX INVOICE
              </span>
              <p className="text-sm font-bold text-slate-800 mt-2 font-mono">{invoiceNumber}</p>
              <p className="text-xs text-slate-500 mt-0.5">Date: {invoiceDate}</p>
            </div>
          </div>

          {/* Customer & Order Metadata */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-6">
            <div>
              <p className="text-slate-400 uppercase font-semibold text-[10px]">Customer Details</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{order.customerName}</p>
              <p className="text-slate-600 font-mono mt-0.5">📞 {order.customerMobile}</p>
              <p className="text-slate-600 mt-1 leading-relaxed">
                📍 {order.deliveryAddress || 'Standard Delivery Address'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 uppercase font-semibold text-[10px]">Order Information</p>
              <p className="font-bold text-slate-800 mt-0.5">Order Ref: {order.id}</p>
              <p className="text-slate-600 mt-0.5">
                Order Type:{' '}
                <span className="font-bold text-purple-700">
                  {order.orderType === 'PANTRY' ? 'Pantry Card (0 COD)' : 'Quick COD Order'}
                </span>
              </p>
              <p className="text-slate-600 mt-0.5">
                Payment Status:{' '}
                <span className="font-semibold text-emerald-700">
                  {order.orderType === 'PANTRY' ? 'Pantry Credit Debited' : order.paymentStatus}
                </span>
              </p>
              {order.billGeneratedBy && (
                <p className="text-[10px] text-slate-400 mt-1">Billed By: {order.billGeneratedBy}</p>
              )}
            </div>
          </div>

          {/* Product Items Table (Batch details hidden for customer privacy!) */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Purchased Items
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center">Size / Unit</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900">{item.productName}</span>
                        {item.brand && (
                          <span className="text-[11px] text-slate-500 block">{item.brand}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                        {item.weightSize || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        ₹{item.price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-medium">₹{order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery Charge:</span>
                <span className="font-mono font-medium">
                  {order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxes (GST Incl.):</span>
                <span className="font-mono text-slate-400">Included</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-300">
                <span>Total Amount:</span>
                <span className="font-mono text-emerald-800">₹{order.totalAmount.toFixed(2)}</span>
              </div>
              {order.orderType === 'PANTRY' ? (
                <div className="text-[11px] text-purple-700 font-semibold bg-purple-50 p-2 rounded-lg text-right mt-1 border border-purple-200">
                  Paid via Pantry Card Credit (0 COD)
                </div>
              ) : (
                <div className="text-[11px] text-amber-800 font-semibold bg-amber-50 p-2 rounded-lg text-right mt-1 border border-amber-200">
                  Cash on Delivery (COD Amount: ₹{order.totalAmount.toFixed(2)})
                </div>
              )}
            </div>
          </div>

          {/* Footer Terms & Verification */}
          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 flex flex-col md:flex-row justify-between items-center gap-2">
            <div>
              <p>Thank you for shopping with Kisan Super Mart!</p>
              <p>For return/replacement, contact support within 48 hours with order ID.</p>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Computer Generated Verified Tax Invoice</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Close */}
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
