import React, { useState, useEffect } from 'react';
import {
  DeliveryBoy,
  Auditor,
  Order,
  Customer,
  AuditorCheck,
  ReturnRequest,
  ReplacementRequest,
  Product,
} from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { AuditBillModal } from '../common/AuditBillModal';
import { AppWindowModal } from '../common/AppWindowModal';
import {
  Truck,
  ClipboardCheck,
  Users,
  PlusCircle,
  Search,
  RefreshCw,
  Phone,
  MapPin,
  Bike,
  Power,
  Eye,
  FileText,
  Printer,
  X,
  CheckCircle,
  Building,
  Mail,
  Activity,
  Package,
  Calendar,
  Clock,
  Zap,
  Edit2,
  CheckSquare,
  Square,
  AlertTriangle,
  Receipt,
  Image as ImageIcon,
  Download,
  Loader2,
} from 'lucide-react';
import { exportElementToPdf } from '../../utils/pdfGenerator';

interface DeliveryAndAuditorManagementProps {
  initialTab?: string;
}

export const DeliveryAndAuditorManagement: React.FC<DeliveryAndAuditorManagementProps> = ({
  initialTab = 'delivery-boys',
}) => {
  const [activeTab, setActiveTab] = useState<'delivery-boys' | 'auditors'>(
    initialTab === 'auditors' ? 'auditors' : 'delivery-boys'
  );

  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [auditorChecks, setAuditorChecks] = useState<AuditorCheck[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [replacements, setReplacements] = useState<ReplacementRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [dboySearchQuery, setDboySearchQuery] = useState('');
  const [dboyStatusFilter, setDboyStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ALL');
  const [dboyVehicleFilter, setDboyVehicleFilter] = useState<string>('ALL');

  const [auditorSearchQuery, setAuditorSearchQuery] = useState('');
  const [auditorStatusFilter, setAuditorStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals
  const [isAddDBoyOpen, setIsAddDBoyOpen] = useState(false);
  const [editingDBoy, setEditingDBoy] = useState<DeliveryBoy | null>(null);
  const [isAddAuditorOpen, setIsAddAuditorOpen] = useState(false);
  const [editingAuditor, setEditingAuditor] = useState<Auditor | null>(null);

  // Customer Assignment Modal
  const [assigningAuditor, setAssigningAuditor] = useState<Auditor | null>(null);
  const [selectedAssignedCustomerIds, setSelectedAssignedCustomerIds] = useState<string[]>([]);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Work Log Modals
  const [viewingDBoyWork, setViewingDBoyWork] = useState<DeliveryBoy | null>(null);
  const [dboyWorkFilterTab, setDboyWorkFilterTab] = useState<'ALL' | 'PENDING' | 'DELIVERED' | 'FAILED'>('ALL');
  const [dboyWorkDateFilter, setDboyWorkDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH'>('ALL');
  const [dboyWorkSearchQuery, setDboyWorkSearchQuery] = useState('');

  const [viewingAuditorWork, setViewingAuditorWork] = useState<Auditor | null>(null);
  const [selectedAuditBill, setSelectedAuditBill] = useState<AuditorCheck | null>(null);

  // Order Details Modal inside Work Log
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalTab, setOrderModalTab] = useState<'DETAILS' | 'BILL' | 'IMAGES'>('DETAILS');
  const [imagePreviewModal, setImagePreviewModal] = useState<{ url: string; title: string } | null>(null);
  const [isGeneratingTripSheetPdf, setIsGeneratingTripSheetPdf] = useState(false);
  const [isGeneratingInvoicePdf, setIsGeneratingInvoicePdf] = useState(false);

  // Form states for New / Edit Delivery Boy
  const [dboyFormData, setDboyFormData] = useState({
    fullName: '',
    mobile: '',
    alternateContact: '',
    emergencyContact: '',
    vehicleType: 'BIKE' as 'BIKE' | 'SCOOTER' | 'VAN' | 'CYCLE',
    vehicleNumber: '',
    assignedArea: '',
    address: '',
    city: 'Ranchi',
    state: 'Jharkhand',
    pincode: '834001',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    notes: '',
  });
  const [dboyMobileStatus, setDboyMobileStatus] = useState<{
    checking: boolean;
    available?: boolean;
    error?: string;
  }>({ checking: false });

  // Form states for New / Edit Auditor
  const [auditorFormData, setAuditorFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    assignedZone: 'Central Ranchi (Zone A)',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    notes: '',
    assignedCustomerIds: [] as string[],
  });
  const [auditorMobileStatus, setAuditorMobileStatus] = useState<{
    checking: boolean;
    available?: boolean;
    error?: string;
  }>({ checking: false });

  // Validate Delivery Partner Mobile Uniqueness in Real-Time
  useEffect(() => {
    const clean = dboyFormData.mobile.replace(/\D/g, '');
    if (clean.length === 10) {
      setDboyMobileStatus({ checking: true });
      const timer = setTimeout(async () => {
        try {
          const res = await api.checkMobileAvailability(clean, editingDBoy?.id);
          if (res.available) {
            setDboyMobileStatus({ checking: false, available: true });
          } else {
            setDboyMobileStatus({ checking: false, available: false, error: res.error || 'Mobile already registered across database' });
          }
        } catch (err: any) {
          setDboyMobileStatus({ checking: false, available: false, error: err.message });
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setDboyMobileStatus({ checking: false, available: undefined });
    }
  }, [dboyFormData.mobile, editingDBoy]);

  // Validate Auditor Mobile Uniqueness in Real-Time
  useEffect(() => {
    const clean = auditorFormData.mobile.replace(/\D/g, '');
    if (clean.length === 10) {
      setAuditorMobileStatus({ checking: true });
      const timer = setTimeout(async () => {
        try {
          const res = await api.checkMobileAvailability(clean, editingAuditor?.id);
          if (res.available) {
            setAuditorMobileStatus({ checking: false, available: true });
          } else {
            setAuditorMobileStatus({ checking: false, available: false, error: res.error || 'Mobile already registered across database' });
          }
        } catch (err: any) {
          setAuditorMobileStatus({ checking: false, available: false, error: err.message });
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setAuditorMobileStatus({ checking: false, available: undefined });
    }
  }, [auditorFormData.mobile, editingAuditor]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dbs, auds, ords, custs, chks, rets, reps, prods] = await Promise.all([
        api.getDeliveryBoys(),
        api.getAuditors(),
        api.getOrders(),
        api.getCustomers(),
        api.getAuditorChecks(),
        api.getReturns(),
        api.getReplacements(),
        api.getProducts(),
      ]);
      setDeliveryBoys(dbs || []);
      setAuditors(auds || []);
      setOrders(ords || []);
      setCustomers(custs || []);
      setAuditorChecks(chks || []);
      setReturns(rets || []);
      setReplacements(reps || []);
      setProducts(prods || []);
    } catch (err) {
      console.error('Failed to load fleet & staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper date parser
  const parseFormattedDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes('T')) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }
    const parts = dateStr.split(' ');
    if (parts.length >= 1) {
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        return new Date(year, month, day);
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Helper image resolver
  const getItemImage = (item: any) => {
    if (item.imageUrl && item.imageUrl.trim()) return item.imageUrl;
    const prod = products.find((p) => p.id === item.productId || p.barcode === item.barcode);
    if (prod?.images && prod.images.length > 0 && prod.images[0]?.trim()) return prod.images[0];
    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&q=80';
  };

  // Delivery Boy Metrics Calculation
  const getDeliveryBoyMetrics = (dboyId: string) => {
    const assignedOrders = orders.filter((o) => o.assignedDeliveryBoyId === dboyId);
    const pendingOrders = assignedOrders.filter((o) =>
      ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'READY_TO_SHIP'].includes(o.orderStatus)
    );
    const inTransitOrders = assignedOrders.filter((o) => o.orderStatus === 'OUT_FOR_DELIVERY');
    const deliveredOrders = assignedOrders.filter(
      (o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED'
    );
    const failedOrders = assignedOrders.filter(
      (o) => o.orderStatus === 'DELIVERY_FAILED' || o.orderStatus === 'CANCELLED'
    );
    const codAmount = deliveredOrders
      .filter((o) => o.orderType === 'QUICK' || o.paymentMethod === 'COD')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return {
      totalAssigned: assignedOrders.length,
      pendingCount: pendingOrders.length,
      inTransitCount: inTransitOrders.length,
      deliveredCount: deliveredOrders.length,
      failedCount: failedOrders.length,
      codAmount,
    };
  };

  // Toggle Delivery Boy Status
  const handleToggleDBoyStatus = async (db: DeliveryBoy) => {
    const nextStatus = db.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`Change status of ${db.fullName} (${db.id}) to ${nextStatus}?`)) return;
    try {
      await api.updateDeliveryBoy(db.id, { status: nextStatus });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Toggle Auditor Status
  const handleToggleAuditorStatus = async (aud: Auditor) => {
    const nextStatus = aud.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`Change status of ${aud.fullName} (${aud.id}) to ${nextStatus}?`)) return;
    try {
      await api.updateAuditor(aud.id, { status: nextStatus });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Save New Delivery Boy
  const handleCreateDBoy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createDeliveryBoy(dboyFormData);
      alert(`✅ Delivery Partner ${dboyFormData.fullName} registered successfully!`);
      setIsAddDBoyOpen(false);
      setDboyFormData({
        fullName: '',
        mobile: '',
        alternateContact: '',
        emergencyContact: '',
        vehicleType: 'BIKE',
        vehicleNumber: '',
        assignedArea: '',
        address: '',
        city: 'Ranchi',
        state: 'Jharkhand',
        pincode: '834001',
        joiningDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
        notes: '',
      });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create delivery boy');
    }
  };

  // Save Edited Delivery Boy
  const handleUpdateDBoy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDBoy) return;
    try {
      await api.updateDeliveryBoy(editingDBoy.id, dboyFormData);
      alert(`✅ Updated ${dboyFormData.fullName} successfully!`);
      setEditingDBoy(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update delivery boy');
    }
  };

  // Open Edit Modal for DBoy
  const openEditDBoy = (db: DeliveryBoy) => {
    setEditingDBoy(db);
    setDboyFormData({
      fullName: db.fullName,
      mobile: db.mobile,
      alternateContact: db.alternateContact || '',
      emergencyContact: db.emergencyContact || '',
      vehicleType: db.vehicleType || 'BIKE',
      vehicleNumber: db.vehicleNumber || '',
      assignedArea: db.assignedArea || '',
      address: db.address || '',
      city: db.city || 'Ranchi',
      state: db.state || 'Jharkhand',
      pincode: db.pinCode || '834001',
      joiningDate: db.joiningDate || new Date().toISOString().split('T')[0],
      status: db.status || 'ACTIVE',
      notes: db.notes || '',
    });
  };

  // Save New Auditor
  const handleCreateAuditor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAuditor(auditorFormData);
      alert(`✅ Field Auditor ${auditorFormData.fullName} registered successfully!`);
      setIsAddAuditorOpen(false);
      setAuditorFormData({
        fullName: '',
        mobile: '',
        email: '',
        assignedZone: 'Central Ranchi (Zone A)',
        status: 'ACTIVE',
        notes: '',
        assignedCustomerIds: [],
      });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create auditor');
    }
  };

  // Save Edited Auditor
  const handleUpdateAuditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAuditor) return;
    try {
      await api.updateAuditor(editingAuditor.id, auditorFormData);
      alert(`✅ Updated ${auditorFormData.fullName} successfully!`);
      setEditingAuditor(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update auditor');
    }
  };

  // Open Edit Modal for Auditor
  const openEditAuditor = (aud: Auditor) => {
    setEditingAuditor(aud);
    setAuditorFormData({
      fullName: aud.fullName,
      mobile: aud.mobile,
      email: aud.email || '',
      assignedZone: aud.assignedZone || 'Central Ranchi (Zone A)',
      status: aud.status || 'ACTIVE',
      notes: aud.notes || '',
      assignedCustomerIds: aud.assignedCustomerIds || [],
    });
  };

  // Open Customer Assignment Modal
  const openAssignModal = (aud: Auditor) => {
    setAssigningAuditor(aud);
    setSelectedAssignedCustomerIds(aud.assignedCustomerIds || []);
    setAssignSearchQuery('');
  };

  // Save Customer Assignments
  const handleSaveCustomerAssignments = async () => {
    if (!assigningAuditor) return;
    setSavingAssignments(true);
    try {
      await api.updateAuditor(assigningAuditor.id, {
        assignedCustomerIds: selectedAssignedCustomerIds,
      });
      alert(`✅ Saved ${selectedAssignedCustomerIds.length} households for ${assigningAuditor.fullName}!`);
      setAssigningAuditor(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to save customer assignments');
    } finally {
      setSavingAssignments(false);
    }
  };

  // Overall KPIs
  const totalDboys = deliveryBoys.length;
  const activeDboys = deliveryBoys.filter((d) => d.status === 'ACTIVE').length;
  const totalAuditors = auditors.length;
  const activeAuditors = auditors.filter((a) => a.status === 'ACTIVE').length;
  const totalDeliveredOrders = orders.filter((o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED').length;
  const totalCodCollected = orders
    .filter((o) => (o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED') && (o.paymentMethod === 'COD' || o.orderType === 'QUICK'))
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Navigation Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Delivery Fleet &amp; Auditor Management</span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dedicated master center for adding, editing, auditing, and monitoring all delivery riders and field inspectors.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchData}
              className="p-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
              title="Refresh Staff Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
              <span>Sync</span>
            </button>

            {activeTab === 'delivery-boys' ? (
              <button
                onClick={() => setIsAddDBoyOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Delivery Boy</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAddAuditorOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Field Auditor</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary View Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pt-1">
          <button
            onClick={() => setActiveTab('delivery-boys')}
            className={`pb-3 px-4 font-black text-xs transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'delivery-boys'
                ? 'border-amber-500 text-amber-800 bg-amber-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Bike className="w-4 h-4 text-amber-600" />
            <span>Delivery Fleet &amp; Riders</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
              {deliveryBoys.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('auditors')}
            className={`pb-3 px-4 font-black text-xs transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'auditors'
                ? 'border-cyan-600 text-cyan-900 bg-cyan-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-cyan-600" />
            <span>Field Auditors &amp; Inspectors</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-900">
              {auditors.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Metric Overview Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Delivery Fleet</div>
          <div className="text-xl font-black text-slate-900 mt-1">{totalDboys} Riders</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">{activeDboys} Active on Duty</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Field Auditors</div>
          <div className="text-xl font-black text-slate-900 mt-1">{totalAuditors} Auditors</div>
          <div className="text-[11px] text-cyan-600 font-semibold mt-0.5">{activeAuditors} Active</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Delivered Orders</div>
          <div className="text-xl font-black text-emerald-700 mt-1">{totalDeliveredOrders}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">By Fleet Partners</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Total COD Collected</div>
          <div className="text-xl font-black text-slate-900 mt-1">₹{totalCodCollected}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">Cash in transit/reconciled</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Pantry Audits</div>
          <div className="text-xl font-black text-cyan-800 mt-1">{auditorChecks.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Total Checks Done</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Assigned Households</div>
          <div className="text-xl font-black text-purple-900 mt-1">
            {auditors.reduce((acc, a) => acc + (a.assignedCustomerIds?.length || 0), 0)}
          </div>
          <div className="text-[11px] text-purple-700 font-semibold mt-0.5">Under Inspection</div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: DELIVERY BOYS MANAGEMENT */}
      {/* ==================================================================== */}
      {activeTab === 'delivery-boys' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search rider by Name, Mobile, Vehicle plate, Area, or ID..."
                value={dboySearchQuery}
                onChange={(e) => setDboySearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <select
                value={dboyStatusFilter}
                onChange={(e) => setDboyStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
                <option value="SUSPENDED">Suspended Only</option>
              </select>

              <select
                value={dboyVehicleFilter}
                onChange={(e) => setDboyVehicleFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Vehicle Types</option>
                <option value="BIKE">Motorcycle / Bike</option>
                <option value="SCOOTER">Scooter / Scooty</option>
                <option value="VAN">Delivery Van / Auto</option>
                <option value="CYCLE">Cycle</option>
              </select>

              <button
                onClick={() => setIsAddDBoyOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Rider</span>
              </button>
            </div>
          </div>

          {/* Delivery Boy Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveryBoys
              .filter((db) => {
                if (dboyStatusFilter !== 'ALL' && db.status !== dboyStatusFilter) return false;
                if (dboyVehicleFilter !== 'ALL' && db.vehicleType !== dboyVehicleFilter) return false;
                if (!dboySearchQuery.trim()) return true;
                const q = dboySearchQuery.toLowerCase();
                return (
                  db.fullName.toLowerCase().includes(q) ||
                  db.mobile.includes(q) ||
                  db.id.toLowerCase().includes(q) ||
                  (db.assignedArea && db.assignedArea.toLowerCase().includes(q)) ||
                  (db.vehicleNumber && db.vehicleNumber.toLowerCase().includes(q))
                );
              })
              .map((db) => {
                const metrics = getDeliveryBoyMetrics(db.id);

                return (
                  <div
                    key={db.id}
                    className={`bg-white rounded-2xl border transition-all shadow-3xs flex flex-col justify-between overflow-hidden hover:shadow-md ${
                      db.status === 'INACTIVE'
                        ? 'border-rose-200 bg-rose-50/10 opacity-90'
                        : db.status === 'SUSPENDED'
                        ? 'border-red-300 bg-red-50/30'
                        : 'border-slate-200 hover:border-amber-400'
                    }`}
                  >
                    <div className="p-5 space-y-4">
                      {/* Top Header with Avatar & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-lg border border-amber-200 shadow-inner shrink-0">
                            <Bike className="w-6 h-6 text-amber-700" />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 text-sm leading-tight">{db.fullName}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                {db.id}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                                {db.vehicleType}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Switch & Actions */}
                        <div className="flex flex-col items-end gap-1.5">
                          <StatusBadge status={db.status} />
                          <button
                            onClick={() => handleToggleDBoyStatus(db)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition flex items-center gap-1 border ${
                              db.status === 'ACTIVE'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            <Power className="w-2.5 h-2.5" />
                            <span>{db.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Contact & Territory Info */}
                      <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <Phone className="w-3.5 h-3.5 text-amber-600" />
                            <span className="font-mono">+91 {db.mobile}</span>
                          </div>
                          <a
                            href={`tel:+91${db.mobile}`}
                            className="text-[10px] font-bold text-amber-700 hover:underline bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                          >
                            Call Rider
                          </a>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Area: <strong className="text-slate-900">{db.assignedArea || 'Central Hub'}</strong>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>
                            Plate: <strong className="font-mono text-slate-800">{db.vehicleNumber || 'Unregistered'}</strong>
                          </span>
                          {db.joiningDate && (
                            <span>Joined: {db.joiningDate}</span>
                          )}
                        </div>
                      </div>

                      {/* Live Counter Badges */}
                      <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="p-1 rounded-lg bg-amber-50 border border-amber-200">
                          <div className="text-[9px] font-bold uppercase text-amber-700">Pending</div>
                          <div className="font-black text-amber-900 text-sm">{metrics.pendingCount}</div>
                        </div>
                        <div className="p-1 rounded-lg bg-sky-50 border border-sky-200">
                          <div className="text-[9px] font-bold uppercase text-sky-700">In Transit</div>
                          <div className="font-black text-sky-900 text-sm">{metrics.inTransitCount}</div>
                        </div>
                        <div className="p-1 rounded-lg bg-emerald-50 border border-emerald-200">
                          <div className="text-[9px] font-bold uppercase text-emerald-700">Delivered</div>
                          <div className="font-black text-emerald-900 text-sm">{metrics.deliveredCount}</div>
                        </div>
                        <div className="p-1 rounded-lg bg-purple-50 border border-purple-200">
                          <div className="text-[9px] font-bold uppercase text-purple-700">COD (₹)</div>
                          <div className="font-black text-purple-900 text-sm">₹{metrics.codAmount}</div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setViewingDBoyWork(db);
                          setDboyWorkFilterTab('ALL');
                          setDboyWorkDateFilter('ALL');
                          setDboyWorkSearchQuery('');
                        }}
                        className="flex-1 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        <span>360° Work Log</span>
                      </button>

                      <button
                        onClick={() => openEditDBoy(db)}
                        className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-3xs"
                        title="Edit Delivery Boy Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 2: AUDITORS MANAGEMENT */}
      {/* ==================================================================== */}
      {activeTab === 'auditors' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search Auditor by Name, Mobile, Zone, or ID..."
                value={auditorSearchQuery}
                onChange={(e) => setAuditorSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={auditorStatusFilter}
                onChange={(e) => setAuditorStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:ring-2 focus:ring-cyan-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <button
                onClick={() => setIsAddAuditorOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Auditor</span>
              </button>
            </div>
          </div>

          {/* Auditors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auditors
              .filter((aud) => {
                if (auditorStatusFilter !== 'ALL' && aud.status !== auditorStatusFilter) return false;
                if (!auditorSearchQuery.trim()) return true;
                const q = auditorSearchQuery.toLowerCase();
                return (
                  aud.fullName.toLowerCase().includes(q) ||
                  aud.mobile.includes(q) ||
                  aud.id.toLowerCase().includes(q) ||
                  (aud.assignedZone && aud.assignedZone.toLowerCase().includes(q))
                );
              })
              .map((aud) => {
                const assignedCustomersList = customers.filter((c) =>
                  aud.assignedCustomerIds?.includes(c.id)
                );
                const conductedChecks = auditorChecks.filter((chk) => chk.auditorId === aud.id);

                return (
                  <div
                    key={aud.id}
                    className={`bg-white rounded-2xl border transition-all shadow-3xs flex flex-col justify-between overflow-hidden hover:shadow-md ${
                      aud.status === 'INACTIVE'
                        ? 'border-rose-200 bg-rose-50/10 opacity-90'
                        : 'border-slate-200 hover:border-cyan-400'
                    }`}
                  >
                    <div className="p-5 space-y-4">
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-black text-lg border border-cyan-200 shadow-inner shrink-0">
                            <ClipboardCheck className="w-6 h-6 text-cyan-700" />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 text-sm leading-tight">{aud.fullName}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-bold text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200">
                                {aud.id}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Switch */}
                        <div className="flex flex-col items-end gap-1.5">
                          <StatusBadge status={aud.status} />
                          <button
                            onClick={() => handleToggleAuditorStatus(aud)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition flex items-center gap-1 border ${
                              aud.status === 'ACTIVE'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            <Power className="w-2.5 h-2.5" />
                            <span>{aud.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Contact & Coverage Details */}
                      <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <Phone className="w-3.5 h-3.5 text-cyan-600" />
                            <span className="font-mono">+91 {aud.mobile}</span>
                          </div>
                          <a
                            href={`tel:+91${aud.mobile}`}
                            className="text-[10px] font-bold text-cyan-800 hover:underline bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md"
                          >
                            Call
                          </a>
                        </div>

                        {aud.email && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{aud.email}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Zone: <strong className="text-slate-900">{aud.assignedZone}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Assigned Households Scope Block */}
                      <div className="p-3 bg-cyan-50/50 rounded-xl border border-cyan-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-black text-cyan-900 uppercase tracking-wider flex items-center gap-1">
                            <Building className="w-3 h-3 text-cyan-600" />
                            <span>Assigned Households ({assignedCustomersList.length})</span>
                          </div>
                          <button
                            onClick={() => openAssignModal(aud)}
                            className="text-[10px] font-black text-cyan-700 hover:text-cyan-900 hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>Assign / Edit</span>
                          </button>
                        </div>

                        {assignedCustomersList.length === 0 ? (
                          <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            ⚠️ No households assigned. Click 'Assign' to give auditor access.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                            {assignedCustomersList.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-800 shadow-3xs"
                                title={`${c.fullName} - ${c.address}`}
                              >
                                <span className="text-cyan-700 font-mono text-[9px]">{c.id}:</span>
                                <span className="truncate max-w-[90px]">{c.fullName}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                      <div className="text-xs">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Audits Completed</div>
                        <div className="font-black text-slate-900 text-sm">
                          {conductedChecks.length} Checks
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewingAuditorWork(aud)}
                          className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-black transition shadow-3xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Work Logs &amp; Bills</span>
                        </button>

                        <button
                          onClick={() => openEditAuditor(aud)}
                          className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-3xs"
                          title="Edit Auditor Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: ADD OR EDIT DELIVERY BOY */}
      {/* ==================================================================== */}
      {(isAddDBoyOpen || editingDBoy) && (
        <AppWindowModal
          isOpen={isAddDBoyOpen || !!editingDBoy}
          onClose={() => {
            setIsAddDBoyOpen(false);
            setEditingDBoy(null);
          }}
          title={editingDBoy ? `Edit Rider: ${editingDBoy.fullName}` : 'Register New Delivery Partner'}
          subtitle="Complete delivery rider profile for order routing, mobile dispatch, and cash reconciliation."
          icon={<Bike className="w-5 h-5 text-amber-600" />}
          size="xl"
        >
          <div className="p-6">
            <form onSubmit={editingDBoy ? handleUpdateDBoy : handleCreateDBoy} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={dboyFormData.fullName}
                    onChange={(e) => setDboyFormData({ ...dboyFormData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black uppercase text-slate-600">
                      Mobile Number (Primary Login ID) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">{dboyFormData.mobile.length}/10</span>
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={dboyFormData.mobile}
                    onChange={(e) => setDboyFormData({ ...dboyFormData, mobile: e.target.value.replace(/\D/g, '') })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none font-mono font-bold ${
                      dboyMobileStatus.available === false
                        ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/40 text-rose-900'
                        : dboyMobileStatus.available === true
                        ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/40 text-emerald-900'
                        : 'border-slate-300 focus:ring-amber-500'
                    }`}
                  />
                  {dboyMobileStatus.checking && (
                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                      <span className="inline-block w-2 h-2 rounded-full border border-amber-600 border-t-transparent animate-spin"></span>
                      Checking mobile uniqueness across database...
                    </p>
                  )}
                  {dboyMobileStatus.available === true && (
                    <p className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                      Unique Mobile: Available for Delivery Partner
                    </p>
                  )}
                  {dboyMobileStatus.available === false && (
                    <p className="text-[10px] text-rose-600 font-medium mt-1 leading-tight flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                      <span>{dboyMobileStatus.error}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Alternate Contact
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Optional backup number"
                    value={dboyFormData.alternateContact}
                    onChange={(e) => setDboyFormData({ ...dboyFormData, alternateContact: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Emergency Contact Name/Relation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Spouse / Brother details"
                    value={dboyFormData.emergencyContact}
                    onChange={(e) => setDboyFormData({ ...dboyFormData, emergencyContact: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={dboyFormData.vehicleType}
                    onChange={(e) => setDboyFormData({ ...dboyFormData, vehicleType: e.target.value as any })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="BIKE">Motorcycle / Bike</option>
                    <option value="SCOOTER">Scooter / Scooty</option>
                    <option value="VAN">Delivery Van / Auto</option>
                    <option value="CYCLE">Cycle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Vehicle Plate Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JH-01-AB-1234"
                    value={dboyFormData.vehicleNumber}
                    onChange={(e) => setDboyFormData({ ...dboyFormData, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Assigned Coverage Area / Hub
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lalpur / Morabadi, Ranchi"
                    value={dboyFormData.assignedArea}
                    onChange={(e) => setDboyFormData({ ...dboyFormData, assignedArea: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    value={dboyFormData.status}
                    onChange={(e) => setDboyFormData({ ...dboyFormData, status: e.target.value as any })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white font-bold"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized to deliver)</option>
                    <option value="INACTIVE">INACTIVE (Off duty)</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Full Local Street Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter complete residential address..."
                    value={dboyFormData.address}
                    onChange={(e) => setDboyFormData({ ...dboyFormData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddDBoyOpen(false);
                    setEditingDBoy(null);
                  }}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dboyMobileStatus.checking || dboyMobileStatus.available === false || dboyFormData.mobile.length !== 10}
                  className={`px-5 py-2 font-black text-white rounded-lg shadow-sm transition flex items-center gap-1.5 ${
                    dboyMobileStatus.checking || dboyMobileStatus.available === false || dboyFormData.mobile.length !== 10
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-amber-600 hover:bg-amber-700 cursor-pointer'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {dboyMobileStatus.checking
                      ? 'Verifying Mobile...'
                      : editingDBoy
                      ? 'Save Changes'
                      : 'Register Delivery Partner'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: ADD OR EDIT AUDITOR */}
      {/* ==================================================================== */}
      {(isAddAuditorOpen || editingAuditor) && (
        <AppWindowModal
          isOpen={isAddAuditorOpen || !!editingAuditor}
          onClose={() => {
            setIsAddAuditorOpen(false);
            setEditingAuditor(null);
          }}
          title={editingAuditor ? `Edit Auditor: ${editingAuditor.fullName}` : 'Register New Field Auditor'}
          subtitle="Set up inspection personnel, assign territory coverage, and grant household audit permissions."
          icon={<ClipboardCheck className="w-5 h-5 text-cyan-700" />}
          size="xl"
        >
          <div className="p-6">
            <form onSubmit={editingAuditor ? handleUpdateAuditor : handleCreateAuditor} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Auditor Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikas Kumar Sahu"
                    value={auditorFormData.fullName}
                    onChange={(e) => setAuditorFormData({ ...auditorFormData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black uppercase text-slate-600">
                      Mobile Number (Primary Login ID) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">{auditorFormData.mobile.length}/10</span>
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={auditorFormData.mobile}
                    onChange={(e) => setAuditorFormData({ ...auditorFormData, mobile: e.target.value.replace(/\D/g, '') })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none font-mono font-bold ${
                      auditorMobileStatus.available === false
                        ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/40 text-rose-900'
                        : auditorMobileStatus.available === true
                        ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/40 text-emerald-900'
                        : 'border-slate-300 focus:ring-cyan-500'
                    }`}
                  />
                  {auditorMobileStatus.checking && (
                    <p className="text-[10px] text-cyan-700 mt-1 flex items-center gap-1 font-medium">
                      <span className="inline-block w-2 h-2 rounded-full border border-cyan-700 border-t-transparent animate-spin"></span>
                      Checking mobile uniqueness across database...
                    </p>
                  )}
                  {auditorMobileStatus.available === true && (
                    <p className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                      Unique Mobile: Available for Field Auditor
                    </p>
                  )}
                  {auditorMobileStatus.available === false && (
                    <p className="text-[10px] text-rose-600 font-medium mt-1 leading-tight flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                      <span>{auditorMobileStatus.error}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="auditor@pantrymaster.com"
                    value={auditorFormData.email}
                    onChange={(e) => setAuditorFormData({ ...auditorFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Assigned Coverage Zone
                  </label>
                  <select
                    value={auditorFormData.assignedZone}
                    onChange={(e) => setAuditorFormData({ ...auditorFormData, assignedZone: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="Central Ranchi (Zone A)">Central Ranchi (Zone A)</option>
                    <option value="Ranchi North (Kanke / Morabadi)">Ranchi North (Kanke / Morabadi)</option>
                    <option value="Ranchi South (Doranda / Hinoo)">Ranchi South (Doranda / Hinoo)</option>
                    <option value="Ranchi East (Namkum / Tatisilwai)">Ranchi East (Namkum / Tatisilwai)</option>
                    <option value="Ranchi West (Ratu / Kathal More)">Ranchi West (Ratu / Kathal More)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    value={auditorFormData.status}
                    onChange={(e) => setAuditorFormData({ ...auditorFormData, status: e.target.value as any })}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none bg-white font-bold"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized)</option>
                    <option value="INACTIVE">INACTIVE (Deactivated)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Internal HR / Area Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Auditor, FMCG verified"
                    value={auditorFormData.notes}
                    onChange={(e) => setAuditorFormData({ ...auditorFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAuditorOpen(false);
                    setEditingAuditor(null);
                  }}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={auditorMobileStatus.checking || auditorMobileStatus.available === false || auditorFormData.mobile.length !== 10}
                  className={`px-5 py-2 font-black text-white rounded-lg shadow-sm transition flex items-center gap-1.5 ${
                    auditorMobileStatus.checking || auditorMobileStatus.available === false || auditorFormData.mobile.length !== 10
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-cyan-700 hover:bg-cyan-800 cursor-pointer'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {auditorMobileStatus.checking
                      ? 'Verifying Mobile...'
                      : editingAuditor
                      ? 'Save Changes'
                      : 'Register Field Auditor'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: ASSIGN HOUSEHOLDS TO AUDITOR */}
      {/* ==================================================================== */}
      {assigningAuditor && (
        <AppWindowModal
          isOpen={!!assigningAuditor}
          onClose={() => setAssigningAuditor(null)}
          title={`Assign Households: ${assigningAuditor.fullName}`}
          subtitle={`Coverage Zone: ${assigningAuditor.assignedZone} • Auditor ID: ${assigningAuditor.id}`}
          icon={<Users className="w-5 h-5 text-cyan-700" />}
          size="xl"
          badge={
            <span className="px-2.5 py-0.5 bg-cyan-700 text-white rounded-full text-xs font-black">
              {selectedAssignedCustomerIds.length} Assigned
            </span>
          }
        >
          <div className="p-6 space-y-4 text-xs">
            <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-100 text-cyan-900 flex items-center justify-between">
                <div>
                  <span className="font-bold">Auditor Zone:</span> {assigningAuditor.assignedZone}
                </div>
                <span className="px-2.5 py-1 bg-cyan-700 text-white rounded-lg text-xs font-black">
                  {selectedAssignedCustomerIds.length} Assigned
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search household by Name, Mobile, Address, ID..."
                    value={assignSearchQuery}
                    onChange={(e) => setAssignSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedAssignedCustomerIds(customers.map((c) => c.id))}
                    className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAssignedCustomerIds([])}
                    className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto divide-y divide-slate-100 bg-white shadow-2xs">
                {customers
                  .filter((c) => {
                    if (!assignSearchQuery.trim()) return true;
                    const q = assignSearchQuery.toLowerCase();
                    return (
                      c.fullName.toLowerCase().includes(q) ||
                      c.mobile.includes(q) ||
                      c.id.toLowerCase().includes(q) ||
                      (c.address && c.address.toLowerCase().includes(q))
                    );
                  })
                  .map((c) => {
                    const isSelected = selectedAssignedCustomerIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedAssignedCustomerIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          );
                        }}
                        className={`p-3 flex items-center justify-between cursor-pointer transition ${
                          isSelected ? 'bg-cyan-50/70 font-bold text-cyan-950' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-cyan-700 shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 shrink-0" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-900 font-bold">{c.fullName}</span>
                              <span className="font-mono text-[10px] text-cyan-800 bg-white px-2 py-0.5 rounded border border-cyan-200">
                                {c.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                              {c.address}, {c.city} • Mobile: +91 {c.mobile}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-purple-600 font-bold uppercase">Pantry Limit</div>
                          <div className="font-mono font-black text-purple-900">₹{c.pantryLimit}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Auditor will only see the selected households in their field portal.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningAuditor(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingAssignments}
                  onClick={handleSaveCustomerAssignments}
                  className="px-5 py-2 text-xs font-black text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{savingAssignments ? 'Saving...' : 'Save Assignments'}</span>
                </button>
              </div>
            </div>
        </AppWindowModal>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: DELIVERY BOY 360 WORK LOG & FULL DELIVERY HISTORY */}
      {/* ==================================================================== */}
      {viewingDBoyWork && (() => {
        const rawOrders = orders.filter((o) => o.assignedDeliveryBoyId === viewingDBoyWork.id);
        const riderReturns = returns.filter((r) => r.assignedDeliveryBoyId === viewingDBoyWork.id);
        const riderReplacements = replacements.filter((rep) => rep.assignedDeliveryBoyId === viewingDBoyWork.id);

        const dateFilteredOrders = rawOrders.filter((ord) => {
          if (dboyWorkDateFilter === 'ALL') return true;
          const targetDateStr = ord.deliveredAt || ord.outForDeliveryAt || ord.assignedAt || ord.createdAt;
          const dateObj = parseFormattedDate(targetDateStr);
          if (!dateObj) return true;

          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, -1);
          const startOfLast7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          if (dboyWorkDateFilter === 'TODAY') return dateObj >= startOfToday;
          if (dboyWorkDateFilter === 'YESTERDAY') return dateObj >= startOfYesterday && dateObj <= endOfYesterday;
          if (dboyWorkDateFilter === 'WEEK') return dateObj >= startOfLast7;
          if (dboyWorkDateFilter === 'MONTH') return dateObj >= startOfMonth;
          return true;
        });

        const searchFilteredOrders = dateFilteredOrders.filter((o) => {
          if (!dboyWorkSearchQuery.trim()) return true;
          const q = dboyWorkSearchQuery.toLowerCase();
          return (
            o.id.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q) ||
            o.customerMobile.includes(q) ||
            o.deliveryAddress.toLowerCase().includes(q) ||
            o.items.some((i) => i.productName.toLowerCase().includes(q))
          );
        });

        const displayOrders = searchFilteredOrders.filter((o) => {
          if (dboyWorkFilterTab === 'ALL') return true;
          if (dboyWorkFilterTab === 'PENDING') {
            return ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'READY_TO_SHIP'].includes(o.orderStatus);
          }
          if (dboyWorkFilterTab === 'DELIVERED') {
            return o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED';
          }
          if (dboyWorkFilterTab === 'FAILED') {
            return o.orderStatus === 'DELIVERY_FAILED' || o.orderStatus === 'CANCELLED';
          }
          return true;
        });

        const pendingCount = rawOrders.filter((o) =>
          ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)
        ).length;
        const deliveredCount = rawOrders.filter((o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED').length;

        return (
          <AppWindowModal
            isOpen={!!viewingDBoyWork}
            onClose={() => setViewingDBoyWork(null)}
            title={viewingDBoyWork.fullName}
            subtitle={`Vehicle: ${viewingDBoyWork.vehicleNumber || 'JH-01-AB-1234'} (${viewingDBoyWork.vehicleType}) • Mobile: +91 ${viewingDBoyWork.mobile}`}
            icon={<Bike className="w-5 h-5 text-amber-600" />}
            size="2xl"
            badge={
              <span className="font-mono text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-300 font-bold">
                {viewingDBoyWork.id}
              </span>
            }
            headerActions={
              <div className="flex items-center gap-1.5 mr-2">
                <button
                  onClick={async () => {
                    setIsGeneratingTripSheetPdf(true);
                    try {
                      await exportElementToPdf('dboy-tripsheet-admin-view', {
                        filename: `TripSheet-${viewingDBoyWork.fullName.replace(/\s+/g, '_')}.pdf`,
                        orientation: 'portrait',
                      });
                    } catch (err) {
                      console.error('Failed to export rider trip sheet PDF:', err);
                    } finally {
                      setIsGeneratingTripSheetPdf(false);
                    }
                  }}
                  disabled={isGeneratingTripSheetPdf}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Download Trip Sheet PDF"
                >
                  {isGeneratingTripSheetPdf ? (
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
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Trip Sheet</span>
                </button>
              </div>
            }
          >
            <div className="flex flex-col h-full">
              {/* Filters toolbar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search orders by Order ID, customer, address, or item..."
                      value={dboyWorkSearchQuery}
                      onChange={(e) => setDboyWorkSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Date:</span>
                    {(['ALL', 'TODAY', 'YESTERDAY', 'WEEK', 'MONTH'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDboyWorkDateFilter(d)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                          dboyWorkDateFilter === d
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {d === 'ALL' ? 'All Time' : d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-slate-200 pt-2 flex-wrap">
                  {[
                    { id: 'ALL', label: 'All Deliveries', count: searchFilteredOrders.length },
                    { id: 'PENDING', label: '⏳ Pending with Rider', count: searchFilteredOrders.filter((o) => ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)).length },
                    { id: 'DELIVERED', label: '✅ Delivered & Closed', count: searchFilteredOrders.filter((o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED').length },
                    { id: 'FAILED', label: '❌ Failed / Cancelled', count: searchFilteredOrders.filter((o) => o.orderStatus === 'DELIVERY_FAILED' || o.orderStatus === 'CANCELLED').length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setDboyWorkFilterTab(tab.id as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        dboyWorkFilterTab === tab.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${dboyWorkFilterTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'}`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Orders feed list */}
              <div id="dboy-tripsheet-admin-view" className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 bg-slate-50/50 text-xs">
                {displayOrders.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
                    <Package className="w-8 h-8 text-slate-300 mx-auto" />
                    <h4 className="font-bold text-slate-700 text-sm">No Orders Found</h4>
                    <p className="text-slate-400 text-xs">No deliveries match the selected filters for this rider.</p>
                  </div>
                ) : (
                  displayOrders.map((ord) => {
                    const isPending = ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY'].includes(ord.orderStatus);
                    const isDelivered = ord.orderStatus === 'COMPLETED' || ord.orderStatus === 'DELIVERED';

                    return (
                      <div
                        key={ord.id}
                        className={`bg-white rounded-2xl border shadow-2xs overflow-hidden ${
                          isPending ? 'border-amber-300 ring-2 ring-amber-500/10' : isDelivered ? 'border-emerald-200' : 'border-slate-200'
                        }`}
                      >
                        {/* Header */}
                        <div className="p-3 sm:px-4 bg-slate-50 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-sm">{ord.id}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                ord.orderType === 'PANTRY' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {ord.orderType}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <StatusBadge status={ord.orderStatus} />
                            <button
                              onClick={() => {
                                setSelectedOrder(ord);
                                setOrderModalTab('DETAILS');
                              }}
                              className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-lg text-xs transition flex items-center gap-1 shadow-3xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                              <span>View Order &amp; Bill</span>
                            </button>
                          </div>
                        </div>

                        {/* Order Body Grid */}
                        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* Customer info */}
                          <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-black uppercase text-slate-400">Customer &amp; Drop</div>
                            <div className="font-black text-slate-900 text-sm flex items-center justify-between">
                              <span>{ord.customerName}</span>
                              <span className="text-[10px] font-mono text-slate-400 font-normal">{ord.customerId}</span>
                            </div>
                            <div className="flex items-center justify-between pt-0.5">
                              <div className="font-mono font-bold text-slate-700 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-amber-600" />
                                +91 {ord.customerMobile}
                              </div>
                              <a
                                href={`tel:+91${ord.customerMobile}`}
                                className="text-[10px] font-bold text-amber-700 hover:underline bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                              >
                                Call
                              </a>
                            </div>
                            <div className="text-slate-600 pt-1 flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                              <span className="text-[11px]">{ord.deliveryAddress}</span>
                            </div>
                          </div>

                          {/* Timestamps */}
                          <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-black uppercase text-slate-400">Lifecycle Timestamps</div>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                              <div className="p-1.5 rounded bg-white border border-slate-200/60">
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Placed</div>
                                <div className="font-mono font-bold text-slate-800 text-[10px] truncate">{ord.createdAt || 'N/A'}</div>
                              </div>
                              <div className="p-1.5 rounded bg-white border border-slate-200/60">
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Assigned</div>
                                <div className="font-mono font-bold text-slate-800 text-[10px] truncate">{ord.assignedAt || 'N/A'}</div>
                              </div>
                              <div className="p-1.5 rounded bg-white border border-slate-200/60">
                                <div className="text-[9px] text-sky-600 font-bold uppercase">Out For Run</div>
                                <div className="font-mono font-bold text-sky-800 text-[10px] truncate">{ord.outForDeliveryAt || 'N/A'}</div>
                              </div>
                              <div className="p-1.5 rounded bg-white border border-slate-200/60">
                                <div className="text-[9px] text-emerald-600 font-bold uppercase">Delivered</div>
                                <div className="font-mono font-bold text-emerald-800 text-[10px] truncate">{ord.deliveredAt || 'Pending'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Items and photos */}
                          <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                                <span>Bag Items ({ord.items.length})</span>
                                <span className="font-mono font-bold text-slate-700">₹{ord.totalAmount}</span>
                              </div>
                              <div className="space-y-1 mt-1.5 max-h-24 overflow-y-auto pr-1">
                                {ord.items.map((it, idx) => {
                                  const itImg = getItemImage(it);
                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-[11px] bg-white p-1 rounded-lg border border-slate-200/70"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <img
                                          src={itImg}
                                          alt={it.productName}
                                          className="w-6 h-6 object-cover rounded bg-slate-100 border border-slate-200 shrink-0 cursor-pointer"
                                          onClick={() => setImagePreviewModal({ url: itImg, title: it.productName })}
                                        />
                                        <span className="truncate font-medium text-slate-900">{it.productName}</span>
                                      </div>
                                      <span className="font-bold text-slate-900 ml-1 font-mono">x{it.quantity}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500">
                                {ord.paymentMethod === 'COD' ? '💵 COD' : ord.orderType === 'PANTRY' ? '💳 Pantry' : '💳 Prepaid'}
                              </span>
                              <span className="font-mono font-black text-slate-900 text-sm">₹{ord.totalAmount}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </AppWindowModal>
        );
      })()}

      {/* ==================================================================== */}
      {/* MODAL 5: AUDITOR FULL WORK LOG & INSPECTION CHECKS */}
      {/* ==================================================================== */}
      {viewingAuditorWork && (
        <AppWindowModal
          isOpen={!!viewingAuditorWork}
          onClose={() => setViewingAuditorWork(null)}
          title={`Audit History: ${viewingAuditorWork.fullName}`}
          subtitle={`Coverage: ${viewingAuditorWork.assignedZone} • Mobile: +91 ${viewingAuditorWork.mobile}`}
          icon={<Activity className="w-5 h-5 text-cyan-600" />}
          size="2xl"
          badge={
            <span className="font-mono text-xs bg-cyan-100 text-cyan-800 px-2.5 py-0.5 rounded-full border border-cyan-300 font-bold">
              {viewingAuditorWork.id}
            </span>
          }
        >
          <div className="p-6 space-y-4 text-xs">
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Audit ID</th>
                      <th className="py-2.5 px-3">Household Customer</th>
                      <th className="py-2.5 px-3">Date &amp; Time</th>
                      <th className="py-2.5 px-3 text-center">Items Checked</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Bill Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {auditorChecks.filter((c) => c.auditorId === viewingAuditorWork.id).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No audit inspections recorded yet for this auditor.
                        </td>
                      </tr>
                    ) : (
                      auditorChecks
                        .filter((c) => c.auditorId === viewingAuditorWork.id)
                        .map((chk) => (
                          <tr key={chk.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-black text-cyan-900">{chk.id}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{chk.customerName}</div>
                              <div className="font-mono text-[10px] text-slate-400">{chk.customerId}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 text-[11px] flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                                <span>{chk.visitDate || chk.requestedDate || 'N/A'}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-mono mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{chk.visitTime || (chk.startedAt ? chk.startedAt.split(' ')[1] : chk.requestedTime) || '11:00 AM'}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                              {chk.itemsChecked?.length || 0}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge status={chk.status as any} />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => setSelectedAuditBill(chk)}
                                className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-lg text-xs font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Bill</span>
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewingAuditorWork(null)}
                className="px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Close Work Log
              </button>
            </div>
        </AppWindowModal>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: ITEMIZED AUDIT BILL MODAL */}
      {/* ==================================================================== */}
      {selectedAuditBill && (
        <AuditBillModal
          audit={selectedAuditBill}
          onClose={() => setSelectedAuditBill(null)}
          isAdminView={true}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: ORDER DETAILS & TAX INVOICE PREVIEW MODAL */}
      {/* ==================================================================== */}
      {selectedOrder && (
        <AppWindowModal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order: ${selectedOrder.id}`}
          subtitle={`Customer: ${selectedOrder.customerName} (+91 ${selectedOrder.customerMobile})`}
          icon={<FileText className="w-5 h-5 text-indigo-600" />}
          size="2xl"
          badge={<StatusBadge status={selectedOrder.orderStatus} />}
          headerActions={
            <div className="flex items-center gap-1.5 mr-2">
              <button
                onClick={async () => {
                  setIsGeneratingInvoicePdf(true);
                  try {
                    await exportElementToPdf('delivery-order-bill-content', {
                      filename: `TaxInvoice-${selectedOrder.id}.pdf`,
                      orientation: 'portrait',
                    });
                  } catch (err) {
                    console.error('Failed to export order invoice PDF:', err);
                  } finally {
                    setIsGeneratingInvoicePdf(false);
                  }
                }}
                disabled={isGeneratingInvoicePdf}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-lg text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Download Tax Invoice as PDF"
              >
                {isGeneratingInvoicePdf ? (
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
                onClick={() => window.print()}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
            </div>
          }
        >
          <div className="flex flex-col h-full">
            {/* Tab switch */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold">
              <button
                onClick={() => setOrderModalTab('DETAILS')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  orderModalTab === 'DETAILS' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                Order Details ({selectedOrder.items.length} items)
              </button>
              <button
                onClick={() => setOrderModalTab('BILL')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  orderModalTab === 'BILL' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                Detailed Bill with Photos
              </button>
            </div>

            {/* Modal Body */}
            <div id="delivery-order-bill-content" className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Item Photo</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3 text-center">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedOrder.items.map((it, idx) => {
                      const itImg = getItemImage(it);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <img
                              src={itImg}
                              alt={it.productName}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer"
                              onClick={() => setImagePreviewModal({ url: itImg, title: it.productName })}
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{it.productName}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{it.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">₹{it.price}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950">₹{it.price * it.quantity}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-right uppercase text-[10px] text-slate-500 font-black">
                        Total Order Amount:
                      </td>
                      <td className="py-3 px-3 text-right font-black font-mono text-sm text-slate-950">
                        ₹{selectedOrder.totalAmount}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Delivery Drop Address</div>
                <div className="text-slate-800 font-medium">{selectedOrder.deliveryAddress}</div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </AppWindowModal>
      )}

      {/* Lightbox zoom modal */}
      {imagePreviewModal && (
        <AppWindowModal
          isOpen={!!imagePreviewModal}
          onClose={() => setImagePreviewModal(null)}
          title={imagePreviewModal.title}
          icon={<ImageIcon className="w-5 h-5 text-slate-500" />}
          size="lg"
        >
          <div className="p-4 bg-slate-950 flex flex-col items-center justify-center min-h-[300px]">
            <img
              src={imagePreviewModal.url}
              alt={imagePreviewModal.title}
              className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-xl"
            />
          </div>
        </AppWindowModal>
      )}
    </div>
  );
};
