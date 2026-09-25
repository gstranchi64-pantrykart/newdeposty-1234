import React, { useState, useEffect } from 'react';
import {
  ProductBatch,
  InventoryTransaction,
  AuditLog,
  AppSettings,
  Order,
  WalletTransaction,
  AuditorCheck,
  Customer,
  PantryPayment,
} from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { AuditBillModal } from '../common/AuditBillModal';
import { MasterActivityMonitor } from './MasterActivityMonitor';
import { ApiIntegrationsSettings } from './ApiIntegrationsSettings';
import { BatchDetailHistoryModal } from './BatchDetailHistoryModal';
import { BarcodeDetailHistoryModal } from './BarcodeDetailHistoryModal';
import { CustomerPantryLiveLedger } from './CustomerPantryLiveLedger';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  FileText,
  Boxes,
  Clock,
  Banknote,
  ShieldCheck,
  Settings,
  Search,
  RefreshCw,
  Sliders,
  Calendar,
  Store,
  CheckCircle,
  AlertTriangle,
  Wallet,
  ClipboardCheck,
  Eye,
  QrCode,
  TrendingUp,
  CreditCard,
  Zap,
  Barcode,
  Users,
  Download,
  Loader2,
} from 'lucide-react';
import { exportElementToPdf } from '../../utils/pdfGenerator';

interface ReportsAndLogsAdminProps {
  initialReport?: string;
}

