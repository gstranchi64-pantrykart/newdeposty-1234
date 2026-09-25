import React, { useRef, useState } from 'react';
import { Customer, Auditor, User, AuditorCheck, PantryCardItem } from '../../types';
import { exportElementToPdf } from '../../utils/pdfGenerator';
import { FileText, Download, Printer, CheckCircle2, AlertTriangle, ShieldCheck, User as UserIcon, MapPin, Phone, Calendar, Clock, Loader2 } from 'lucide-react';

interface AuditorWorkPdfReportProps {
  audit?: AuditorCheck | null;
  customer?: Customer | null;
  auditor?: Auditor | null;
  user?: User | null;
  pantryItems?: PantryCardItem[];
  itemStatuses?: Record<string, {
    status: string;
    action: string;
    qtyAvailable: number;
    qtyMissing: number;
    qtyDamaged: number;
    qtyReturn: number;
    qtyReplacement: number;
    qtyPantryPay: number;
    remarks: string;
  }>;
  overallRemarks?: string;
  auditorSignature?: boolean;
  customerSignature?: boolean;
  activeAudit?: AuditorCheck | null;
  revisingAudit?: AuditorCheck | null;
  onClose?: () => void;
}

export const AuditorWorkPdfReport: React.FC<AuditorWorkPdfReportProps> = ({
  audit,
  customer,
  auditor,
  user,
  pantryItems,
  itemStatuses,
  overallRemarks,
  auditorSignature = true,
  customerSignature = true,
  activeAudit,
  revisingAudit,
  onClose,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const resolvedAudit = audit || activeAudit || revisingAudit;
  const resolvedCustomer = customer || (resolvedAudit ? {
    id: resolvedAudit.customerId,
    fullName: resolvedAudit.customerName,
    mobile: resolvedAudit.customerMobile || '',
    address: resolvedAudit.customerAddress || '',
  } as Customer : null);

  const resolvedPantryItems: PantryCardItem[] = (pantryItems && pantryItems.length > 0)
    ? pantryItems
    : (resolvedAudit?.itemsChecked || []).map((c, idx) => ({
        id: c.pantryCardItemId || `item-${idx}`,
        customerId: resolvedAudit?.customerId || '',
        productId: c.productId,
        productName: c.productName,
        barcode: (c as any).barcode || '',
        batchNumber: c.batchNumber || '',
        expiryDate: c.expiryDate || '',
        quantity: (c as any).systemQuantity || ((c.qtyAvailable || 0) + (c.qtyMissing || 0)),
        unitPrice: (c as any).unitPrice || 0,
        totalValue: ((c as any).systemQuantity || ((c.qtyAvailable || 0) + (c.qtyMissing || 0))) * ((c as any).unitPrice || 0),
        status: 'DELIVERED',
        deliveryDate: resolvedAudit?.visitDate || '',
      } as PantryCardItem));

  const resolvedStatuses: Record<string, any> = { ...(itemStatuses || {}) };
  if (!itemStatuses && resolvedAudit?.itemsChecked) {
    resolvedAudit.itemsChecked.forEach((c) => {
      resolvedStatuses[c.pantryCardItemId] = {
        status: c.verificationStatus || 'AVAILABLE',
        action: c.actionTaken || 'NONE',
        qtyAvailable: c.qtyAvailable ?? 0,
        qtyMissing: c.qtyMissing ?? 0,
        qtyDamaged: c.qtyDamaged ?? 0,
        qtyReturn: c.qtyReturn ?? 0,
        qtyReplacement: c.qtyReplacement ?? 0,
        qtyPantryPay: c.qtyPantryPay ?? 0,
        remarks: c.remarks || '',
      };
    });
  }

  // Compute live totals
  let totalSystemQty = 0;
  let totalAvailableQty = 0;
  let totalMissingQty = 0;
  let totalDamagedQty = 0;
  let totalReturnQty = 0;
  let totalReplacementQty = 0;
  let totalPantryPayQty = 0;
  let totalWalletDeduction = 0;
  let totalCreditRestored = 0;

  resolvedPantryItems.forEach((item) => {
    totalSystemQty += item.quantity;
    const st = resolvedStatuses[item.id];
    if (st) {
      totalAvailableQty += st.qtyAvailable || 0;
      totalMissingQty += st.qtyMissing || 0;
      totalDamagedQty += st.qtyDamaged || 0;
      totalReturnQty += st.qtyReturn || 0;
      totalReplacementQty += st.qtyReplacement || 0;
      totalPantryPayQty += st.qtyPantryPay || 0;

      const unitPrice = item.unitPrice || (item.totalValue / (item.quantity || 1)) || 100;
      totalWalletDeduction += (st.qtyMissing || 0) * unitPrice;
      totalCreditRestored += ((st.qtyPantryPay || 0) + (st.qtyReturn || 0)) * unitPrice;
    } else {
      totalAvailableQty += item.quantity;
    }
  });

  const auditBillId = resolvedAudit?.billId || `BILL-AUD-${Date.now().toString().slice(-6)}`;
  const auditId = resolvedAudit?.id || `AUD-CHK-${Date.now().toString().slice(-6)}`;
  const version = resolvedAudit?.billVersion || 1;
  const isRevised = !!revisingAudit || (resolvedAudit && (resolvedAudit.revisionCount || 0) > 0) || (resolvedAudit && (resolvedAudit.billVersion || 1) > 1);
  const rejectionReason = resolvedAudit?.customerRejectionReason;

  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      await exportElementToPdf(reportRef.current, {
        filename: `Auditor-Field-Report-${customer?.fullName?.replace(/\s+/g, '_') || 'Customer'}-${auditBillId}.pdf`,
        orientation: 'portrait',
        margin: 6,
      });
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to generate PDF. You can also use the Print button to save as PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-3.5 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          <div>
            <h4 className="font-bold text-sm text-white">Auditor Field Work &amp; Discrepancy PDF Report</h4>
            <p className="text-[11px] text-slate-300">Live printable report of all auditor-filled quantities and pantry inspection data</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExporting ? 'Generating PDF...' : 'Download PDF Report'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Print Report</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* The Printable Report Container */}
      <div
        ref={reportRef}
        className="bg-white p-6 sm:p-8 rounded-xl border border-slate-300 shadow-sm text-slate-800 text-xs font-sans print:p-0 print:border-none print:shadow-none"
        style={{ minWidth: '780px' }}
      >
        {/* Header */}
        <div className="border-b-2 border-slate-800 pb-4 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                Doorstep Field Audit &amp; Verification
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-1 uppercase tracking-tight">
                Pantry Physical Inspection &amp; Settlement Report
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Official Doorstep Stock Verification &bull; Discrepancy Statement &bull; Wallet Settlement
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="text-[10px] font-mono text-slate-500 uppercase">Bill / Document Ref</div>
              <div className="text-base font-black font-mono text-slate-900">{auditBillId}</div>
              <div className="text-[10px] font-mono text-slate-600">Audit ID: {auditId}</div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                Version {version} {isRevised ? '(Revised by Auditor)' : ''}
              </div>
            </div>
          </div>

          {/* Customer Rejection Notice if applicable */}
          {rejectionReason && (
            <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Customer Previous Rejection Remarks:</strong> &ldquo;{rejectionReason}&rdquo;
                <div className="text-[10px] text-rose-700 mt-0.5">
                  Auditor has revised the physical count and quantities below in response to customer feedback.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Meta Grid: Auditor Profile + Customer Profile */}
        <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
          {/* Customer Household Info */}
          <div className="space-y-1.5 border-r border-slate-200 pr-4">
            <div className="flex items-center gap-1.5 text-slate-900 font-black text-xs uppercase tracking-wide">
              <UserIcon className="w-3.5 h-3.5 text-cyan-700" />
              <span>Customer Household Details</span>
            </div>
            <div className="text-sm font-bold text-slate-900">{resolvedCustomer?.fullName || 'Household Customer'}</div>
            <div className="text-slate-600 font-mono text-[11px]">ID: {resolvedCustomer?.id || 'CUST-N/A'}</div>
            <div className="text-slate-600 flex items-start gap-1">
              <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
              <span>{resolvedCustomer?.address || 'Address on file'}</span>
            </div>
            <div className="text-slate-600 flex items-center gap-1 font-mono">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span>+91 {resolvedCustomer?.mobile || 'N/A'}</span>
            </div>
            <div className="pt-1 flex items-center gap-3 text-[11px]">
              <span className="font-semibold text-slate-700">Pre-Audit Wallet: <strong className="text-emerald-700">₹{resolvedCustomer?.walletBalance ?? 1000}</strong></span>
              <span className="font-semibold text-slate-700">Pantry Limit: <strong className="text-purple-700">₹{resolvedCustomer?.availablePantryLimit ?? 0}</strong></span>
            </div>
          </div>

          {/* Field Auditor Details */}
          <div className="space-y-1.5 pl-2">
            <div className="flex items-center gap-1.5 text-slate-900 font-black text-xs uppercase tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
              <span>Field Auditor Certification</span>
            </div>
            <div className="text-sm font-bold text-slate-900">{auditor?.fullName || resolvedAudit?.auditorName || user?.name || 'Assigned Field Auditor'}</div>
            <div className="text-slate-600 font-mono text-[11px]">Auditor ID: {auditor?.id || resolvedAudit?.auditorId || user?.auditorId || 'AUD-001'}</div>
            <div className="text-slate-600 flex items-center gap-1 font-mono">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span>+91 {auditor?.mobile || (resolvedAudit as any)?.auditorMobile || user?.mobile || '9876543210'}</span>
            </div>
            <div className="text-slate-600 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Inspection Date: <strong>{todayStr}</strong></span>
              <Clock className="w-3 h-3 text-slate-400 shrink-0 ml-2" />
              <span>Time: <strong>{timeStr}</strong></span>
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-200">
                <CheckCircle2 className="w-3 h-3 text-cyan-700" />
                Physical Doorstep Inspection Verified
              </span>
            </div>
          </div>
        </div>

        {/* Product Items Table */}
        <div className="mb-5 overflow-hidden rounded-lg border border-slate-300">
          <div className="bg-slate-800 text-white px-3.5 py-2 flex items-center justify-between font-bold text-xs uppercase tracking-wider">
            <span>Physical Inventory Verification Data (All Fields)</span>
            <span className="text-[10px] font-normal text-slate-300">{resolvedPantryItems.length} Products Inspected</span>
          </div>

          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-300">
              <tr>
                <th className="py-2 px-2 border-r border-slate-200 w-8 text-center">#</th>
                <th className="py-2 px-3 border-r border-slate-200">Product Name &amp; Batch</th>
                <th className="py-2 px-2 border-r border-slate-200">Barcode</th>
                <th className="py-2 px-2 border-r border-slate-200">Expiry</th>
                <th className="py-2 px-2 border-r border-slate-200 text-center bg-slate-50">System Qty</th>
                <th className="py-2 px-2 border-r border-slate-200 text-center bg-emerald-50 text-emerald-900 font-black">Phys. Avail</th>
                <th className="py-2 px-2 border-r border-slate-200 text-center bg-rose-50 text-rose-900 font-black">Missing</th>
                <th className="py-2 px-2 border-r border-slate-200 text-center bg-amber-50">Damaged</th>
                <th className="py-2 px-2 border-r border-slate-200 text-center bg-purple-50">Ret/Repl</th>
                <th className="py-2 px-2 border-r border-slate-200 text-center bg-cyan-50">Pantry Pay</th>
                <th className="py-2 px-2 border-r border-slate-200 text-right">Rate</th>
                <th className="py-2 px-2 border-r border-slate-200 text-right font-black">Deduction</th>
                <th className="py-2 px-2">Auditor Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {resolvedPantryItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-6 text-center text-slate-400">
                    No items in customer pantry.
                  </td>
                </tr>
              ) : (
                resolvedPantryItems.map((item, idx) => {
                  const st = resolvedStatuses[item.id] || {
                    status: 'AVAILABLE',
                    action: 'NONE',
                    qtyAvailable: item.quantity,
                    qtyMissing: 0,
                    qtyDamaged: 0,
                    qtyReturn: 0,
                    qtyReplacement: 0,
                    qtyPantryPay: 0,
                    remarks: '',
                  };
                  const unitPrice = item.unitPrice || (item.totalValue / (item.quantity || 1)) || 100;
                  const itemDeduction = (st.qtyMissing || 0) * unitPrice;
                  const hasDiscrepancy = (st.qtyMissing > 0) || (st.qtyDamaged > 0) || (st.qtyReturn > 0) || (st.qtyReplacement > 0) || (st.qtyPantryPay > 0);

                  return (
                    <tr key={item.id} className={hasDiscrepancy ? 'bg-amber-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-[10px] text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900">
                          {item.productName || (item as any).name || (item as any).title || (item as any).pantryCardItemName || 'Grocery Pantry Item'}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">Batch: {item.batchNumber || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 font-mono text-[10px] text-slate-600">
                        {item.barcode || 'N/A'}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 font-mono text-[10px] text-slate-600">
                        {item.expiryDate || 'N/A'}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-bold text-slate-700 bg-slate-50">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-black text-emerald-800 bg-emerald-50/60">
                        {st.qtyAvailable}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-black text-rose-700 bg-rose-50/60">
                        {st.qtyMissing > 0 ? st.qtyMissing : '-'}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center text-amber-800 bg-amber-50/60">
                        {st.qtyDamaged > 0 ? st.qtyDamaged : '-'}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center text-purple-800 bg-purple-50/60">
                        {(st.qtyReturn || 0) + (st.qtyReplacement || 0) > 0 ? `${st.qtyReturn}R / ${st.qtyReplacement}Rep` : '-'}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-bold text-cyan-800 bg-cyan-50/60">
                        {st.qtyPantryPay > 0 ? st.qtyPantryPay : '-'}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-right font-mono text-slate-700">
                        ₹{unitPrice}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-black text-rose-700">
                        {itemDeduction > 0 ? `₹${itemDeduction}` : '₹0'}
                      </td>
                      <td className="py-2 px-2 text-[10px] text-slate-600 italic">
                        {st.remarks || (hasDiscrepancy ? 'Discrepancy recorded' : 'Verified Intact')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900 text-[11px]">
              <tr>
                <td colSpan={4} className="py-2 px-3 text-right uppercase border-r border-slate-200">
                  Total Inspection Summary:
                </td>
                <td className="py-2 px-2 text-center border-r border-slate-200 font-black">{totalSystemQty}</td>
                <td className="py-2 px-2 text-center border-r border-slate-200 text-emerald-800 font-black">{totalAvailableQty}</td>
                <td className="py-2 px-2 text-center border-r border-slate-200 text-rose-700 font-black">{totalMissingQty}</td>
                <td className="py-2 px-2 text-center border-r border-slate-200 text-amber-800 font-black">{totalDamagedQty}</td>
                <td className="py-2 px-2 text-center border-r border-slate-200 text-purple-800 font-black">{totalReturnQty + totalReplacementQty}</td>
                <td className="py-2 px-2 text-center border-r border-slate-200 text-cyan-800 font-black">{totalPantryPayQty}</td>
                <td className="py-2 px-2 text-right border-r border-slate-200 font-mono">-</td>
                <td className="py-2 px-2 text-right border-r border-slate-200 font-mono font-black text-rose-700">₹{totalWalletDeduction}</td>
                <td className="py-2 px-2 font-mono text-emerald-700 font-bold">+₹{totalCreditRestored} Limit</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Financial & Settlement Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Items Inspected</div>
            <div className="text-base font-black text-slate-900">{resolvedPantryItems.length} Products ({totalSystemQty} Units)</div>
            <div className="text-[10px] text-emerald-700 font-semibold">{totalAvailableQty} Units Verified Intact</div>
          </div>

          <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/70">
            <div className="text-[10px] font-bold text-rose-700 uppercase">Missing Item Discrepancy</div>
            <div className="text-base font-black text-rose-700">{totalMissingQty} Units Missing</div>
            <div className="text-[10px] text-rose-600 font-semibold">Wallet Deduction: ₹{totalWalletDeduction}</div>
          </div>

          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/70">
            <div className="text-[10px] font-bold text-emerald-700 uppercase">Pantry Limit Restoration</div>
            <div className="text-base font-black text-emerald-700">+₹{totalCreditRestored} Restored</div>
            <div className="text-[10px] text-emerald-600 font-semibold">{totalPantryPayQty + totalReturnQty} Units Recredited</div>
          </div>

          <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/70">
            <div className="text-[10px] font-bold text-purple-700 uppercase">Post-Audit Net Wallet</div>
            <div className="text-base font-black text-purple-900">
              ₹{((resolvedCustomer?.walletBalance ?? 1000) - totalWalletDeduction)}
            </div>
            <div className="text-[10px] text-purple-600 font-semibold">Pre-Balance: ₹{resolvedCustomer?.walletBalance ?? 1000}</div>
          </div>
        </div>

        {/* Observations & Field Remarks */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-5">
          <div className="font-bold text-slate-900 text-xs mb-1 uppercase tracking-wide">
            Auditor Doorstep Field Observations &amp; Verification Notes
          </div>
          <p className="text-slate-700 text-xs italic leading-relaxed">
            {overallRemarks || resolvedAudit?.overallRemarks || 'Doorstep physical inspection completed. All pantry batches checked against delivery ledger. Discrepancies and consumed items recorded.'}
          </p>
        </div>

        {/* Official Signatures & Verification Block */}
        <div className="border-t-2 border-slate-300 pt-4 grid grid-cols-2 gap-8 mt-6">
          {/* Auditor Signature */}
          <div className="border border-slate-200 rounded-lg p-3 text-center space-y-1 bg-slate-50/50">
            <div className="text-[10px] font-black uppercase text-slate-500">Field Auditor Verification Stamp</div>
            <div className="h-10 flex items-center justify-center font-serif text-sm font-bold text-cyan-900 italic">
              {auditor?.fullName || resolvedAudit?.auditorName || user?.name || 'Field Auditor'}
            </div>
            <div className="border-t border-slate-300 pt-1 text-[11px] font-bold text-slate-800">
              {auditor?.fullName || resolvedAudit?.auditorName || user?.name} (ID: {auditor?.id || resolvedAudit?.auditorId || user?.auditorId || 'AUD-001'})
            </div>
            <div className="text-[9px] text-slate-500">
              Digitally Certified on {todayStr} at {timeStr}
            </div>
          </div>

          {/* Customer Signature & Acknowledgment */}
          <div className="border border-slate-200 rounded-lg p-3 text-center space-y-1 bg-slate-50/50">
            <div className="text-[10px] font-black uppercase text-slate-500">Household Customer Acknowledgment</div>
            <div className="h-10 flex items-center justify-center font-serif text-sm font-bold text-slate-800 italic">
              {customerSignature || resolvedAudit?.isBillConfirmed || resolvedAudit?.status === 'CUSTOMER_CONFIRMED'
                ? resolvedCustomer?.fullName || 'Household Customer'
                : rejectionReason
                ? 'Revision Requested by Customer'
                : 'Pending Household Review & Confirmation'}
            </div>
            <div className="border-t border-slate-300 pt-1 text-[11px] font-bold text-slate-800">
              {resolvedCustomer?.fullName || 'Customer Representative'}
            </div>
            <div className="text-[9px] text-slate-500 font-semibold">
              Status: {rejectionReason ? 'REVISION REQUESTED' : (resolvedAudit?.isBillConfirmed || resolvedAudit?.status === 'CUSTOMER_CONFIRMED') ? 'CONFIRMED & ACCEPTED' : 'Awaiting Review & Approval'}
            </div>
          </div>
        </div>

        {/* Footer Document Disclaimer */}
        <div className="mt-5 pt-3 border-t border-slate-200 text-center text-[9px] text-slate-400">
          This document is generated by the Pantry Field Audit System. System-generated report of physical inspection, batch traceability, and doorstep inventory settlements.
        </div>
      </div>
    </div>
  );
};
