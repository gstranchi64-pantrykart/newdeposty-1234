import React, { useRef, useState, useEffect } from 'react';
import { AuditorCheck } from '../../types';
import { StatusBadge } from './StatusBadge';
import { AppWindowModal } from './AppWindowModal';
import { exportElementToPdf } from '../../utils/pdfGenerator';
import {
  FileText,
  Lock,
  CheckCircle2,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Phone,
  Calendar,
  X,
  History,
  Check,
  RotateCcw,
  Search,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Filter,
  Download,
  Loader2,
  Building2,
  Wallet,
} from 'lucide-react';

interface AuditBillModalProps {
  audit: AuditorCheck;
  onClose: () => void;
  onConfirmBill?: (auditId: string) => Promise<AuditorCheck | void> | void;
  onDisputeBill?: (auditId: string, remarks: string) => Promise<AuditorCheck | void> | void;
  isCustomerView?: boolean;
  isAuditorView?: boolean;
  isAdminView?: boolean;
  onAdminRevise?: (auditId: string) => void;
}

export const AuditBillModal: React.FC<AuditBillModalProps> = ({
  audit,
  onClose,
  onConfirmBill,
  onDisputeBill,
  isCustomerView = false,
  isAuditorView = false,
  isAdminView = false,
  onAdminRevise,
}) => {
  const [currentAudit, setCurrentAudit] = useState<AuditorCheck>(audit);
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeRemarks, setDisputeRemarks] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'disputed' | 'error';
    message: string;
  } | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [productSearch, setProductSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DISCREPANCY' | 'AVAILABLE'>('ALL');

  const scrollTableBy = (offset: number) => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ top: offset, behavior: 'smooth' });
    }
  };

  const scrollTableToEdge = (edge: 'top' | 'bottom') => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({
        top: edge === 'top' ? 0 : tableScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  // Sync internal state if prop updates
  useEffect(() => {
    setCurrentAudit(audit);
  }, [audit]);

  const isLocked =
    currentAudit.isBillLocked ||
    currentAudit.billStatus === 'LOCKED' ||
    currentAudit.status === 'LOCKED';

  const isDisputed =
    currentAudit.status === 'DISPUTED' || currentAudit.billStatus === 'DISPUTED';

  const isPendingCustomerConfirmation =
    !isLocked &&
    !isDisputed &&
    (currentAudit.billStatus === 'CUSTOMER_PENDING_CONFIRMATION' ||
      currentAudit.status === 'CUSTOMER_PENDING_CONFIRMATION' ||
      currentAudit.billStatus === 'GENERATED' ||
      currentAudit.status === 'BILL_GENERATED' ||
      currentAudit.status === 'COMPLETED');

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const billCode = currentAudit.billId || currentAudit.id;
      await exportElementToPdf('printable-audit-settlement-bill', {
        filename: `AuditSettlementBill-${billCode}.pdf`,
        orientation: 'portrait',
      });
    } catch (err: any) {
      console.error('Failed to export audit bill PDF:', err);
      alert('❌ Failed to export PDF file: ' + (err?.message || 'Unknown error. You can also click Print to save as PDF.'));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!onConfirmBill) return;
    setConfirming(true);
    try {
      const updated = await onConfirmBill(currentAudit.id);
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split('T')[0];
      const nowTimeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (updated && typeof updated === 'object' && 'id' in updated) {
        setCurrentAudit(updated as AuditorCheck);
      } else {
        setCurrentAudit((prev) => ({
          ...prev,
          status: 'LOCKED',
          billStatus: 'LOCKED',
          isBillLocked: true,
          isBillConfirmed: true,
          billConfirmedBy: prev.customerName || 'Household',
          billConfirmedAt: nowIso,
          billConfirmedDate: todayStr,
          billConfirmedTime: nowTimeStr,
          billLockedAt: nowIso,
          billLockedDate: todayStr,
          billLockedTime: nowTimeStr,
          customerSignatureStatus: true,
        }));
      }

      setShowConfirmDialog(false);
      setFeedbackNotice({
        type: 'success',
        message: 'Audit Bill successfully confirmed & permanently LOCKED by Household!',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to confirm bill.');
    } finally {
      setConfirming(false);
    }
  };

  const handleDisputeAction = async () => {
    if (!onDisputeBill) return;
    if (!disputeRemarks.trim()) {
      alert('Please enter your reason for rejecting / disputing this bill.');
      return;
    }
    setDisputing(true);
    try {
      const updated = await onDisputeBill(currentAudit.id, disputeRemarks.trim());
      if (updated && typeof updated === 'object' && 'id' in updated) {
        setCurrentAudit(updated as AuditorCheck);
      } else {
        setCurrentAudit((prev) => ({
          ...prev,
          status: 'DISPUTED',
          billStatus: 'DISPUTED',
          overallRemarks: `[DISPUTED by Customer] Reason: ${disputeRemarks.trim()}. ${prev.overallRemarks || ''}`,
        }));
      }

      setShowDisputeDialog(false);
      setFeedbackNotice({
        type: 'disputed',
        message: 'Bill marked as Disputed by Household. Field Auditor has been notified.',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to dispute bill.');
    } finally {
      setDisputing(false);
    }
  };

  const quickDisputeReasons = [
    'Item quantity mismatch during inspection',
    'Item was already returned earlier',
    'Item is intact and not damaged/expired',
    'Pricing discrepancy in missing items deduction',
    'Dispute over pantry item batch count',
  ];

  const totals = currentAudit.itemsChecked.reduce(
    (acc, it) => {
      acc.qty += it.quantity || 0;
      acc.avail += it.qtyAvailable ?? 0;
      acc.miss += it.qtyMissing ?? 0;
      acc.dmg += it.qtyDamaged ?? 0;
      acc.ret += it.qtyReturn ?? 0;
      acc.rep += it.qtyReplacement ?? 0;
      acc.pantryPay += it.qtyPantryPay ?? 0;
      const wDed =
        it.walletDeductionAmount !== undefined
          ? it.walletDeductionAmount
          : (it.qtyMissing || 0) * (it.productPrice || 100);
      acc.walletDeduct += wDed;
      const lRest =
        (it as any).limitRestoreAmount !== undefined
          ? (it as any).limitRestoreAmount
          : ((it.qtyReturn || 0) + (it.qtyPantryPay || 0)) * (it.productPrice || 100);
      acc.limitRestore += lRest;
      return acc;
    },
    {
      qty: 0,
      avail: 0,
      miss: 0,
      dmg: 0,
      ret: 0,
      rep: 0,
      pantryPay: 0,
      walletDeduct: 0,
      limitRestore: 0,
    }
  );

  const walletBefore = currentAudit.walletBefore ?? 1000;
  const totalWalletDeduction = currentAudit.totalWalletDeduction ?? totals.walletDeduct;
  const walletAfter = currentAudit.walletAfter ?? Math.max(0, walletBefore - totalWalletDeduction);

  const creditLimitBefore = (currentAudit as any).creditLimitBefore ?? 5000;
  const totalCreditRestored = currentAudit.totalCreditRestored ?? totals.limitRestore;
  const creditLimitAfter = (currentAudit as any).creditLimitAfter ?? (creditLimitBefore + totalCreditRestored);

  return (
    <AppWindowModal
      isOpen={true}
      onClose={onClose}
      title="Audit Settlement Bill"
      subtitle="Official Physical Pantry Audit & Settlement Statement"
      icon={<FileText className="w-5 h-5 text-indigo-600" />}
      size="xl"
      badge={
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
            {currentAudit.billId || currentAudit.id}
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            Version {currentAudit.billVersion || 1}
          </span>
        </div>
      }
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Download official PDF bill file"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs border border-slate-300"
            title="Print Bill"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700" />
            <span>Print Bill</span>
          </button>
        </div>
      }
    >
        {/* Feedback Notice Alert */}
        {feedbackNotice && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
              feedbackNotice.type === 'success'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : feedbackNotice.type === 'disputed'
                ? 'bg-rose-100 text-rose-900 border-rose-300'
                : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              )}
              <span>{feedbackNotice.message}</span>
            </div>
            <button
              onClick={() => setFeedbackNotice(null)}
              className="text-xs hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Status Lock / Confirmation Banner */}
        {isLocked ? (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                <strong>BILL CONFIRMED BY HOUSEHOLD</strong> — Permanently Locked &amp; Certified on{' '}
                {currentAudit.billConfirmedDate || currentAudit.billConfirmedAt?.split(' ')[0] || currentAudit.visitDate}{' '}
                at {currentAudit.billConfirmedTime || currentAudit.billConfirmedAt?.split(' ')[1] || 'Doorstep Visit'}{' '}
                by <span className="font-bold">{currentAudit.billConfirmedBy || currentAudit.customerName}</span>.
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
              IMMUTABLE &amp; LOCKED
            </span>
          </div>
        ) : isDisputed ? (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-xs text-rose-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>
                <strong>BILL DISPUTED BY HOUSEHOLD</strong> — Discrepancies reported by customer. Awaiting auditor review.
              </span>
            </div>
            {isCustomerView && onConfirmBill && (
              <button
                onClick={() => setShowConfirmDialog(true)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-xs cursor-pointer shadow-xs transition flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept Bill Now</span>
              </button>
            )}
          </div>
        ) : isPendingCustomerConfirmation ? (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>CONFIRMATION REQUIRED</strong> — Field Auditor has generated this bill. Please review details below and choose Accept or Reject.
              </span>
            </div>
            {isCustomerView && onConfirmBill && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfirmDialog(true)}
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-bold text-xs cursor-pointer shadow-xs transition flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Accept &amp; Lock Bill</span>
                </button>
                {onDisputeBill && (
                  <button
                    onClick={() => {
                      setDisputeRemarks('');
                      setShowDisputeDialog(true);
                    }}
                    className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded-md font-bold text-xs cursor-pointer transition"
                  >
                    Reject Bill
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Scrollable Bill Content */}
        <div ref={printRef} className="p-6 overflow-y-auto space-y-6 text-slate-800 text-xs">
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            {/* Customer Details */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-purple-600" /> Customer Information
              </div>
              <div className="font-bold text-slate-900 text-sm">{currentAudit.customerName}</div>
              <div className="text-slate-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> +91 {currentAudit.customerMobile || '9876543210'}
              </div>
              <div className="text-slate-600 flex items-start gap-1">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                <span>{currentAudit.customerAddress || 'Customer Residence'}</span>
              </div>
              <div className="text-[11px] font-mono text-purple-700 font-semibold pt-1">
                Customer ID: {currentAudit.customerId}
              </div>
            </div>

            {/* Auditor Details */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" /> Auditor Verification
              </div>
              <div className="font-bold text-slate-900 text-sm">{currentAudit.auditorName}</div>
              <div className="text-slate-600 text-[11px]">
                Auditor ID: <span className="font-mono font-semibold text-slate-800">{currentAudit.auditorId}</span>
              </div>
              <div className="text-slate-700 text-[11px] flex items-center gap-1.5 bg-slate-100/80 px-2 py-1 rounded-md border border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                <span>
                  <strong>Date:</strong> {currentAudit.visitDate || currentAudit.requestedDate || 'N/A'}
                </span>
                <span className="text-slate-300">•</span>
                <Clock className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                <span>
                  <strong>Time:</strong> {currentAudit.visitTime || (currentAudit.startedAt ? currentAudit.startedAt.split(' ')[1] : currentAudit.requestedTime) || '11:30 AM'}
                </span>
              </div>
              <div className="text-slate-500 text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Inspection Duration: <strong className="text-slate-700">{currentAudit.durationFormatted || `${currentAudit.durationMinutes || 24} mins`}</strong></span>
              </div>
            </div>

            {/* Audit Status & Timestamps */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Settlement &amp; Status
              </div>
              <div className="pt-0.5">
                <StatusBadge status={isLocked ? ('LOCKED' as any) : (currentAudit.status as any)} />
              </div>
              <div className="text-slate-600 text-[11px] bg-slate-100/80 px-2 py-1 rounded-md border border-slate-200 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                  <FileText className="w-3 h-3 text-indigo-600" /> Bill Generation:
                </div>
                <div className="font-mono text-[11px] text-slate-800">
                  📅 {currentAudit.billGeneratedDate || currentAudit.visitDate || currentAudit.requestedDate || 'N/A'} • ⏰ {currentAudit.billGeneratedTime || (currentAudit.billGeneratedAt ? currentAudit.billGeneratedAt.split(' ')[1] : currentAudit.visitTime || '11:55 AM')}
                </div>
              </div>
              {isLocked && (
                <div className="text-emerald-800 text-[11px] bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 space-y-0.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 uppercase">
                    <Lock className="w-3 h-3 text-emerald-600" /> Locked &amp; Certified:
                  </div>
                  <div className="font-mono text-[11px] font-semibold text-emerald-900">
                    📅 {currentAudit.billLockedDate || currentAudit.billConfirmedDate || (currentAudit.billLockedAt ? currentAudit.billLockedAt.split(' ')[0] : currentAudit.visitDate)} • ⏰ {currentAudit.billLockedTime || currentAudit.billConfirmedTime || (currentAudit.billLockedAt ? currentAudit.billLockedAt.split(' ')[1] : '12:10 PM')}
                  </div>
                </div>
              )}
              {currentAudit.versionHistory && currentAudit.versionHistory.length > 0 && (
                <div className="text-indigo-600 text-[11px] font-semibold flex items-center gap-1 pt-0.5">
                  <History className="w-3 h-3" />
                  {currentAudit.versionHistory.length} Authorized Revisions
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-medium">Total Inspected</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">{currentAudit.totalItemsCount || totals.qty} Items</div>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] text-emerald-700 font-medium">Available (Intact)</div>
              <div className="text-sm font-black text-emerald-700 mt-0.5">{currentAudit.availableCount ?? totals.avail} Items</div>
            </div>
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
              <div className="text-[10px] text-rose-700 font-medium">Missing (Wallet Deduct)</div>
              <div className="text-sm font-black text-rose-700 mt-0.5 font-mono">
                {currentAudit.notAvailableCount ?? totals.miss} (-₹{totalWalletDeduction})
              </div>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
              <div className="text-[10px] text-amber-800 font-medium">Damaged / Broken</div>
              <div className="text-sm font-black text-amber-700 mt-0.5 font-mono">
                {currentAudit.damagedCount ?? totals.dmg} Items
              </div>
            </div>
            <div className="p-2 rounded-xl bg-orange-50 border border-orange-200">
              <div className="text-[10px] text-orange-800 font-medium">Returns (Limit Restore)</div>
              <div className="text-sm font-black text-orange-700 mt-0.5 font-mono">
                {currentAudit.returnsInitiatedCount ?? totals.ret} (+₹{totals.limitRestore})
              </div>
            </div>
            <div className="p-2 rounded-xl bg-cyan-50 border border-cyan-200">
              <div className="text-[10px] text-cyan-800 font-medium">Pantry Pay (Paid)</div>
              <div className="text-sm font-black text-cyan-700 mt-0.5 font-mono">
                {(currentAudit as any).pantryPayCount ?? totals.pantryPay} Items
              </div>
            </div>
          </div>

          {/* Item-by-Item Verification Details */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>Item-by-Item Verification &amp; Historical Pricing</span>
                  <span className="text-[11px] font-normal bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                    {currentAudit.itemsChecked.length} Products
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500">
                  Unit prices locked to original delivery transactions. Use scroll handles to browse products.
                </p>
              </div>

              {/* Scroll Controls & Search Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search product / batch..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 w-36 sm:w-44"
                  />
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Status Quick Filter */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-2 py-0.5 rounded-md transition ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('DISCREPANCY')}
                    className={`px-2 py-0.5 rounded-md transition ${statusFilter === 'DISCREPANCY' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-500 hover:text-rose-600'}`}
                  >
                    Discrepant
                  </button>
                </div>

                {/* Dedicated Scroll Action Handles */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    title="Scroll to Top"
                    onClick={() => scrollTableToEdge('top')}
                    className="p-1 hover:bg-white text-slate-600 hover:text-purple-700 rounded transition cursor-pointer"
                  >
                    <ChevronsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Scroll Up"
                    onClick={() => scrollTableBy(-150)}
                    className="p-1 hover:bg-white text-slate-600 hover:text-purple-700 rounded transition cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Scroll Down"
                    onClick={() => scrollTableBy(150)}
                    className="p-1 hover:bg-white text-slate-600 hover:text-purple-700 rounded transition cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Scroll to Bottom"
                    onClick={() => scrollTableToEdge('bottom')}
                    className="p-1 hover:bg-white text-slate-600 hover:text-purple-700 rounded transition cursor-pointer"
                  >
                    <ChevronsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Products Table Viewport with Sticky Header */}
            <div
              ref={tableScrollRef}
              className="border border-slate-200 rounded-xl overflow-y-auto overflow-x-auto max-h-[340px] shadow-2xs scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 bg-white"
            >
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-100/95 backdrop-blur-xs text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-2.5 px-3">Product &amp; Batch</th>
                    <th className="py-2.5 px-1 text-center" title="Delivered Total Quantity">Qty</th>
                    <th className="py-2.5 px-1 text-center text-emerald-700" title="Physically Available Remaining">Avail</th>
                    <th className="py-2.5 px-1 text-center text-amber-700" title="Missing Quantity">Miss</th>
                    <th className="py-2.5 px-1 text-center text-rose-700" title="Damaged Quantity">Dmg</th>
                    <th className="py-2.5 px-1 text-center text-orange-600" title="Returned Quantity">Ret</th>
                    <th className="py-2.5 px-1 text-center text-indigo-600" title="Replacement Quantity">Rep</th>
                    <th className="py-2.5 px-1 text-center text-cyan-600" title="Pantry Pay Items">P.Pay</th>
                    <th className="py-2.5 px-1 text-right">Price</th>
                    <th className="py-2.5 px-1.5 text-right text-rose-700 font-mono" title="Wallet Deduction">Wallet (-₹)</th>
                    <th className="py-2.5 px-1.5 text-right text-emerald-700 font-mono" title="Credit Limit Restored">Limit (+₹)</th>
                    <th className="py-2.5 px-1 text-center">Status</th>
                    <th className="py-2.5 px-3">Auditor Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(() => {
                    const filteredItems = currentAudit.itemsChecked.filter((it) => {
                      const q = productSearch.toLowerCase();
                      const matchesSearch =
                        !q ||
                        (it.productName || '').toLowerCase().includes(q) ||
                        (it.batchNumber || '').toLowerCase().includes(q);

                      const hasDiscrepancy =
                        (it.qtyMissing && it.qtyMissing > 0) ||
                        (it.qtyDamaged && it.qtyDamaged > 0) ||
                        (it.qtyReturn && it.qtyReturn > 0) ||
                        (it.qtyReplacement && it.qtyReplacement > 0) ||
                        (it.qtyPantryPay && it.qtyPantryPay > 0) ||
                        it.verificationStatus !== 'AVAILABLE';

                      if (statusFilter === 'DISCREPANCY') {
                        return matchesSearch && hasDiscrepancy;
                      }
                      return matchesSearch;
                    });

                    if (filteredItems.length === 0) {
                      return (
                        <tr>
                          <td colSpan={13} className="py-8 text-center text-slate-400">
                            <Search className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                            <p className="font-semibold text-slate-600 text-xs">No products matched your search / filter</p>
                          </td>
                        </tr>
                      );
                    }

                    return filteredItems.map((it, idx) => {
                      const itemRate =
                        it.productPrice ??
                        (it as any).unitPrice ??
                        (it as any).price ??
                        (it as any).rate ??
                        (it as any).sellingPrice ??
                        100;

                      const itemWalletDeduct =
                        it.walletDeductionAmount !== undefined
                          ? it.walletDeductionAmount
                          : (it.qtyMissing || 0) * itemRate;

                      const itemLimitRestore =
                        (it as any).limitRestoreAmount !== undefined
                          ? (it as any).limitRestoreAmount
                          : ((it.qtyReturn || 0) + (it.qtyPantryPay || 0)) * itemRate;

                      const pName =
                        it.productName ||
                        (it as any).name ||
                        (it as any).title ||
                        (it as any).pantryCardItemName ||
                        (it as any).product_name ||
                        (it as any).item_name ||
                        'Grocery Pantry Item';

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {it.images && it.images[0] ? (
                                <img
                                  src={it.images[0]}
                                  alt={pName}
                                  className="w-8 h-8 object-cover rounded-md border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0 text-xs border border-purple-200 uppercase">
                                  {pName.slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 leading-tight">
                                  {pName}
                                </div>
                                {it.qtyReplacement && it.qtyReplacement > 0 ? (
                                  <div className="text-[9px] font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                                    <span>Batch: <strong className="font-mono">{it.batchNumber}</strong></span>
                                    {it.replacedBatchNumber && (
                                      <div className="text-[8px] font-bold text-emerald-900 mt-0.5">
                                        🔄 {it.isBatchSwapped ? 'Swapped with Used' : 'Swaps with Used'}: <span className="font-mono font-bold">{it.replacedBatchNumber}</span> (Mfg: {it.replacedMfgDate || '-'}, Exp: {it.replacedExpDate || '-'})
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-[9px] text-slate-500 font-mono">
                                    {it.batchNumber || 'N/A'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-1 text-center font-bold text-slate-900">{it.quantity || (it as any).systemQuantity || 1}</td>
                          <td className="py-2 px-1 text-center text-emerald-700 font-bold bg-emerald-50/20">{it.qtyAvailable ?? '-'}</td>
                          <td className="py-2 px-1 text-center text-amber-700 font-bold bg-amber-50/20">{it.qtyMissing ?? '-'}</td>
                          <td className="py-2 px-1 text-center text-rose-700 font-bold bg-rose-50/20">{it.qtyDamaged ?? '-'}</td>
                          <td className="py-2 px-1 text-center text-orange-700 font-bold bg-orange-50/20">{it.qtyReturn ?? '-'}</td>
                          <td className="py-2 px-1 text-center text-indigo-700 font-bold bg-indigo-50/20">{it.qtyReplacement ?? '-'}</td>
                          <td className="py-2 px-1 text-center text-cyan-700 font-bold bg-cyan-50/20">{it.qtyPantryPay ?? '-'}</td>
                          <td className="py-2 px-1 text-right font-mono text-slate-700 font-bold">₹{itemRate}</td>
                          <td className="py-2 px-1.5 text-right font-mono font-bold">
                            {itemWalletDeduct > 0 ? (
                              <span className="text-rose-600">-₹{itemWalletDeduct}</span>
                            ) : (
                              <span className="text-slate-400">₹0</span>
                            )}
                          </td>
                          <td className="py-2 px-1.5 text-right font-mono font-bold">
                            {itemLimitRestore > 0 ? (
                              <span className="text-emerald-600">+₹{itemLimitRestore}</span>
                            ) : (
                              <span className="text-slate-400">₹0</span>
                            )}
                          </td>
                          <td className="py-2 px-1 text-center">
                            <div className="scale-75 origin-center">
                              <StatusBadge status={it.verificationStatus} />
                            </div>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-600 max-w-[180px] break-words">
                            {it.remarks || '-'}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot className="bg-slate-100/95 font-bold text-xs text-slate-800 border-t-2 border-slate-300 sticky bottom-0 z-10 shadow-2xs">
                  <tr>
                    <td className="py-2 px-3 uppercase text-[10px] font-black text-slate-700">Total Sum:</td>
                    <td className="py-2 px-1 text-center font-black">{totals.qty}</td>
                    <td className="py-2 px-1 text-center text-emerald-800 font-black">{totals.avail}</td>
                    <td className="py-2 px-1 text-center text-amber-800 font-black">{totals.miss}</td>
                    <td className="py-2 px-1 text-center text-rose-800 font-black">{totals.dmg}</td>
                    <td className="py-2 px-1 text-center text-orange-800 font-black">{totals.ret}</td>
                    <td className="py-2 px-1 text-center text-indigo-800 font-black">{totals.rep}</td>
                    <td className="py-2 px-1 text-center text-cyan-800 font-black">{totals.pantryPay}</td>
                    <td className="py-2 px-1 text-right font-mono">-</td>
                    <td className="py-2 px-1.5 text-right font-mono text-rose-700 font-black">
                      {totals.walletDeduct > 0 ? `-₹${totals.walletDeduct}` : '₹0'}
                    </td>
                    <td className="py-2 px-1.5 text-right font-mono text-emerald-700 font-black">
                      {totals.limitRestore > 0 ? `+₹${totals.limitRestore}` : '₹0'}
                    </td>
                    <td className="py-2 px-1 text-center">-</td>
                    <td className="py-2 px-3 text-[10px] text-slate-500 font-mono">Audited Items</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>↕ Tip: Scroll inside the table to view all product items smoothly</span>
              <button
                type="button"
                onClick={() => scrollTableToEdge('bottom')}
                className="text-purple-600 hover:text-purple-800 font-semibold"
              >
                Scroll to end ↓
              </button>
            </div>
          </div>

          {/* Settlement Account & Dual-Ledger Settlement Box */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-black text-sm text-purple-300 flex items-center gap-2">
                <span>Audit Settlement &amp; Limit Restoration Summary</span>
              </h4>
              <span className="text-[10px] font-mono bg-purple-900/80 text-purple-200 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                AUTOMATIC DUAL SETTLEMENT
              </span>
            </div>

            {/* Top Grid: Wallet Deduction & Credit Limit Restoration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Credit Limit Restoration Banner */}
              <div className="bg-gradient-to-r from-teal-950 to-emerald-950 p-3.5 rounded-xl border border-teal-500/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                    Pantry Credit Limit Restored
                  </span>
                  <span className="text-[10px] font-mono bg-teal-500/20 text-teal-200 px-2 py-0.5 rounded font-bold">
                    {isLocked ? 'CREDITED' : 'RESTORES ON CONFIRM'}
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-teal-400">
                  +₹{totalCreditRestored}
                </div>
                <p className="text-[10px] text-teal-200/80">
                  {currentAudit.returnsInitiatedCount || totals.ret} Return item(s) accepted. Increases your Available Pantry Limit immediately upon locking.
                </p>
              </div>

              {/* Wallet Deduction Banner */}
              <div className="bg-gradient-to-r from-rose-950 to-slate-900 p-3.5 rounded-xl border border-rose-500/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                    Prepaid Wallet Discrepancy
                  </span>
                  <span className="text-[10px] font-mono bg-rose-500/20 text-rose-200 px-2 py-0.5 rounded font-bold">
                    {isLocked ? 'SETTLED' : 'DEDUCTS ON CONFIRM'}
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-rose-400">
                  -₹{totalWalletDeduction}
                </div>
                <p className="text-[10px] text-rose-200/80">
                  {currentAudit.notAvailableCount || totals.miss} Missing item(s) settled via your Prepaid Customer Wallet balance.
                </p>
              </div>
            </div>

            {/* Dual Breakdown Bars: Wallet Settlement & Credit Limit Settlement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800 text-xs">
              {/* Prepaid Wallet Breakdown */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-rose-300 uppercase tracking-wider">
                    Prepaid Customer Wallet
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Ledger</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-slate-400 text-[9px] uppercase font-bold">Before</div>
                    <div className="text-sm font-black font-mono text-slate-200 mt-0.5">
                      ₹{walletBefore}
                    </div>
                  </div>
                  <div>
                    <div className="text-rose-400 text-[9px] uppercase font-bold">Deductions</div>
                    <div className="text-sm font-black font-mono text-rose-400 mt-0.5">
                      -₹{totalWalletDeduction}
                    </div>
                  </div>
                  <div>
                    <div className="text-emerald-400 text-[9px] uppercase font-bold">Net Closing</div>
                    <div className="text-sm font-black font-mono text-emerald-400 mt-0.5">
                      ₹{walletAfter}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pantry Credit Limit Breakdown */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-teal-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-teal-300 uppercase tracking-wider">
                    Pantry Credit Limit
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Card Line</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-slate-400 text-[9px] uppercase font-bold">Limit Before</div>
                    <div className="text-sm font-black font-mono text-slate-200 mt-0.5">
                      ₹{creditLimitBefore}
                    </div>
                  </div>
                  <div>
                    <div className="text-teal-400 text-[9px] uppercase font-bold">Restored</div>
                    <div className="text-sm font-black font-mono text-teal-400 mt-0.5">
                      +₹{totalCreditRestored}
                    </div>
                  </div>
                  <div>
                    <div className="text-emerald-400 text-[9px] uppercase font-bold">Available Limit</div>
                    <div className="text-sm font-black font-mono text-emerald-400 mt-0.5">
                      ₹{creditLimitAfter}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 italic">
              * Note: Confirming this bill will automatically execute missing wallet deductions, restore credit limit to your Pantry Card for approved returns, and trigger replacement dispatches.
            </p>
          </div>

          {/* Official Stamp Box */}
          {isLocked ? (
            <div className="border-2 border-dashed border-emerald-600 bg-emerald-50/90 rounded-2xl p-4 text-center space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                Official Certification Stamp
              </div>
              <div className="text-base font-black text-emerald-900 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>BILL CONFIRMED BY HOUSEHOLD</span>
              </div>
              <div className="text-xs font-bold text-emerald-800">
                PERMANENTLY LOCKED &amp; SETTLED • IMMUTABLE AUDIT LEDGER
              </div>
              <div className="text-[11px] text-emerald-700 font-mono pt-1">
                Timestamp: {currentAudit.billConfirmedDate || currentAudit.billConfirmedAt?.split(' ')[0]} {currentAudit.billConfirmedTime || ''} | Signed By: {currentAudit.billConfirmedBy || currentAudit.customerName}
              </div>
            </div>
          ) : isDisputed ? (
            <div className="border-2 border-dashed border-rose-500 bg-rose-50/90 rounded-2xl p-4 text-center space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                Dispute Notice
              </div>
              <div className="text-base font-black text-rose-900 flex items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>DISPUTED BY HOUSEHOLD</span>
              </div>
              <div className="text-xs text-rose-800 max-w-xl mx-auto pt-1">
                Remarks: {currentAudit.overallRemarks}
              </div>
            </div>
          ) : null}

          {/* Overall Remarks */}
          {currentAudit.overallRemarks && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 text-xs">
              <div className="font-bold text-slate-700 text-[11px]">Auditor Remarks &amp; Notes:</div>
              <p className="text-slate-600">{currentAudit.overallRemarks}</p>
            </div>
          )}

          {/* Digital Signature & Permanent Certification Stamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase">
                Auditor Digital Sign-Off
              </div>
              <div className="font-bold text-slate-900">{currentAudit.auditorName}</div>
              <div className="text-[11px] text-emerald-700 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Physically Checked &amp; Bill Generated
              </div>
              <div className="text-[10px] text-slate-400">
                Timestamp: {currentAudit.billGeneratedDate || currentAudit.visitDate}{' '}
                {currentAudit.billGeneratedTime || ''}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase">
                Customer Acceptance &amp; Permanent Seal
              </div>
              {isLocked ? (
                <>
                  <div className="font-bold text-slate-900">
                    {currentAudit.billConfirmedBy || currentAudit.customerName}
                  </div>
                  <div className="text-[11px] text-emerald-700 flex items-center gap-1 font-semibold">
                    <Lock className="w-3.5 h-3.5" /> Confirmed &amp; Permanently Locked
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Confirmed At: {currentAudit.billConfirmedDate || currentAudit.visitDate}{' '}
                    {currentAudit.billConfirmedTime || currentAudit.billConfirmedAt?.split(' ')[1] || ''}
                  </div>
                </>
              ) : isDisputed ? (
                <>
                  <div className="font-bold text-rose-700">Disputed by Household</div>
                  <div className="text-[11px] text-rose-700 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Awaiting Revision / Operations Review
                  </div>
                </>
              ) : (
                <div className="text-amber-700 font-semibold flex items-center gap-1 py-1">
                  <Clock className="w-3.5 h-3.5" /> Awaiting Customer Confirmation
                </div>
              )}
            </div>
          </div>

          {/* Admin Revision History (if any) */}
          {currentAudit.versionHistory && currentAudit.versionHistory.length > 0 && (
            <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200 space-y-2 text-xs">
              <h4 className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-700" />
                <span>Authorized Admin Revision History</span>
              </h4>
              <div className="space-y-1.5">
                {currentAudit.versionHistory.map((vh, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-white rounded-lg border border-indigo-100 text-[11px] space-y-0.5"
                  >
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>
                        Version {vh.version} → Version {vh.version + 1}
                      </span>
                      <span className="text-slate-500 font-normal">
                        {vh.modifiedDate} {vh.modifiedTime}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      Admin: <strong className="text-indigo-800">{vh.modifiedByAdminName}</strong>
                    </div>
                    <div className="text-slate-700 italic">Reason: &ldquo;{vh.reason}&rdquo;</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/90">
          <div className="flex flex-wrap items-center gap-2">
            {isLocked ? (
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 bg-emerald-100/90 px-3.5 py-2 rounded-xl border border-emerald-300">
                <Lock className="w-4 h-4 text-emerald-700" />
                <span>Bill Confirmed by Household (Permanently Locked)</span>
              </span>
            ) : isCustomerView && onConfirmBill ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* Accept & Lock Button */}
                <button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={confirming || disputing}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>Accept &amp; Lock Bill (Bill Confirmed by Household)</span>
                </button>

                {/* Reject / Dispute Button */}
                {onDisputeBill && !isDisputed && (
                  <button
                    onClick={() => {
                      setDisputeRemarks('');
                      setShowDisputeDialog(true);
                    }}
                    disabled={confirming || disputing}
                    className="px-4 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-rose-300"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject / Dispute Bill</span>
                  </button>
                )}

                {isDisputed && (
                  <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5 bg-rose-100 px-3 py-2 rounded-xl border border-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Disputed by Household</span>
                  </span>
                )}
              </div>
            ) : isAuditorView ? (
              <span className="text-xs font-semibold text-slate-600">
                Auditor Mode: Review &amp; Print Bill Only
              </span>
            ) : isAdminView && onAdminRevise ? (
              <button
                onClick={() => onAdminRevise(currentAudit.id)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <History className="w-3.5 h-3.5" />
                <span>Admin Exception Revision</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Download official PDF bill file"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs border border-slate-300"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700" />
              <span>Print Bill</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>

      {/* CUSTOMER CONFIRMATION POPUP MODAL */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Accept &amp; Lock Audit Bill?
                </h3>
                <p className="text-xs text-slate-500">
                  Bill Confirmed by Household — Final Permanent Settlement
                </p>
              </div>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 space-y-2 text-xs text-emerald-950">
              <p className="font-semibold">
                By confirming, you verify and accept:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li>
                  Total inspected: <strong>{currentAudit.totalItemsCount} items</strong>.
                </li>
                <li>
                  Missing discrepancy: <strong>{currentAudit.notAvailableCount || 0} items</strong>.
                </li>
                <li>
                  Wallet deduction amount:{' '}
                  <strong className="text-rose-700">₹{currentAudit.totalWalletDeduction || 0}</strong>.
                </li>
                <li>
                  <strong className="text-emerald-800">
                    An immutable digital stamp &ldquo;Bill Confirmed by Household&rdquo; with timestamp will seal this bill permanently.
                  </strong>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={confirming}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={confirming}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{confirming ? 'Locking Bill...' : 'Confirm & Lock Bill'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER DISPUTE / REJECT POPUP MODAL */}
      {showDisputeDialog && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Reject / Dispute Audit Bill
                </h3>
                <p className="text-xs text-slate-500">
                  State why you dispute this audit bill for auditor and team review.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block">
                Quick Select Reason:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickDisputeReasons.map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDisputeRemarks(reason)}
                    className="text-[10px] px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-800 text-slate-700 rounded-md border border-slate-200 transition text-left cursor-pointer"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Dispute Remarks &amp; Explanation:
              </label>
              <textarea
                value={disputeRemarks}
                onChange={(e) => setDisputeRemarks(e.target.value)}
                placeholder="Describe the discrepancy in detail (e.g., items were physically returned, mismatch in counts)..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDisputeDialog(false)}
                disabled={disputing}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDisputeAction}
                disabled={disputing || !disputeRemarks.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{disputing ? 'Submitting Dispute...' : 'Submit Dispute / Reject Bill'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE DEDICATED AUDIT SETTLEMENT BILL (High-Res PDF & Direct Print)   */}
      {/* ========================================================================= */}
      <div
        id="printable-audit-settlement-bill"
        className="fixed -left-[99999px] top-0 w-[1050px] bg-white text-slate-900 p-8 font-sans z-[-1] pointer-events-none print:static print:w-full print:p-0 print:z-auto"
        style={{ backgroundColor: '#ffffff', minHeight: '100%' }}
      >
        {/* Header with Organization Details and Bill Title */}
        <div className="border-b-2 border-slate-800 pb-5 mb-5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-emerald-800">
              <Building2 className="w-8 h-8 text-emerald-700" />
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  KISAN SUPER MART &amp; PANTRY
                </h1>
                <p className="text-xs font-bold text-emerald-800 tracking-wide uppercase">
                  Household Pantry Audit Settlement &amp; Reconciliation Statement
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Central Distribution Hub &amp; Fulfillment Center, Main Road, Ranchi, Jharkhand - 834001
            </p>
            <p className="text-xs text-slate-500">
              GSTIN: 20AAAAA0000A1Z5 • Support: care@kisansmart.com | +91 98765 43210
            </p>
          </div>
          <div className="text-right">
            <span
              className={`inline-block px-3 py-1 font-extrabold text-xs rounded-md uppercase tracking-wider ${
                isLocked
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : isDisputed
                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {isLocked
                ? 'BILL CONFIRMED BY HOUSEHOLD (LOCKED)'
                : isDisputed
                ? 'DISPUTED BY HOUSEHOLD'
                : 'PENDING HOUSEHOLD CONFIRMATION'}
            </span>
            <p className="text-sm font-black text-slate-900 mt-2 font-mono tracking-tight">
              Bill No: {currentAudit.billId || currentAudit.id}
            </p>
            <p className="text-xs font-semibold text-slate-600 font-mono">
              Audit Ref: {currentAudit.id}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Generated: {currentAudit.billGeneratedDate || currentAudit.visitDate || 'Today'} •{' '}
              {currentAudit.billGeneratedTime || currentAudit.visitTime || ''}
            </p>
            <p className="text-xs text-indigo-700 font-bold">
              Version: {currentAudit.billVersion || 1}
            </p>
          </div>
        </div>

        {/* Customer & Field Auditor 2-Column Banner */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 text-xs">
          {/* Customer Details */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Customer Information
            </div>
            <div className="font-black text-slate-900 text-sm">{currentAudit.customerName}</div>
            <div className="text-slate-600">
              Customer ID: <strong className="font-mono text-slate-800">{currentAudit.customerId}</strong>
            </div>
            <div className="text-slate-600">
              Mobile: <strong>+91 {currentAudit.customerMobile || '9876543210'}</strong>
            </div>
            <div className="text-slate-600">
              Address: {currentAudit.customerAddress || 'Customer Residence'}
            </div>
          </div>

          {/* Field Auditor Details */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Field Auditor Verification
            </div>
            <div className="font-black text-slate-900 text-sm">{currentAudit.auditorName}</div>
            <div className="text-slate-600">
              Auditor ID: <strong className="font-mono text-slate-800">{currentAudit.auditorId}</strong>
            </div>
            <div className="text-slate-600">
              Visit Date &amp; Time: <strong>{currentAudit.visitDate || currentAudit.requestedDate} • {currentAudit.visitTime || '11:30 AM'}</strong>
            </div>
            <div className="text-slate-600">
              Inspection Duration: <strong>{currentAudit.durationFormatted || `${currentAudit.durationMinutes || 24} mins`}</strong>
            </div>
          </div>
        </div>

        {/* Financial Dual-Ledger Settlement Breakdown Box */}
        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 mb-5">
          <div className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
            <span>Dual-Ledger Financial Reconciliation &amp; Settlement Statement</span>
            <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold">
              OFFICIAL LEDGER RECORD
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Box 1: Prepaid Wallet Settlement */}
            <div className="bg-white border-2 border-rose-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-rose-800 tracking-wide">
                  Prepaid Customer Wallet Settlement
                </span>
                <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                  {isLocked ? 'SETTLED & DEDUCTED' : 'DEDUCTS ON CONFIRM'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-rose-100 text-xs">
                <div>
                  <span className="block text-[10px] text-slate-500">Wallet Before</span>
                  <span className="font-mono font-bold text-slate-800">₹{walletBefore}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-rose-700 font-bold">Missing Deduct</span>
                  <span className="font-mono font-black text-rose-700">-₹{totalWalletDeduction}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-emerald-800 font-bold">Closing Wallet</span>
                  <span className="font-mono font-black text-emerald-800">₹{walletAfter}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                * Settles discrepancy for {currentAudit.notAvailableCount ?? totals.miss} missing item(s) from customer prepaid wallet.
              </p>
            </div>

            {/* Box 2: Pantry Credit Limit Restoration */}
            <div className="bg-white border-2 border-emerald-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wide">
                  Pantry Card Credit Limit Settlement
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  {isLocked ? 'CREDITED & ACTIVE' : 'RESTORES ON CONFIRM'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-100 text-xs">
                <div>
                  <span className="block text-[10px] text-slate-500">Limit Before</span>
                  <span className="font-mono font-bold text-slate-800">₹{creditLimitBefore}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-emerald-700 font-bold">Credit Restored</span>
                  <span className="font-mono font-black text-emerald-700">+₹{totalCreditRestored}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-emerald-900 font-bold">Available Limit</span>
                  <span className="font-mono font-black text-emerald-900">₹{creditLimitAfter}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                * Restores credit limit for {currentAudit.returnsInitiatedCount ?? totals.ret} returned and {(currentAudit as any).pantryPayCount ?? totals.pantryPay} pantry pay item(s).
              </p>
            </div>
          </div>
        </div>

        {/* Audit Metrics Count Row */}
        <div className="grid grid-cols-7 gap-1.5 bg-slate-100 p-2 rounded-xl border border-slate-200 mb-4 text-center text-xs">
          <div>
            <span className="block text-[9px] font-bold text-slate-500 uppercase">Inspected</span>
            <span className="font-black text-slate-900 text-xs">{currentAudit.totalItemsCount || totals.qty} Items</span>
          </div>
          <div>
            <span className="block text-[9px] font-bold text-emerald-700 uppercase">Available</span>
            <span className="font-black text-emerald-700 text-xs">{currentAudit.availableCount ?? totals.avail}</span>
          </div>
          <div>
            <span className="block text-[9px] font-bold text-amber-700 uppercase">Missing</span>
            <span className="font-black text-amber-700 text-xs">{currentAudit.notAvailableCount ?? totals.miss}</span>
          </div>
          <div>
            <span className="block text-[9px] font-bold text-rose-700 uppercase">Damaged</span>
            <span className="font-black text-rose-700 text-xs">{currentAudit.damagedCount ?? totals.dmg}</span>
          </div>
          <div>
            <span className="block text-[9px] font-bold text-orange-700 uppercase">Return</span>
            <span className="font-black text-orange-700 text-xs">{currentAudit.returnsInitiatedCount ?? totals.ret}</span>
          </div>
          <div>
            <span className="block text-[9px] font-bold text-indigo-700 uppercase">Replace</span>
            <span className="font-black text-indigo-700 text-xs">{currentAudit.replacementsInitiatedCount ?? totals.rep}</span>
          </div>
          <div>
            <span className="block text-[9px] font-bold text-cyan-700 uppercase">Pantry Pay</span>
            <span className="font-black text-cyan-700 text-xs">{(currentAudit as any).pantryPayCount ?? totals.pantryPay}</span>
          </div>
        </div>

        {/* Complete Item-by-Item Verification Table (UNCLIPPED, COMPACT FOR UP TO 200 ITEMS) */}
        <div className="mb-4">
          <div className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Item-by-Item Physical Verification &amp; Discrepancy Breakdown</span>
            <span className="text-[10px] text-slate-500 font-normal">
              Showing all {currentAudit.itemsChecked.length} audited items
            </span>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-[10px] text-left">
            <thead>
              <tr className="bg-slate-200 text-slate-800 font-black uppercase text-[8px] tracking-wider border-b border-slate-300">
                <th className="p-1 border border-slate-300 text-center w-6">#</th>
                <th className="p-1 border border-slate-300">Product Name &amp; Batch</th>
                <th className="p-1 border border-slate-300 text-center w-10">Qty</th>
                <th className="p-1 border border-slate-300 text-center w-10 text-emerald-800">Available</th>
                <th className="p-1 border border-slate-300 text-center w-10 text-amber-800">Missing</th>
                <th className="p-1 border border-slate-300 text-center w-10 text-rose-800">Damaged</th>
                <th className="p-1 border border-slate-300 text-center w-10 text-orange-800">Return</th>
                <th className="p-1 border border-slate-300 text-center w-10 text-indigo-800">Replace</th>
                <th className="p-1 border border-slate-300 text-center w-10 text-cyan-800">Pantry Pay</th>
                <th className="p-1 border border-slate-300 text-right w-14">Price</th>
                <th className="p-1 border border-slate-300 text-right w-16 text-rose-800">Wallet (-₹)</th>
                <th className="p-1 border border-slate-300 text-right w-16 text-emerald-800">Limit (+₹)</th>
                <th className="p-1 border border-slate-300 text-center w-16">Status</th>
                <th className="p-1 border border-slate-300">Auditor Remarks</th>
              </tr>
            </thead>
            <tbody>
              {currentAudit.itemsChecked.map((it, idx) => {
                const itemRate =
                  it.productPrice ??
                  (it as any).unitPrice ??
                  (it as any).price ??
                  (it as any).rate ??
                  (it as any).sellingPrice ??
                  100;

                const itemWalletDeduct =
                  it.walletDeductionAmount !== undefined
                    ? it.walletDeductionAmount
                    : (it.qtyMissing || 0) * itemRate;

                const itemLimitRestore =
                  (it as any).limitRestoreAmount !== undefined
                    ? (it as any).limitRestoreAmount
                    : ((it.qtyReturn || 0) + (it.qtyPantryPay || 0)) * itemRate;

                const prodName =
                  it.productName ||
                  (it as any).name ||
                  (it as any).title ||
                  (it as any).pantryCardItemName ||
                  (it as any).product_name ||
                  (it as any).item_name ||
                  'Grocery Pantry Item';

                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-200 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                    }`}
                  >
                    <td className="p-1 border border-slate-300 text-center font-mono text-slate-500 text-[9px]">
                      {idx + 1}
                    </td>
                    <td className="p-1 border border-slate-300">
                      <div className="font-bold text-slate-900 text-[10px] leading-tight">
                        {prodName}
                      </div>
                      <div className="text-[8px] font-mono text-slate-500">
                        Batch: {it.batchNumber || 'N/A'} {it.expiryDate ? `• Exp: ${it.expiryDate}` : ''}
                      </div>
                    </td>
                    <td className="p-1 border border-slate-300 text-center font-black text-slate-900 text-[10px]">
                      {it.quantity || (it as any).systemQuantity || 1}
                    </td>
                    <td className="p-1 border border-slate-300 text-center font-black text-emerald-700 bg-emerald-50/30 text-[10px]">
                      {it.qtyAvailable ?? '-'}
                    </td>
                    <td className="p-1 border border-slate-300 text-center font-black text-amber-700 bg-amber-50/30 text-[10px]">
                      {it.qtyMissing ?? '-'}
                    </td>
                    <td className="p-1 border border-slate-300 text-center font-black text-rose-700 bg-rose-50/30 text-[10px]">
                      {it.qtyDamaged ?? '-'}
                    </td>
                    <td className="p-1 border border-slate-300 text-center font-black text-orange-700 bg-orange-50/30 text-[10px]">
                      {it.qtyReturn ?? '-'}
                    </td>
                    <td className="p-1 border border-slate-300 text-center font-black text-indigo-700 bg-indigo-50/30 text-[10px]">
                      {it.qtyReplacement ?? '-'}
                    </td>
                    <td className="p-1 border border-slate-300 text-center font-black text-cyan-700 bg-cyan-50/30 text-[10px]">
                      {it.qtyPantryPay ?? '-'}
                    </td>
                    <td className="p-1 border border-slate-300 text-right font-mono font-bold text-slate-800 text-[9px]">
                      ₹{itemRate}
                    </td>
                    <td className="p-1 border border-slate-300 text-right font-mono font-black text-rose-700 text-[9px]">
                      {itemWalletDeduct > 0 ? `-₹${itemWalletDeduct}` : '₹0'}
                    </td>
                    <td className="p-1 border border-slate-300 text-right font-mono font-black text-emerald-700 text-[9px]">
                      {itemLimitRestore > 0 ? `+₹${itemLimitRestore}` : '₹0'}
                    </td>
                    <td className="p-1 border border-slate-300 text-center font-bold text-[8px]">
                      <span
                        className={`inline-block px-1 py-0.5 rounded font-mono ${
                          it.verificationStatus === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : it.verificationStatus === 'NOT_AVAILABLE'
                            ? 'bg-amber-100 text-amber-800'
                            : it.verificationStatus === 'DAMAGED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {it.verificationStatus}
                      </span>
                    </td>
                    <td className="p-1 border border-slate-300 text-[9px] text-slate-700 font-medium">
                      {it.remarks || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200/90 font-black text-slate-900 border-t-2 border-slate-400">
                <td colSpan={2} className="p-2 border border-slate-300 uppercase text-right">
                  Total Summary:
                </td>
                <td className="p-2 border border-slate-300 text-center font-black">{totals.qty}</td>
                <td className="p-2 border border-slate-300 text-center text-emerald-800 font-black">
                  {totals.avail}
                </td>
                <td className="p-2 border border-slate-300 text-center text-amber-800 font-black">
                  {totals.miss}
                </td>
                <td className="p-2 border border-slate-300 text-center text-rose-800 font-black">
                  {totals.dmg}
                </td>
                <td className="p-2 border border-slate-300 text-center text-orange-800 font-black">
                  {totals.ret}
                </td>
                <td className="p-2 border border-slate-300 text-center text-indigo-800 font-black">
                  {totals.rep}
                </td>
                <td className="p-2 border border-slate-300 text-center text-cyan-800 font-black">
                  {totals.pantryPay}
                </td>
                <td className="p-2 border border-slate-300 text-right font-mono">-</td>
                <td className="p-2 border border-slate-300 text-right font-mono font-black text-rose-800">
                  {totals.walletDeduct > 0 ? `-₹${totals.walletDeduct}` : '₹0'}
                </td>
                <td className="p-2 border border-slate-300 text-right font-mono font-black text-emerald-800">
                  {totals.limitRestore > 0 ? `+₹${totals.limitRestore}` : '₹0'}
                </td>
                <td colSpan={2} className="p-2 border border-slate-300 text-center text-[10px] text-slate-600">
                  Verified by Field Auditor
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Auditor Remarks Section */}
        {currentAudit.overallRemarks && (
          <div className="border border-slate-300 bg-slate-50 p-3 rounded-xl mb-5 text-xs">
            <span className="font-bold text-slate-800 block text-[11px] mb-1">
              Field Auditor Observations &amp; Verification Remarks:
            </span>
            <p className="text-slate-700 leading-relaxed">{currentAudit.overallRemarks}</p>
          </div>
        )}

        {/* Legal Signatures & Digital Certification Stamps */}
        <div className="grid grid-cols-2 gap-4 border-t-2 border-slate-300 pt-4 mb-4 text-xs">
          {/* Auditor Sign-off */}
          <div className="border border-slate-300 p-3.5 rounded-xl bg-slate-50/50 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Field Auditor Digital Sign-Off
            </div>
            <div className="font-black text-slate-900 text-sm">{currentAudit.auditorName}</div>
            <div className="text-emerald-800 font-bold text-xs flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> Physically Inspected &amp; Certified
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Timestamp: {currentAudit.billGeneratedDate || currentAudit.visitDate} • {currentAudit.billGeneratedTime || currentAudit.visitTime || ''}
            </div>
          </div>

          {/* Household Confirmation Seal */}
          <div
            className={`border-2 border-dashed p-3.5 rounded-xl space-y-1 text-center ${
              isLocked
                ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950'
                : isDisputed
                ? 'border-rose-500 bg-rose-50/70 text-rose-950'
                : 'border-amber-500 bg-amber-50/70 text-amber-950'
            }`}
          >
            <div className="text-[10px] font-black uppercase tracking-wider">
              Household Confirmation Seal
            </div>
            <div className="font-black text-sm uppercase">
              {isLocked
                ? 'BILL CONFIRMED BY HOUSEHOLD'
                : isDisputed
                ? 'DISPUTED BY HOUSEHOLD'
                : 'PENDING HOUSEHOLD ACCEPTANCE'}
            </div>
            {isLocked ? (
              <>
                <div className="text-xs font-bold text-emerald-800">
                  PERMANENTLY LOCKED &amp; SETTLED • IMMUTABLE AUDIT CERTIFICATION
                </div>
                <div className="text-[10px] font-mono text-emerald-700">
                  Confirmed: {currentAudit.billConfirmedDate || currentAudit.visitDate} {currentAudit.billConfirmedTime || ''} | Signed By: {currentAudit.billConfirmedBy || currentAudit.customerName}
                </div>
              </>
            ) : isDisputed ? (
              <div className="text-[10px] font-bold text-rose-800">
                Discrepancy reported. Under review by Field Audit team.
              </div>
            ) : (
              <div className="text-[10px] font-bold text-amber-800">
                Awaiting household signature to finalize and lock settlement.
              </div>
            )}
          </div>
        </div>

        {/* Footnote & System Certification */}
        <div className="text-[9px] text-slate-400 border-t border-slate-200 pt-2 flex justify-between items-center">
          <span>
            This is an official computer-generated Audit Settlement Statement &amp; Reconciliation Tax Invoice. No physical signature required.
          </span>
          <span className="font-mono">
            Security ID: {currentAudit.id}-{currentAudit.billId || 'ORIGINAL'} • Certified
          </span>
        </div>
      </div>
    </AppWindowModal>
  );
};