export const ReportsAndLogsAdmin: React.FC<ReportsAndLogsAdminProps> = ({ initialReport }) => {
  const [activeReport, setActiveReport] = useState<
    'batch-lifecycle' | 'expiry-report' | 'cod-report' | 'wallet-report' | 'field-audits' | 'pantry-pay-analytics' | 'pantry-customer-stock' | 'audit-logs' | 'settings'
  >(
    initialReport === 'pantry-stock' || initialReport === 'pantry-customer-stock'
      ? 'pantry-customer-stock'
      : initialReport === 'pantry-pay'
      ? 'pantry-pay-analytics'
      : initialReport === 'logs'
      ? 'audit-logs'
      : initialReport === 'cod'
      ? 'cod-report'
      : initialReport === 'auditor'
      ? 'field-audits'
      : initialReport === 'wallet'
      ? 'wallet-report'
      : 'batch-lifecycle'
  );

  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [inventoryTxns, setInventoryTxns] = useState<InventoryTransaction[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [walletTxns, setWalletTxns] = useState<WalletTransaction[]>([]);
  const [auditorChecks, setAuditorChecks] = useState<AuditorCheck[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pantryPayments, setPantryPayments] = useState<PantryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingReportPdf, setIsGeneratingReportPdf] = useState(false);

  // Selected batch detail history modal
  const [selectedBatchHistoryNumber, setSelectedBatchHistoryNumber] = useState<string | null>(null);
  const [selectedBarcodeHistory, setSelectedBarcodeHistory] = useState<string | null>(null);

  // Selected audit modal
  const [selectedAuditForView, setSelectedAuditForView] = useState<AuditorCheck | null>(null);

  // Settings edit state
  const [settingsSubTab, setSettingsSubTab] = useState<'api-integrations' | 'general'>('api-integrations');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    defaultPantryLimit: 10000,
    pantryReturnWindowDays: 15,
    nearExpiryDays: 30,
    lowStockThreshold: 5,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bList, oList, logs, txns, sett, wTxns, aChecks, cList, pPayList] = await Promise.all([
        api.getBatches(),
        api.getOrders(),
        api.getAuditLogs(),
        api.getInventoryTransactions(),
        api.getSettings(),
        api.getWalletTransactions().catch(() => []),
        api.getAuditorChecks().catch(() => []),
        api.getCustomers(),
        api.getAllPantryPayments().catch(() => []),
      ]);
      setBatches(bList);
      setOrders(oList);
      setAuditLogs(logs);
      setInventoryTxns(txns);
      setSettings(sett);
      setWalletTxns(wTxns);
      setAuditorChecks(aChecks);
      setCustomers(cList);
      setPantryPayments(pPayList);
      if (sett) {
        setSettingsForm({
          defaultPantryLimit: sett.defaultPantryLimit,
          pantryReturnWindowDays: sett.pantryReturnWindowDays || 15,
          nearExpiryDays: sett.nearExpiryDays || 30,
          lowStockThreshold: sett.lowStockThreshold || 5,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const updated = await api.updateSettings(settingsForm);
      setSettings(updated);
      alert('System settings updated successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Calculations for Wallet Metrics
  const totalWalletDeposited = walletTxns
    .filter((w) => w.transactionType === 'ADMIN_RECHARGE')
    .reduce((acc, w) => acc + (w.amount || 0), 0);

  const totalAuditDeductions = walletTxns
    .filter((w) => w.transactionType === 'AUDIT_DEDUCTION')
    .reduce((acc, w) => acc + Math.abs(w.amount || 0), 0);

  const totalCurrentCustomerWalletBalance = customers.reduce(
    (acc, c) => acc + (c.walletBalance ?? 1000),
    0
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <span>Reports, Compliance, Wallets &amp; Field Audits</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lifecycle traceability, COD settlements, prepaid wallet ledgers, field verification records, and system settings.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={async () => {
                setIsGeneratingReportPdf(true);
                try {
                  await exportElementToPdf('printable-admin-report', {
                    filename: `AuditReport-${activeReport}-${new Date().toISOString().slice(0, 10)}.pdf`,
                    orientation: 'landscape',
                  });
                } catch (err) {
                  console.error('Failed to export report PDF:', err);
                } finally {
                  setIsGeneratingReportPdf(false);
                }
              }}
              disabled={isGeneratingReportPdf || loading}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Download Current Report as PDF"
            >
              {isGeneratingReportPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report (PDF)</span>
                </>
              )}
            </button>
            <button
              onClick={fetchData}
              className="p-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 text-xs transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Report Tabs */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveReport('batch-lifecycle')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReport === 'batch-lifecycle'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            Batch Stock Lifecycle
          </button>

          <button
            onClick={() => setActiveReport('expiry-report')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReport === 'expiry-report'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Expiry Management Analysis
          </button>

          <button
            onClick={() => setActiveReport('cod-report')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReport === 'cod-report'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Banknote className="w-4 h-4" />
            Quick COD Collection
          </button>

          <button
            onClick={() => setActiveReport('wallet-report')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReport === 'wallet-report'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Customer Wallet &amp; Audit Deductions
          </button>

          <button
            onClick={() => setActiveReport('pantry-pay-analytics')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReport === 'pantry-pay-analytics'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            Pantry Pay Collections ({pantryPayments.length})
          </button>

          <button
            onClick={() => setActiveReport('pantry-customer-stock')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReport === 'pantry-customer-stock'
                ? 'border-purple-600 text-purple-600 bg-purple-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-purple-600" />
            Live Customer Pantry Stock Ledger
          </button>

          <button
            onClick={() => setActiveReport('field-audits')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReport === 'field-audits'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Field Audit Verification ({auditorChecks.length})
          </button>

          <button
            onClick={() => setActiveReport('audit-logs')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReport === 'audit-logs'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            System Audit Trail ({auditLogs.length})
          </button>

          <button
            onClick={() => setActiveReport('settings')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReport === 'settings'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            System Configuration
          </button>
        </div>
      </div>

      {/* Printable Report Wrapper */}
      <div id="printable-admin-report" className="space-y-5">
        {/* REPORT 1: Batch Stock Lifecycle */}
      {activeReport === 'batch-lifecycle' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Batch-Wise Inventory Lifecycle &amp; Shopkeeper Traceability Report
              </h3>
              <p className="text-xs text-slate-500">
                Shows exact quantities purchased, sold (Quick vs Pantry), returned, and shopkeeper source.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Product, Batch, Shopkeeper..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3">Barcode</th>
                  <th className="py-3 px-3">Batch Number</th>
                  <th className="py-3 px-3">MFG &amp; EXP</th>
                  <th className="py-3 px-3 text-center">Purchased</th>
                  <th className="py-3 px-3 text-center">Quick Sold</th>
                  <th className="py-3 px-3 text-center">Pantry Sold</th>
                  <th className="py-3 px-3 text-center">Returned</th>
                  <th className="py-3 px-3 text-center">Available</th>
                  <th className="py-3 px-3">Shopkeeper Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {batches
                  .filter((b) => {
                    const q = searchQuery.toLowerCase();
                    return (
                      !q ||
                      b.productName.toLowerCase().includes(q) ||
                      b.batchNumber.toLowerCase().includes(q) ||
                      b.barcode.includes(q) ||
                      b.shopkeeperName.toLowerCase().includes(q)
                    );
                  })
                  .map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">{b.productName}</td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => setSelectedBarcodeHistory(b.barcode)}
                          className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 transition cursor-pointer font-mono text-[11px] font-bold inline-flex items-center gap-1"
                          title="Click to view merged Barcode-level inventory & sales lifecycle"
                        >
                          <Barcode className="w-3 h-3 text-indigo-600" />
                          <span>{b.barcode}</span>
                        </button>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">
                        <button
                          onClick={() => setSelectedBatchHistoryNumber(b.batchNumber)}
                          className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200 transition cursor-pointer font-bold inline-flex items-center gap-1"
                          title="Click to view complete purchase and sales lifecycle"
                        >
                          <span>#{b.batchNumber}</span>
                        </button>
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        <div>MFG: {b.manufacturingDate}</div>
                        <div className="font-semibold text-slate-800">EXP: {b.expiryDate}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{b.purchaseQuantity}</td>
                      <td className="py-3 px-3 text-center text-amber-700 font-medium">
                        {b.quickSoldQuantity || 0}
                      </td>
                      <td className="py-3 px-3 text-center text-purple-700 font-medium">
                        {b.pantrySoldQuantity || 0}
                      </td>
                      <td className="py-3 px-3 text-center text-emerald-700 font-medium">
                        {b.returnedQuantity || 0}
                      </td>
                      <td className="py-3 px-3 text-center font-black text-slate-900">
                        {b.availableQuantity}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">{b.shopkeeperName}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 2: Expiry Analysis */}
      {activeReport === 'expiry-report' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">Product Expiry Risk Analysis</h3>
            <p className="text-xs text-slate-500">
              Categorized view of batches nearing expiry or past shelf life.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3">Batch Number</th>
                  <th className="py-3 px-3">Expiry Date</th>
                  <th className="py-3 px-3 text-center">Available Units</th>
                  <th className="py-3 px-3">Stock Valuation</th>
                  <th className="py-3 px-3">Risk Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => {
                  const expTime = new Date(b.expiryDate).getTime();
                  const now = new Date().getTime();
                  const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
                  const isExpired = diffDays <= 0;
                  const isNearExpiry = diffDays > 0 && diffDays <= 30;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">{b.productName}</td>
                      <td className="py-3 px-3 font-mono font-bold">
                        <button
                          onClick={() => setSelectedBatchHistoryNumber(b.batchNumber)}
                          className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200 transition cursor-pointer font-bold inline-flex items-center gap-1"
                          title="Click to view complete purchase and sales lifecycle"
                        >
                          <span>#{b.batchNumber}</span>
                        </button>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">{b.expiryDate}</td>
                      <td className="py-3 px-3 text-center font-bold">{b.availableQuantity}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        ₹{(b.availableQuantity * b.purchaseRate).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isExpired
                              ? 'bg-rose-100 text-rose-800'
                              : isNearExpiry
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isExpired ? 'EXPIRED' : isNearExpiry ? `NEAR EXPIRY (${diffDays}d)` : 'FRESH'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: Quick COD Collection */}
      {activeReport === 'cod-report' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">Quick Order Cash on Delivery (COD) Collections</h3>
            <p className="text-xs text-slate-500">
              Orders requiring cash collection at doorstep (strictly separated from Pantry Limit &amp; Pre-paid Wallets).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Order ID &amp; Date</th>
                  <th className="py-3 px-3">Customer Name</th>
                  <th className="py-3 px-3">Delivery Partner</th>
                  <th className="py-3 px-3 text-right">COD Amount</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">COD Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders
                  .filter((o) => o.paymentMethod === 'COD' || o.orderType === 'QUICK')
                  .map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <div>{o.id}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{o.createdAt}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{o.customerName}</td>
                      <td className="py-3 px-3 text-slate-700">{o.assignedDeliveryPartnerName || 'Unassigned'}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">
                        ₹{o.totalAmount}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={o.orderStatus} />
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.codCollected
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {o.codCollected ? 'COLLECTED & SETTLED' : 'PENDING DOORSTEP COLLECTION'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: Customer Wallet & Audit Deductions Ledger */}
      {activeReport === 'wallet-report' && (
        <div className="space-y-4">
          {/* Summary Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Total Customer Wallets Balance</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                ₹{totalCurrentCustomerWalletBalance.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Prepaid advance customer funds</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Total Admin Wallet Top-ups</div>
              <div className="text-2xl font-black text-purple-700 mt-1">
                ₹{totalWalletDeposited.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Total recharges processed</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Total Physical Audit Deductions</div>
              <div className="text-2xl font-black text-rose-700 mt-1">
                ₹{totalAuditDeductions.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Deducted for missing pantry stock</div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Customer Pre-paid Wallet Transactions Ledger</span>
              </h3>
              <p className="text-xs text-slate-500">
                Detailed ledger of all advance wallet top-ups and doorstep field audit discrepancy deductions.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Txn ID &amp; Date</th>
                    <th className="py-3 px-3">Customer ID &amp; Name</th>
                    <th className="py-3 px-3">Transaction Type</th>
                    <th className="py-3 px-3">Reason / Audit Ref</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {walletTxns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No wallet transactions recorded in system.
                      </td>
                    </tr>
                  ) : (
                    walletTxns.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <div>{w.id}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {w.date} {w.time}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          <div>{w.customerName || w.customerId}</div>
                          <div className="text-[10px] font-mono text-slate-400">{w.customerId}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              w.transactionType === 'ADMIN_RECHARGE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {w.transactionType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-medium">{w.reason}</div>
                          {w.auditId && <div className="text-[10px] font-mono text-slate-400">Ref: {w.auditId}</div>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {w.amount > 0 ? (
                            <span className="text-emerald-600">+₹{w.amount}</span>
                          ) : (
                            <span className="text-rose-600">-₹{Math.abs(w.amount)}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{w.newBalance}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 5: Pantry Pay Collections & Recharts Analytics */}
      {activeReport === 'pantry-pay-analytics' && (() => {
        const totalAmount = pantryPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const confirmedCount = pantryPayments.filter((p) => p.auditorConfirmationStatus === 'CONFIRMED').length;
        const pendingCount = pantryPayments.filter((p) => p.auditorConfirmationStatus === 'PENDING').length;
        const upiCount = pantryPayments.filter((p) => p.paymentMethod === 'UPI').length;
        const bankCount = pantryPayments.filter((p) => p.paymentMethod === 'BANK').length;

        // Group by Date for Recharts BarChart
        const dateMap: Record<string, { date: string; amount: number; count: number }> = {};
        pantryPayments.forEach((p) => {
          const dateStr = p.createdAt ? p.createdAt.split('T')[0] : 'Today';
          if (!dateMap[dateStr]) {
            dateMap[dateStr] = { date: dateStr, amount: 0, count: 0 };
          }
          dateMap[dateStr].amount += p.amount || 0;
          dateMap[dateStr].count += 1;
        });

        const chartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

        // Pie chart data for Payment Methods
        const pieData = [
          { name: 'UPI Payment', value: upiCount || 1, color: '#10b981' },
          { name: 'Bank Transfer', value: bankCount || 0, color: '#6366f1' },
        ].filter((d) => d.value > 0);

        // Product grouping
        const productMap: Record<string, { name: string; count: number; total: number; barcode: string }> = {};
        pantryPayments.forEach((p) => {
          if (!productMap[p.productName]) {
            productMap[p.productName] = { name: p.productName, count: 0, total: 0, barcode: p.barcode };
          }
          productMap[p.productName].count += 1;
          productMap[p.productName].total += p.amount || 0;
        });
        const topProducts = Object.values(productMap).sort((a, b) => b.total - a.total);

        return (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="p-5 bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white rounded-2xl shadow-md border border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg text-white">Pantry Pay Direct Collections &amp; Analytics</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                    UPI / Bank Direct
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Recharts visual trends, daily collection revenue, payment method breakdowns, and auditor verification status.
                </p>
              </div>

              <div className="bg-emerald-950/80 border border-emerald-500/30 rounded-xl p-3 text-right">
                <div className="text-[10px] text-emerald-400 font-bold uppercase">Total Revenue Collected</div>
                <div className="text-2xl font-black text-emerald-300">₹{totalAmount.toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Total Collections</span>
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Across {pantryPayments.length} transactions</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Auditor Confirmed</span>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                  {confirmedCount}
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5">Verified &amp; locked</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Pending Auditor Action</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-extrabold text-amber-700 mt-1">
                  {pendingCount}
                </div>
                <div className="text-[11px] text-amber-600 mt-0.5">Awaiting physical check</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>UPI / Bank Ratio</span>
                  <Zap className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  {upiCount} UPI / {bankCount} Bank
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Direct merchant settlements</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Revenue Bar Chart (Recharts) */}
              <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span>Daily Pantry Pay Revenue Trend (₹)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">Aggregated collection amount per day</p>
                  </div>
                </div>

                <div className="h-64 w-full pt-2">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          formatter={(val: any) => [`₹${val}`, 'Daily Revenue']}
                          contentStyle={{ borderRadius: '12px', fontSize: '12px', borderColor: '#cbd5e1' }}
                        />
                        <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} name="Amount (₹)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No daily trend data available yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods Distribution Pie Chart */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    <span>Payment Methods Distribution</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">UPI vs Bank Transfer</p>
                </div>

                <div className="h-64 w-full flex items-center justify-center">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(val: any) => [`${val} txns`, 'Count']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-xs text-slate-400">No payment data</div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Purchased Products via Pantry Pay */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
              <div className="border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-amber-600" />
                  <span>Top Products Paid via Pantry Pay</span>
                </h4>
                <p className="text-[11px] text-slate-500">Products with highest direct Pantry Pay sales</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topProducts.slice(0, 6).map((prod) => (
                  <div key={prod.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{prod.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Barcode: {prod.barcode}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-700 text-sm">₹{prod.total}</div>
                      <div className="text-[10px] text-slate-400 font-bold">{prod.count} units</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction Log Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">All Pantry Pay Transaction Records</h4>
                  <p className="text-xs text-slate-500">Independent transaction ledger log</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Txn ID</th>
                      <th className="py-3 px-3">Customer ID</th>
                      <th className="py-3 px-3">Product Name</th>
                      <th className="py-3 px-3">Barcode</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Auditor Confirmation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pantryPayments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No Pantry Pay transactions found.
                        </td>
                      </tr>
                    ) : (
                      pantryPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.id}</td>
                          <td className="py-3 px-3 font-mono">{p.customerId}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{p.productName}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => setSelectedBarcodeHistory(p.barcode)}
                              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-200 transition cursor-pointer inline-flex items-center gap-1"
                              title="Click to view full Barcode lifecycle"
                            >
                              <Barcode className="w-3 h-3 text-indigo-600" />
                              <span>{p.barcode}</span>
                            </button>
                          </td>
                          <td className="py-3 px-3 font-semibold text-purple-700">{p.paymentMethod}</td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-700 font-mono">₹{p.amount}</td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-700">{p.paymentStatus}</td>
                          <td className="py-3 px-3 text-center font-bold">
                            {p.auditorConfirmationStatus === 'CONFIRMED' ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                                CONFIRMED
                              </span>
                            ) : (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px]">
                                PENDING
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* REPORT 6: Field Audit Verification Reports */}
      {activeReport === 'field-audits' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-cyan-600" />
                <span>Field Audit Verification Reports &amp; Household Visits</span>
              </h3>
              <p className="text-xs text-slate-500">
                Physical pantry verification checks, missing item counts, wallet settlements, and sign-offs.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Audit ID &amp; Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Auditor</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Inspected</th>
                  <th className="py-3 px-3 text-center">Available</th>
                  <th className="py-3 px-3 text-center">Missing</th>
                  <th className="py-3 px-3 text-right">Wallet Deducted</th>
                  <th className="py-3 px-3 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditorChecks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No field audit checks conducted yet.
                    </td>
                  </tr>
                ) : (
                  auditorChecks.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <div>{a.id}</div>
                        <div className="text-[10px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-cyan-600 shrink-0" />
                          <span>{a.visitDate || a.requestedDate || 'N/A'}</span>
                          <Clock className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
                          <span>{a.visitTime || (a.startedAt ? a.startedAt.split(' ')[1] : a.requestedTime) || '11:00 AM'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{a.customerName}</td>
                      <td className="py-3 px-3 text-slate-700">{a.auditorName}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={a.status as any} />
                      </td>
                      <td className="py-3 px-3 text-center font-bold">{a.totalItemsCount}</td>
                      <td className="py-3 px-3 text-center text-emerald-700 font-bold">{a.availableCount}</td>
                      <td className="py-3 px-3 text-center text-amber-700 font-bold">{a.notAvailableCount || 0}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                        ₹{a.totalWalletDeduction || 0}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedAuditForView(a)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-cyan-700" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 6: Live Customer Pantry Stock Ledger */}
      {activeReport === 'pantry-customer-stock' && (
        <CustomerPantryLiveLedger
          onOpenBatchHistory={(batchNo) => setSelectedBatchHistoryNumber(batchNo)}
          onOpenBarcodeHistory={(barcode) => setSelectedBarcodeHistory(barcode)}
        />
      )}

      {/* REPORT 7: System Audit Trail */}
      {activeReport === 'audit-logs' && <MasterActivityMonitor />}

      {/* REPORT 8: Global System & API Configuration */}
      {activeReport === 'settings' && (
        <div className="space-y-6">
          {/* Sub-tab selection bar */}
          <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 max-w-md">
            <button
              onClick={() => setSettingsSubTab('api-integrations')}
              className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition cursor-pointer text-center ${
                settingsSubTab === 'api-integrations'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔌 All API Settings &amp; Gateways
            </button>
            <button
              onClick={() => setSettingsSubTab('general')}
              className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition cursor-pointer text-center ${
                settingsSubTab === 'general'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚙️ General Parameters
            </button>
          </div>

          {settingsSubTab === 'api-integrations' && settings && (
            <ApiIntegrationsSettings
              settings={settings}
              onUpdateSettings={(updated) => setSettings(updated)}
            />
          )}

          {settingsSubTab === 'general' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs max-w-2xl p-6">
              <h3 className="text-base font-bold text-slate-900 mb-1">Global System Parameters</h3>
              <p className="text-xs text-slate-500 mb-6">
                Configure default credit allowances, return policies, and automated threshold alerts.
              </p>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Customer Pantry Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={settingsForm.defaultPantryLimit}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, defaultPantryLimit: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Allowed Return Window for Pantry Items (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settingsForm.pantryReturnWindowDays}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, pantryReturnWindowDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Items delivered within this timeframe can be returned for full credit restore.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Near Expiry Alert Warning Threshold (Days)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="90"
                    value={settingsForm.nearExpiryDays}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, nearExpiryDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low Stock Threshold (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settingsForm.lowStockThreshold}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, lowStockThreshold: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition cursor-pointer"
                  >
                    {savingSettings ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
      </div>

      {/* VIEW AUDIT DETAILS MODAL - Using Standard AuditBillModal */}
      {selectedAuditForView && (
        <AuditBillModal
          audit={selectedAuditForView}
          onClose={() => setSelectedAuditForView(null)}
          isAdminView={true}
        />
      )}

      {/* BATCH LIFECYCLE AUDIT MODAL */}
      {selectedBatchHistoryNumber && (
        <BatchDetailHistoryModal
          batchIdentifier={selectedBatchHistoryNumber}
          isOpen={!!selectedBatchHistoryNumber}
          onClose={() => setSelectedBatchHistoryNumber(null)}
          onOpenBarcodeHistory={(barcode) => {
            setSelectedBatchHistoryNumber(null);
            setSelectedBarcodeHistory(barcode);
          }}
        />
      )}

      {/* BARCODE LIFECYCLE AUDIT MODAL */}
      {selectedBarcodeHistory && (
        <BarcodeDetailHistoryModal
          barcode={selectedBarcodeHistory}
          isOpen={!!selectedBarcodeHistory}
          onClose={() => setSelectedBarcodeHistory(null)}
          onOpenBatchHistory={(batchNo) => {
            setSelectedBarcodeHistory(null);
            setSelectedBatchHistoryNumber(batchNo);
          }}
        />
      )}
    </div>
  );
};
