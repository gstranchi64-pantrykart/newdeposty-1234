import React, { useState, useEffect } from 'react';
import { Order, DeliveryBoy, Auditor, ReturnRequest, ReplacementRequest, ProductBatch, DeliveryAssignmentHistory, Customer, AuditorCheck } from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { AuditBillModal } from '../common/AuditBillModal';
import { AppWindowModal } from '../common/AppWindowModal';
import { OrderStepLockStepper } from './OrderStepLockStepper';
import { OrderProductAssignmentModal } from './OrderProductAssignmentModal';
import { CustomerBillModal } from './CustomerBillModal';
import { WarehousePackingSlipModal } from './WarehousePackingSlipModal';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingBag,
  CreditCard,
  Truck,
  ClipboardCheck,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  CheckCircle,
  RotateCcw,
  PlusCircle,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Shield,
  FileText,
  AlertTriangle,
  ChevronRight,
  User,
  Map,
  Coins,
  XCircle,
  Eye,
  Power,
  Users,
  CheckSquare,
  Square,
  Activity,
  CheckCircle2,
  Building,
  X,
  Lock,
  Mail,
  Zap,
  Package,
  Bike,
  Printer,
  ExternalLink,
  ArrowUpRight,
  Navigation,
  CalendarDays,
  Image as ImageIcon,
  ZoomIn,
  Receipt,
  Download,
  Check,
  Loader2,
  IndianRupee,
  Hash,
  Send,
  Layers,
  LayoutGrid,
  List,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Store,
} from 'lucide-react';
import { exportElementToPdf } from '../../utils/pdfGenerator';
import { parseOrderDate, formatOrderDateTime, getOrderPreciseTimestamp } from '../../utils/dateTimeUtils';

interface OrdersAndDeliveryAdminProps {
  initialTab?: string;
  initialFilter?: string;
}

export const OrdersAndDeliveryAdmin: React.FC<OrdersAndDeliveryAdminProps> = ({
  initialTab = 'orders',
  initialFilter,
}) => {
  const { user } = useAuth();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  const [activeSection, setActiveSection] = useState<'orders' | 'delivery-boys' | 'auditors' | 'returns' | 'replacements'>(
    initialTab === 'deliveries'
      ? 'delivery-boys'
      : initialTab === 'returns'
      ? 'returns'
      : initialTab === 'replacements'
      ? 'replacements'
      : 'orders'
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [replacements, setReplacements] = useState<ReplacementRequest[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [orderTypeFilter, setOrderTypeFilter] = useState<'ALL' | 'PANTRY' | 'QUICK'>('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Order for Details Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Admin Order Product Assignment & Billing Modals
  const [assigningProductOrder, setAssigningProductOrder] = useState<Order | null>(null);
  const [printingCustomerBillOrder, setPrintingCustomerBillOrder] = useState<Order | null>(null);
  const [printingWarehouseSlipOrder, setPrintingWarehouseSlipOrder] = useState<Order | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<'ALL' | 'PENDING' | 'LOCKED'>('ALL');
  const [orderViewMode, setOrderViewMode] = useState<'grid' | 'dense'>('grid');
  const [timeSortOrder, setTimeSortOrder] = useState<'NEWEST_FIRST' | 'OLDEST_FIRST'>('NEWEST_FIRST');
  const [isGeneratingInvoicePdf, setIsGeneratingInvoicePdf] = useState(false);
  const [isGeneratingTripSheetPdf, setIsGeneratingTripSheetPdf] = useState(false);

  // Reassignment Modal state
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [targetDeliveryBoyId, setTargetDeliveryBoyId] = useState('');

  // Assign Delivery Boy Modal
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedDeliveryBoyId, setSelectedDeliveryBoyId] = useState('');

  // Return Assign Modal state
  const [assigningReturn, setAssigningReturn] = useState<ReturnRequest | null>(null);
  const [selectedReturnDBoyId, setSelectedReturnDBoyId] = useState('');

  // Replacement Assign Modal state
  const [assigningReplacement, setAssigningReplacement] = useState<ReplacementRequest | null>(null);
  const [selectedReplacementDBoyId, setSelectedReplacementDBoyId] = useState('');

  // New Delivery Boy Modal with all 15+ fields
  const [isNewDeliveryBoyOpen, setIsNewDeliveryBoyOpen] = useState(false);
  const [newDBoyData, setNewDBoyData] = useState({
    fullName: '',
    mobile: '',
    alternateContact: '',
    address: '',
    city: 'Ranchi',
    state: 'Jharkhand',
    pinCode: '834001',
    emergencyContact: '',
    assignedArea: 'Central Ranchi',
    vehicleType: 'BIKE' as DeliveryBoy['vehicleType'],
    vehicleNumber: 'JH-01-AB-1234',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE' as DeliveryBoy['status'],
    notes: '',
    profilePhoto: '',
  });

  // New Auditor Modal & Form State
  const [isNewAuditorOpen, setIsNewAuditorOpen] = useState(false);
  const [newAuditorData, setNewAuditorData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    assignedZone: 'Central Ranchi (Zone A)',
    assignedCustomerIds: [] as string[],
    notes: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [newAuditorCustomerSearch, setNewAuditorCustomerSearch] = useState('');

  // Mobile Uniqueness Validation States
  const [newDBoyMobileStatus, setNewDBoyMobileStatus] = useState<{
    checking: boolean;
    available?: boolean;
    error?: string;
  }>({ checking: false });

  const [newAuditorMobileStatus, setNewAuditorMobileStatus] = useState<{
    checking: boolean;
    available?: boolean;
    error?: string;
  }>({ checking: false });

  // Validate Delivery Partner Mobile
  useEffect(() => {
    const clean = newDBoyData.mobile.replace(/\D/g, '');
    if (clean.length === 10) {
      setNewDBoyMobileStatus({ checking: true });
      const timer = setTimeout(async () => {
        try {
          const res = await api.checkMobileAvailability(clean);
          if (res.available) {
            setNewDBoyMobileStatus({ checking: false, available: true });
          } else {
            setNewDBoyMobileStatus({ checking: false, available: false, error: res.error || 'Mobile already registered across database' });
          }
        } catch (err: any) {
          setNewDBoyMobileStatus({ checking: false, available: false, error: err.message });
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setNewDBoyMobileStatus({ checking: false, available: undefined });
    }
  }, [newDBoyData.mobile]);

  // Validate Auditor Mobile
  useEffect(() => {
    const clean = newAuditorData.mobile.replace(/\D/g, '');
    if (clean.length === 10) {
      setNewAuditorMobileStatus({ checking: true });
      const timer = setTimeout(async () => {
        try {
          const res = await api.checkMobileAvailability(clean);
          if (res.available) {
            setNewAuditorMobileStatus({ checking: false, available: true });
          } else {
            setNewAuditorMobileStatus({ checking: false, available: false, error: res.error || 'Mobile already registered across database' });
          }
        } catch (err: any) {
          setNewAuditorMobileStatus({ checking: false, available: false, error: err.message });
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setNewAuditorMobileStatus({ checking: false, available: undefined });
    }
  }, [newAuditorData.mobile]);

  // Auditor Assignment Modal States
  const [assigningAuditor, setAssigningAuditor] = useState<Auditor | null>(null);
  const [selectedAssignedCustomerIds, setSelectedAssignedCustomerIds] = useState<string[]>([]);
  const [assignCustomerSearchQuery, setAssignCustomerSearchQuery] = useState('');
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Auditor Work / Activity History Drawer States
  const [viewingAuditorWork, setViewingAuditorWork] = useState<Auditor | null>(null);
  const [selectedAuditBill, setSelectedAuditBill] = useState<AuditorCheck | null>(null);

  // Auditor Filter States
  const [auditorSearchQuery, setAuditorSearchQuery] = useState('');
  const [auditorStatusFilter, setAuditorStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Delivery Boy Fleet Filter & Work History States
  const [deliveryBoySearchQuery, setDeliveryBoySearchQuery] = useState('');
  const [deliveryBoyStatusFilter, setDeliveryBoyStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ALL');
  const [viewingDeliveryBoyWork, setViewingDeliveryBoyWork] = useState<DeliveryBoy | null>(null);
  const [dboyWorkTab, setDboyWorkTab] = useState<'ALL' | 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETURNS'>('ALL');
  const [dboyDateFilter, setDboyDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [dboyCustomDate, setDboyCustomDate] = useState<string>('');
  const [dboySearchQuery, setDboySearchQuery] = useState<string>('');

  // Customers & Auditor Checks Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [auditorChecks, setAuditorChecks] = useState<AuditorCheck[]>([]);

  // NEW OMS Category Sidebar Filter
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // NEW Date Range Filters
  const [dateFilterRange, setDateFilterRange] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'LAST_30' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // NEW Delivery Boy Filter for the feed
  const [feedDeliveryBoyFilter, setFeedDeliveryBoyFilter] = useState<string>('ALL');

  // Products state for images lookup
  const [products, setProducts] = useState<any[]>([]);

  // Audit Logs state for Activity logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Admin Override Modal states
  const [overrideOrderId, setOverrideOrderId] = useState<string>('');
  const [overrideStatus, setOverrideStatus] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  // Order Details Modal Tab & Lightbox Image Preview
  const [orderModalView, setOrderModalView] = useState<'DETAILS' | 'BILL' | 'IMAGES'>('DETAILS');
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordList, dbList, audList, retList, repList, bList, prodList, logList, custList, chkList] = await Promise.all([
        api.getOrders(),
        api.getDeliveryBoys(),
        api.getAuditors(),
        api.getReturns(),
        api.getReplacements(),
        api.getBatches(),
        api.getProducts(),
        api.getAuditLogs ? api.getAuditLogs() : Promise.resolve([]),
        api.getCustomers(),
        api.getAuditorChecks(),
      ]);
      setOrders(ordList);
      setDeliveryBoys(dbList);
      setAuditors(audList);
      setReturns(retList);
      setReplacements(repList);
      setBatches(bList);
      setProducts(prodList || []);
      setAuditLogs(logList || []);
      setCustomers(custList || []);
      setAuditorChecks(chkList || []);

      // Apply initial filters if any
      if (initialFilter) {
        if (initialFilter === 'pantry') setOrderTypeFilter('PANTRY');
        if (initialFilter === 'quick') setOrderTypeFilter('QUICK');
        if (initialFilter === 'pending') setOrderStatusFilter('PENDING');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [initialFilter]);

  // Specific Order Lookup when selected order updates
  const refreshSelectedOrder = async (orderId: string) => {
    try {
      const ords = await api.getOrders();
      setOrders(ords);
      const found = ords.find((o) => o.id === orderId);
      if (found) {
        setSelectedOrder(found);
      }
    } catch (err) {
      console.error('Failed to refresh selected order details:', err);
    }
  };

  const handleShipOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to ship this order? This will transition status to SHIPPED and record shipping events.')) {
      return;
    }
    try {
      await api.shipOrder(orderId);
      alert('Order shipped successfully!');
      refreshSelectedOrder(orderId);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAdminOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideOrderId || !overrideStatus || !overrideReason.trim()) {
      alert('Order ID, Status, and Override Reason are required.');
      return;
    }
    try {
      await api.overrideOrderStatus(overrideOrderId, overrideStatus as any, overrideReason);
      alert('Order status overridden successfully!');
      setIsOverrideModalOpen(false);
      setOverrideReason('');
      setOverrideStatus('');
      if (selectedOrder && selectedOrder.id === overrideOrderId) {
        refreshSelectedOrder(overrideOrderId);
      }
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAssignDelivery = async () => {
    if (!assigningOrder || !selectedDeliveryBoyId) return;
    try {
      await api.assignDelivery(assigningOrder.id, selectedDeliveryBoyId);
      alert('Delivery Boy assigned successfully!');
      setAssigningOrder(null);
      setSelectedDeliveryBoyId('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReassignDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !targetDeliveryBoyId) {
      alert('Delivery Boy is required.');
      return;
    }
    const isReassign = !!selectedOrder.assignedDeliveryBoyId;
    if (isReassign && !reassignReason.trim()) {
      alert('Reassignment Reason is required for changing the assigned Delivery Boy.');
      return;
    }
    try {
      await api.assignDelivery(selectedOrder.id, targetDeliveryBoyId, isReassign ? reassignReason : 'Initial Assignment');
      alert(isReassign ? 'Delivery Boy reassigned successfully!' : 'Delivery Boy assigned successfully!');
      setIsReassigning(false);
      setReassignReason('');
      setTargetDeliveryBoyId('');
      refreshSelectedOrder(selectedOrder.id);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAssignReturnDBoy = async () => {
    if (!assigningReturn || !selectedReturnDBoyId) return;
    try {
      await api.assignReturnDelivery(assigningReturn.id, selectedReturnDBoyId);
      alert('Delivery Boy assigned for Return Pickup successfully!');
      setAssigningReturn(null);
      setSelectedReturnDBoyId('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAssignReplacementDBoy = async () => {
    if (!assigningReplacement || !selectedReplacementDBoyId) return;
    try {
      await api.assignReplacementDelivery(assigningReplacement.id, selectedReplacementDBoyId);
      alert('Delivery Boy assigned for Replacement Delivery successfully!');
      setAssigningReplacement(null);
      setSelectedReplacementDBoyId('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateDeliveryBoy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDBoyData.fullName.trim() || !newDBoyData.mobile.trim()) {
      alert('Name and Mobile number are required.');
      return;
    }
    try {
      await api.createDeliveryBoy(newDBoyData);
      alert('Delivery Boy registered successfully!');
      setIsNewDeliveryBoyOpen(false);
      setNewDBoyData({
        fullName: '',
        mobile: '',
        alternateContact: '',
        address: '',
        city: 'Ranchi',
        state: 'Jharkhand',
        pinCode: '834001',
        emergencyContact: '',
        assignedArea: 'Central Ranchi',
        vehicleType: 'BIKE',
        vehicleNumber: 'JH-01-AB-1234',
        joiningDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
        notes: '',
        profilePhoto: '',
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveReturn = async (returnId: string) => {
    if (!window.confirm('Approve return? This will restore stock to the original batch and credit the customer available pantry limit.')) {
      return;
    }
    try {
      await api.approveReturn(returnId);
      alert('Return approved! Stock & Customer Pantry Limit restored.');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectReturn = async (returnId: string) => {
    const reason = window.prompt('Enter reason for rejecting return request:', 'Item condition does not qualify for return / audit discrepancy rejected');
    if (reason === null) return;
    try {
      await api.rejectReturn(returnId, reason);
      alert('Return request rejected.');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveReplacement = async (rep: ReplacementRequest) => {
    const availableBatch = batches.find((b) => b.productId === rep.productId && b.availableQuantity >= rep.quantity);
    if (!availableBatch) {
      alert('No batch with sufficient stock available for this replacement!');
      return;
    }

    const dBoy = deliveryBoys.find((d) => d.status === 'ACTIVE');

    if (!window.confirm(`Approve replacement using Batch #${availableBatch.batchNumber}? Stock will be reserved and delivery boy assigned.`)) {
      return;
    }

    try {
      await api.approveReplacement(rep.id, availableBatch.id, dBoy?.id);
      alert('Replacement approved and dispatched for delivery!');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectReplacement = async (repId: string) => {
    const reason = window.prompt('Enter reason for rejecting replacement request:', 'Item condition does not qualify for replacement');
    if (reason === null) return;
    try {
      await api.rejectReplacement(repId, reason);
      alert('Replacement request rejected.');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // AUDITOR MANAGEMENT HANDLERS
  const handleCreateAuditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuditorData.fullName.trim() || !newAuditorData.mobile.trim()) {
      alert('Please enter Auditor Full Name and Mobile Number.');
      return;
    }
    try {
      const created = await api.createAuditor({
        fullName: newAuditorData.fullName.trim(),
        mobile: newAuditorData.mobile.trim(),
        email: newAuditorData.email.trim() || `${newAuditorData.mobile.trim()}@ranchipantry.com`,
        assignedZone: newAuditorData.assignedZone,
        assignedCustomerIds: newAuditorData.assignedCustomerIds,
        notes: newAuditorData.notes,
        status: newAuditorData.status,
      });
      alert(`✅ Field Auditor ${created.fullName} (${created.id}) created successfully with ${created.assignedCustomerIds?.length || 0} assigned customer(s)!`);
      setIsNewAuditorOpen(false);
      setNewAuditorData({
        fullName: '',
        mobile: '',
        email: '',
        assignedZone: 'Central Ranchi (Zone A)',
        assignedCustomerIds: [],
        notes: '',
        status: 'ACTIVE',
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create auditor');
    }
  };

  const handleToggleAuditorStatus = async (aud: Auditor) => {
    const nextStatus = aud.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const msg =
      nextStatus === 'INACTIVE'
        ? `Are you sure you want to DEACTIVATE Field Auditor ${aud.fullName} (${aud.id})? They will not be able to conduct or submit audits until reactivated.`
        : `Activate Field Auditor ${aud.fullName} (${aud.id})?`;
    if (!window.confirm(msg)) return;

    try {
      await api.updateAuditor(aud.id, { status: nextStatus });
      alert(`✅ Auditor ${aud.fullName} is now ${nextStatus}.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update auditor status');
    }
  };

  const handleOpenAssignModal = (aud: Auditor) => {
    setAssigningAuditor(aud);
    setSelectedAssignedCustomerIds(aud.assignedCustomerIds || []);
    setAssignCustomerSearchQuery('');
  };

  const handleSaveCustomerAssignments = async () => {
    if (!assigningAuditor) return;
    setSavingAssignments(true);
    try {
      await api.updateAuditor(assigningAuditor.id, {
        assignedCustomerIds: selectedAssignedCustomerIds,
      });
      alert(`✅ Successfully updated assigned customers for ${assigningAuditor.fullName}! (${selectedAssignedCustomerIds.length} households assigned)`);
      setAssigningAuditor(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to save assignments');
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleToggleCustomerSelection = (customerId: string) => {
    setSelectedAssignedCustomerIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    );
  };

  const handleToggleNewAuditorCustomerSelection = (customerId: string) => {
    setNewAuditorData((prev) => {
      const current = prev.assignedCustomerIds || [];
      const updated = current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId];
      return { ...prev, assignedCustomerIds: updated };
    });
  };

  // Clickable summary card filter triggers
  const handleSummaryCardClick = (status: string) => {
    setActiveSection('orders');
    setOrderStatusFilter(status);
  };

  // Calculate Live Counts for 11 Summary Cards
  const countTotalOrders = orders.length;
  const countPending = orders.filter(o => o.orderStatus === 'PENDING' || o.orderStatus === 'CONFIRMED' || o.orderStatus === 'READY_TO_SHIP').length;
  const countShipped = orders.filter(o => o.orderStatus === 'SHIPPED').length;
  const countAssigned = orders.filter(o => o.orderStatus === 'ASSIGNED').length;
  const countAccepted = orders.filter(o => o.orderStatus === 'ACCEPTED').length;
  const countOutForDelivery = orders.filter(o => o.orderStatus === 'OUT_FOR_DELIVERY').length;
  const countCompleted = orders.filter(o => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED').length;
  const countFailed = orders.filter(o => o.orderStatus === 'DELIVERY_FAILED').length;
  const countReturnQueue = returns.filter(r => r.status === 'PENDING' || r.status === 'ASSIGNED' || r.status === 'ACCEPTED' || r.status === 'OUT_FOR_PICKUP').length;
  const countReplacementQueue = replacements.filter(r => r.status === 'PENDING' || r.status === 'ASSIGNED' || r.status === 'ACCEPTED' || r.status === 'OUT_FOR_DELIVERY').length;

  // COD status values
  const codPendingTotal = orders.filter(o => o.orderType === 'QUICK' && o.orderStatus !== 'COMPLETED').reduce((sum, o) => sum + o.totalAmount, 0);
  const codCollectedTotal = orders.filter(o => o.orderType === 'QUICK' && o.orderStatus === 'COMPLETED').reduce((sum, o) => sum + o.totalAmount, 0);

  // Helper: Toggle Delivery Boy Active/Inactive Status
  const handleToggleDeliveryBoyStatus = async (db: DeliveryBoy) => {
    const nextStatus = db.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const msg =
      nextStatus === 'INACTIVE'
        ? `Are you sure you want to DEACTIVATE Delivery Partner ${db.fullName} (${db.id})? They will not receive new order dispatches.`
        : `Activate Delivery Partner ${db.fullName} (${db.id})?`;
    if (!window.confirm(msg)) return;

    try {
      await api.updateDeliveryBoy(db.id, { status: nextStatus });
      alert(`✅ Delivery Partner ${db.fullName} is now ${nextStatus}.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update delivery partner status');
    }
  };

  // Helper: Get Delivery Boy Tasks Details (Active, Out for Delivery, Completed Today, Total, COD in Hand)
  const getDeliveryBoyStats = (dboyId: string) => {
    const allAssigned = orders.filter(
      (o) => o.assignedDeliveryBoyId === dboyId || o.assignmentHistory?.some((h) => h.newDeliveryBoyId === dboyId)
    );
    const activeTasks = orders.filter(
      (o) => o.assignedDeliveryBoyId === dboyId && ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)
    );
    const outForDelivery = orders.filter(
      (o) => o.assignedDeliveryBoyId === dboyId && o.orderStatus === 'OUT_FOR_DELIVERY'
    );
    const completedOrders = orders.filter(
      (o) => o.assignedDeliveryBoyId === dboyId && (o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED')
    );
    const failedOrders = orders.filter(
      (o) => o.assignedDeliveryBoyId === dboyId && (o.orderStatus === 'DELIVERY_FAILED' || o.orderStatus === 'CANCELLED')
    );
    
    // Check completed today
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const completedToday = completedOrders.filter((o) => {
      const d = parseFormattedDate(o.deliveredAt || o.updatedAt);
      return d ? d >= startOfToday : false;
    });

    // Cash in Hand from COD orders delivered
    const codCollected = completedOrders
      .filter((o) => o.orderType === 'QUICK' && (o.paymentMethod === 'COD' || o.codAmount > 0))
      .reduce((sum, o) => sum + (o.totalAmount || o.codAmount || 0), 0);

    return {
      totalAssignedCount: allAssigned.length,
      activeCount: activeTasks.length,
      outCount: outForDelivery.length,
      completedCount: completedOrders.length,
      completedTodayCount: completedToday.length,
      failedCount: failedOrders.length,
      codCollected,
      activeOrderIds: activeTasks.map((o) => o.id).join(', '),
    };
  };

  // Helper to parse date string using universal order parser
  const parseFormattedDate = (dateStr?: string): Date | null => {
    return parseOrderDate(dateStr);
  };

  // Helper to reliably get product image for any order item with smart database lookup & fallbacks
  const getItemImage = (item: any): string => {
    if (item.image && typeof item.image === 'string' && item.image.trim() !== '' && !item.image.includes('placeholder')) {
      return item.image;
    }
    const prod = products.find(
      (p) =>
        p.id === item.productId ||
        (item.barcode && p.barcode === item.barcode) ||
        (item.productName && p.name?.toLowerCase() === item.productName?.toLowerCase())
    );
    if (prod?.images && Array.isArray(prod.images) && prod.images.length > 0 && prod.images[0]) {
      return prod.images[0];
    }
    if (prod?.image && typeof prod.image === 'string') {
      return prod.image;
    }
    // Contextual fallback by grocery category
    const name = (item.productName || '').toLowerCase();
    if (name.includes('oil') || name.includes('mustard') || name.includes('refined') || name.includes('tel')) {
      return 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80';
    }
    if (name.includes('rice') || name.includes('basmati') || name.includes('chawal')) {
      return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80';
    }
    if (name.includes('atta') || name.includes('flour') || name.includes('wheat') || name.includes('maida') || name.includes('aashirvaad')) {
      return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80';
    }
    if (name.includes('dal') || name.includes('pulse') || name.includes('chana') || name.includes('moong') || name.includes('arhar') || name.includes('urad')) {
      return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80';
    }
    if (name.includes('sugar') || name.includes('salt') || name.includes('spice') || name.includes('masala') || name.includes('haldi') || name.includes('mirch')) {
      return 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=300&q=80';
    }
    if (name.includes('tea') || name.includes('chai') || name.includes('coffee') || name.includes('tata tea')) {
      return 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=300&q=80';
    }
    if (name.includes('biscuit') || name.includes('snack') || name.includes('cookie') || name.includes('namkeen') || name.includes('parle') || name.includes('good day')) {
      return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=300&q=80';
    }
    if (name.includes('soap') || name.includes('shampoo') || name.includes('detergent') || name.includes('surf') || name.includes('dettol') || name.includes('vim')) {
      return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80';
    }
    if (name.includes('milk') || name.includes('ghee') || name.includes('butter') || name.includes('paneer') || name.includes('amul') || name.includes('curd')) {
      return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80';
    }
    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80';
  };

  // Helper to compile all multi-angle and item gallery photos for an order
  const getOrderMediaAssets = (order: Order): { url: string; title: string; subtitle: string; batch?: string }[] => {
    const media: { url: string; title: string; subtitle: string; batch?: string }[] = [];
    order.items.forEach((it) => {
      const mainImg = getItemImage(it);
      media.push({
        url: mainImg,
        title: it.productName,
        subtitle: `${it.brand ? `${it.brand} • ` : ''}${it.barcode ? `Barcode: ${it.barcode} • ` : ''}MRP: ₹${it.mrp || it.price} • Qty: ${it.quantity}`,
        batch: it.batchNumber,
      });

      const prod = products.find((p) => p.id === it.productId || (it.barcode && p.barcode === it.barcode));
      if (prod?.images && Array.isArray(prod.images)) {
        prod.images.forEach((img: string, idx: number) => {
          if (img && img !== mainImg) {
            const labels = ['Front Package', 'Nutrition & Specs', 'Side / Net Wt', 'Barcode & Seal'];
            media.push({
              url: img,
              title: `${it.productName} (${labels[idx] || `Angle ${idx + 1}`})`,
              subtitle: `${it.brand ? `${it.brand} • ` : ''}Catalog Asset #${idx + 1}`,
              batch: it.batchNumber,
            });
          }
        });
      }
    });

    if (media.length === 0) {
      media.push({
        url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
        title: 'Cargo Batch Verification',
        subtitle: 'Warehouse Logistics Dispatch',
      });
    }
    return media;
  };

  // Helper to filter items by Date Filter Selection
  const filterByDate = (createdAt?: string): boolean => {
    if (dateFilterRange === 'ALL') return true;
    const parsed = parseFormattedDate(createdAt);
    if (!parsed) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkDate = new Date(parsed);
    checkDate.setHours(0, 0, 0, 0);

    if (dateFilterRange === 'TODAY') {
      return checkDate.getTime() === today.getTime();
    }

    if (dateFilterRange === 'YESTERDAY') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return checkDate.getTime() === yesterday.getTime();
    }

    if (dateFilterRange === 'LAST_7') {
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return parsed.getTime() >= last7.getTime();
    }

    if (dateFilterRange === 'LAST_30') {
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 30);
      return parsed.getTime() >= last30.getTime();
    }

    if (dateFilterRange === 'CUSTOM') {
      let start = new Date(today);
      let end = new Date(today);
      end.setHours(23, 59, 59, 999);

      if (customStartDate) {
        const pStart = new Date(customStartDate);
        if (!isNaN(pStart.getTime())) {
          start = pStart;
          start.setHours(0, 0, 0, 0);
        }
      }
      if (customEndDate) {
        const pEnd = new Date(customEndDate);
        if (!isNaN(pEnd.getTime())) {
          end = pEnd;
          end.setHours(23, 59, 59, 999);
        }
      }
      return parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime();
    }

    return true;
  };

  const filteredAndSortedOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      o.id.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerMobile.includes(q) ||
      o.customerId.toLowerCase().includes(q);

    const matchesType = orderTypeFilter === 'ALL' || o.orderType === orderTypeFilter;
    const matchesDeliveryBoy = feedDeliveryBoyFilter === 'ALL' || o.assignedDeliveryBoyId === feedDeliveryBoyFilter;
    const matchesDate = filterByDate(getOrderPreciseTimestamp(o));
    const matchesAssignment =
      assignmentFilter === 'ALL' ||
      (assignmentFilter === 'PENDING' && o.assignmentStatus !== 'ASSIGNED_AND_LOCKED') ||
      (assignmentFilter === 'LOCKED' && o.assignmentStatus === 'ASSIGNED_AND_LOCKED');

    let matchesCategory = true;
    if (selectedCategoryFilter !== 'ALL') {
      if (selectedCategoryFilter === 'NEW') {
        matchesCategory = o.orderStatus === 'PENDING' || o.orderStatus === 'CONFIRMED';
      } else if (selectedCategoryFilter === 'PENDING_ACTION') {
        matchesCategory = ['PENDING', 'CONFIRMED', 'READY_TO_SHIP'].includes(o.orderStatus) || (o.orderStatus === 'SHIPPED' && !o.assignedDeliveryBoyId);
      } else if (selectedCategoryFilter === 'READY_TO_SHIP') {
        matchesCategory = o.orderStatus === 'READY_TO_SHIP';
      } else if (selectedCategoryFilter === 'SHIPPED') {
        matchesCategory = o.orderStatus === 'SHIPPED';
      } else if (selectedCategoryFilter === 'DELIVERY_ASSIGNMENT') {
        matchesCategory = ['SHIPPED', 'DELIVERY_FAILED'].includes(o.orderStatus) && !o.assignedDeliveryBoyId;
      } else if (selectedCategoryFilter === 'ASSIGNED') {
        matchesCategory = o.orderStatus === 'ASSIGNED';
      } else if (selectedCategoryFilter === 'ACCEPTED') {
        matchesCategory = o.orderStatus === 'ACCEPTED';
      } else if (selectedCategoryFilter === 'OUT_FOR_DELIVERY') {
        matchesCategory = o.orderStatus === 'OUT_FOR_DELIVERY';
      } else if (selectedCategoryFilter === 'DELIVERED') {
        matchesCategory = o.orderStatus === 'DELIVERED';
      } else if (selectedCategoryFilter === 'DELIVERY_FAILED') {
        matchesCategory = o.orderStatus === 'DELIVERY_FAILED';
      } else if (selectedCategoryFilter === 'PANTRY') {
        matchesCategory = o.orderType === 'PANTRY';
      } else if (selectedCategoryFilter === 'QUICK') {
        matchesCategory = o.orderType === 'QUICK';
      } else if (selectedCategoryFilter === 'COMPLETED') {
        matchesCategory = o.orderStatus === 'COMPLETED';
      }
    }

    return matchesSearch && matchesType && matchesDeliveryBoy && matchesDate && matchesCategory && matchesAssignment;
  }).sort((a, b) => {
    const tsA = getOrderPreciseTimestamp(a);
    const tsB = getOrderPreciseTimestamp(b);
    const dateA = parseFormattedDate(tsA);
    const dateB = parseFormattedDate(tsB);
    const timeA = dateA ? dateA.getTime() : 0;
    const timeB = dateB ? dateB.getTime() : 0;
    if (timeA !== timeB) {
      return timeSortOrder === 'NEWEST_FIRST' ? timeB - timeA : timeA - timeB;
    }
    return timeSortOrder === 'NEWEST_FIRST' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
  });

  const filteredOrders = filteredAndSortedOrders;

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600 animate-bounce" />
              <span>ERP Logistics, Fleet &amp; Delivery Management</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dual-track fulfillment dispatch, delivery partner real-time tracking, COD collection registers &amp; audit trails.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchData}
              className="p-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 text-xs transition cursor-pointer flex items-center gap-1 font-semibold"
              title="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sync</span>
            </button>
            {activeSection === 'delivery-boys' && (
              <button
                onClick={() => setIsNewDeliveryBoyOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Add Delivery Boy Master
              </button>
            )}
            {activeSection === 'auditors' && (
              <button
                onClick={() => setIsNewAuditorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Add Field Auditor
              </button>
            )}
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-medium scrollbar-none">
          <button
            onClick={() => setActiveSection('orders')}
            className={`py-2 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'orders'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Order Dispatch Control ({orders.length})
          </button>

          <button
            onClick={() => setActiveSection('delivery-boys')}
            className={`py-2 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'delivery-boys'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4 text-amber-500" />
            Fulfillment Fleet &amp; Roster ({deliveryBoys.length})
          </button>

          <button
            onClick={() => setActiveSection('auditors')}
            className={`py-2 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'auditors'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-cyan-500" />
            Field Audit Fleet ({auditors.length})
          </button>

          <button
            onClick={() => setActiveSection('returns')}
            className={`py-2 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'returns'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-rose-500" />
            Return Pickups ({returns.length})
          </button>

          <button
            onClick={() => setActiveSection('replacements')}
            className={`py-2 px-3 border-b-2 font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSection === 'replacements'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-emerald-500" />
            Replacements Queue ({replacements.length})
          </button>
        </div>
      </div>

      {/* CLICKABLE SUMMARY CARDS - Rule 1 & 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-3">
        {/* Total Orders Card */}
        <div
          onClick={() => handleSummaryCardClick('ALL')}
          className={`p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs ${
            orderStatusFilter === 'ALL' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10' : 'border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-xl font-black text-slate-800">{countTotalOrders}</div>
        </div>

        {/* Pending Assignment Card */}
        <div
          onClick={() => handleSummaryCardClick('PENDING')}
          className={`p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs ${
            orderStatusFilter === 'PENDING' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10' : 'border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Pending Assign</span>
            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <div className="mt-2 text-xl font-black text-amber-600">{countPending}</div>
        </div>

        {/* Ready to Ship / Shipped Card */}
        <div
          onClick={() => handleSummaryCardClick('SHIPPED')}
          className={`p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs ${
            orderStatusFilter === 'SHIPPED' ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/10' : 'border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Shipped</span>
            <Truck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-xl font-black text-purple-600">{countShipped}</div>
        </div>

        {/* Assigned Card */}
        <div
          onClick={() => handleSummaryCardClick('ASSIGNED')}
          className={`p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs ${
            orderStatusFilter === 'ASSIGNED' ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Assigned</span>
            <UserCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-black text-blue-600">{countAssigned}</div>
        </div>

        {/* Accepted Card */}
        <div
          onClick={() => handleSummaryCardClick('ACCEPTED')}
          className={`p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs ${
            orderStatusFilter === 'ACCEPTED' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10' : 'border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Accepted</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-black text-emerald-600">{countAccepted}</div>
        </div>

        {/* Out For Delivery Card */}
        <div
          onClick={() => handleSummaryCardClick('OUT_FOR_DELIVERY')}
          className={`p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs ${
            orderStatusFilter === 'OUT_FOR_DELIVERY' ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/10' : 'border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Out for Deliv</span>
            <Map className="w-4 h-4 text-sky-500 animate-bounce" />
          </div>
          <div className="mt-2 text-xl font-black text-sky-600">{countOutForDelivery}</div>
        </div>

        {/* Delivered Card */}
        <div
          onClick={() => handleSummaryCardClick('COMPLETED')}
          className={`p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs ${
            orderStatusFilter === 'COMPLETED' ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/10' : 'border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Delivered</span>
            <CheckCircle className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-2 text-xl font-black text-teal-600">{countCompleted}</div>
        </div>

        {/* Failed Card */}
        <div
          onClick={() => handleSummaryCardClick('DELIVERY_FAILED')}
          className={`p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs ${
            orderStatusFilter === 'DELIVERY_FAILED' ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/10' : 'border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Failed</span>
            <AlertTriangle className="w-4 h-4 text-rose-500 animate-ping" />
          </div>
          <div className="mt-2 text-xl font-black text-rose-600">{countFailed}</div>
        </div>

        {/* Return Queue Card */}
        <div
          onClick={() => { setActiveSection('returns'); }}
          className="p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs border-slate-200"
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Return Queue</span>
            <RotateCcw className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-xl font-black text-indigo-600">{countReturnQueue}</div>
        </div>

        {/* Replacement Queue Card */}
        <div
          onClick={() => { setActiveSection('replacements'); }}
          className="p-3 bg-white rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col justify-between shadow-xs border-slate-200"
        >
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500">Replacement Q</span>
            <RefreshCw className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="mt-2 text-xl font-black text-cyan-600">{countReplacementQueue}</div>
        </div>

        {/* COD Financial Summary Card */}
        <div className="p-3 bg-slate-900 text-white rounded-xl flex flex-col justify-between shadow-md col-span-2 md:col-span-1">
          <div className="flex justify-between items-start opacity-70">
            <span className="text-[9px] font-bold uppercase tracking-wider">COD Registry</span>
            <Coins className="w-4 h-4 text-yellow-400 animate-spin-slow" />
          </div>
          <div className="mt-1 text-xs">
            <div className="flex justify-between text-[10px] border-b border-white/10 pb-1">
              <span>Collected:</span>
              <span className="font-mono text-emerald-400 font-bold">₹{codCollectedTotal}</span>
            </div>
            <div className="flex justify-between text-[10px] pt-1">
              <span>Pending:</span>
              <span className="font-mono text-yellow-400">₹{codPendingTotal}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Orders Dispatch Management */}
      {activeSection === 'orders' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT COLUMN: 17-Item Category Sidebar */}
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 px-2 flex items-center justify-between">
                <span>Order Management</span>
                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">{orders.length}</span>
              </h3>
              <nav className="space-y-1">
                {[
                  { id: 'ALL', label: 'All Orders', icon: ShoppingBag, color: 'text-indigo-600', count: orders.length },
                  { id: 'NEW', label: 'New Orders', icon: PlusCircle, color: 'text-emerald-600', count: orders.filter(o => o.orderStatus === 'PENDING' || o.orderStatus === 'CONFIRMED').length },
                  { id: 'PENDING_ACTION', label: 'Pending Action', icon: AlertTriangle, color: 'text-rose-500', count: orders.filter(o => ['PENDING', 'CONFIRMED', 'READY_TO_SHIP'].includes(o.orderStatus) || (o.orderStatus === 'SHIPPED' && !o.assignedDeliveryBoyId)).length },
                  { id: 'READY_TO_SHIP', label: 'Ready to Ship', icon: FileText, color: 'text-blue-500', count: orders.filter(o => o.orderStatus === 'READY_TO_SHIP').length },
                  { id: 'SHIPPED', label: 'Shipped', icon: Truck, color: 'text-purple-600', count: orders.filter(o => o.orderStatus === 'SHIPPED').length },
                  { id: 'DELIVERY_ASSIGNMENT', label: 'Delivery Assignment', icon: UserCheck, color: 'text-amber-500', count: orders.filter(o => ['SHIPPED', 'DELIVERY_FAILED'].includes(o.orderStatus) && !o.assignedDeliveryBoyId).length },
                  { id: 'ASSIGNED', label: 'Assigned', icon: Shield, color: 'text-indigo-400', count: orders.filter(o => o.orderStatus === 'ASSIGNED').length },
                  { id: 'ACCEPTED', label: 'Accepted', icon: CheckCircle, color: 'text-teal-600', count: orders.filter(o => o.orderStatus === 'ACCEPTED').length },
                  { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Map, color: 'text-sky-500', count: orders.filter(o => o.orderStatus === 'OUT_FOR_DELIVERY').length },
                  { id: 'DELIVERED', label: 'Delivered', icon: CheckCircle, color: 'text-teal-500', count: orders.filter(o => o.orderStatus === 'DELIVERED').length },
                  { id: 'DELIVERY_FAILED', label: 'Delivery Failed', icon: XCircle, color: 'text-rose-600', count: orders.filter(o => o.orderStatus === 'DELIVERY_FAILED').length },
                  { id: 'PANTRY', label: 'Pantry Orders', icon: CreditCard, color: 'text-fuchsia-600', count: orders.filter(o => o.orderType === 'PANTRY').length },
                  { id: 'QUICK', label: 'Quick Orders', icon: Coins, color: 'text-amber-600', count: orders.filter(o => o.orderType === 'QUICK').length },
                  { id: 'RETURN', label: 'Returns Queue', icon: RotateCcw, color: 'text-rose-500', count: returns.length },
                  { id: 'REPLACEMENT', label: 'Replacements', icon: RefreshCw, color: 'text-emerald-500', count: replacements.length },
                  { id: 'COMPLETED', label: 'Completed', icon: CheckCircle, color: 'text-indigo-700', count: orders.filter(o => o.orderStatus === 'COMPLETED').length },
                  { id: 'TIMELINE', label: 'Order Activity Logs', icon: Calendar, color: 'text-slate-600', count: auditLogs.filter(l => l.entity === 'ORDER' || l.action?.includes('ORDER')).length }
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryFilter(cat.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-semibold rounded-lg transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : cat.color}`} />
                        <span>{cat.label}</span>
                      </div>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isSelected ? 'bg-indigo-700 text-indigo-100 font-bold' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Today's Priority and Delivery summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Today's Dispatch Summary</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-3xs">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Total Run</span>
                  <div className="text-base font-black text-slate-800">
                    {orders.filter(o => {
                      const d = parseFormattedDate(getOrderPreciseTimestamp(o));
                      if (!d) return false;
                      const today = new Date();
                      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                    }).length}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-3xs">
                  <span className="text-[9px] text-amber-600 font-bold uppercase">Priority</span>
                  <div className="text-base font-black text-amber-600">
                    {orders.filter(o => {
                      const d = parseFormattedDate(getOrderPreciseTimestamp(o));
                      if (!d) return false;
                      const today = new Date();
                      const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                      return isToday && (o.orderType === 'QUICK' || o.totalAmount > 2000);
                    }).length}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-3xs">
                  <span className="text-[9px] text-teal-600 font-bold uppercase">Done</span>
                  <div className="text-base font-black text-teal-600">
                    {orders.filter(o => {
                      const d = parseFormattedDate(getOrderPreciseTimestamp(o));
                      if (!d) return false;
                      const today = new Date();
                      const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                      return isToday && ['DELIVERED', 'COMPLETED'].includes(o.orderStatus);
                    }).length}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-3xs">
                  <span className="text-[9px] text-rose-600 font-bold uppercase">Failed</span>
                  <div className="text-base font-black text-rose-600">
                    {orders.filter(o => {
                      const d = parseFormattedDate(getOrderPreciseTimestamp(o));
                      if (!d) return false;
                      const today = new Date();
                      const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                      return isToday && o.orderStatus === 'DELIVERY_FAILED';
                    }).length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Filters and Dynamic Content Feed */}
          <div className="flex-1 space-y-4">
            {/* Advanced Filters Panel */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Search query input */}
                <div className="relative md:col-span-2">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Order ID, Customer Name, Mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Date filter dropdown */}
                <div>
                  <select
                    value={dateFilterRange}
                    onChange={(e) => setDateFilterRange(e.target.value as any)}
                    className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-semibold text-slate-700"
                  >
                    <option value="ALL">All Timeframe Logs</option>
                    <option value="TODAY">Today's Deliveries</option>
                    <option value="YESTERDAY">Yesterday's Activity</option>
                    <option value="LAST_7">Last 7 Days</option>
                    <option value="LAST_30">Last 30 Days</option>
                    <option value="CUSTOM">Custom Date Range</option>
                  </select>
                </div>

                {/* Delivery Boy Roster Filter */}
                <div>
                  <select
                    value={feedDeliveryBoyFilter}
                    onChange={(e) => setFeedDeliveryBoyFilter(e.target.value)}
                    className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-semibold text-slate-700"
                  >
                    <option value="ALL">All Roster Delivery Boys</option>
                    {deliveryBoys.map(db => (
                      <option key={db.id} value={db.id}>{db.fullName} ({db.id})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Date Inputs */}
              {dateFilterRange === 'CUSTOM' && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">From:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">To:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Batch Assignment Status Filter & View Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Batch Assignment:
                  </span>
                  <button
                    type="button"
                    onClick={() => setAssignmentFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                      assignmentFilter === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Orders
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignmentFilter('PENDING')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                      assignmentFilter === 'PENDING'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <span>⚠️ Awaiting Batch Assignment</span>
                    <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-black">
                      {orders.filter((o) => o.assignmentStatus !== 'ASSIGNED_AND_LOCKED').length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignmentFilter('LOCKED')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                      assignmentFilter === 'LOCKED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <span>🔒 Assigned &amp; Locked</span>
                    <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-black">
                      {orders.filter((o) => o.assignmentStatus === 'ASSIGNED_AND_LOCKED').length}
                    </span>
                  </button>
                </div>

                {/* Time Chronological Sorting Controls */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setTimeSortOrder('NEWEST_FIRST')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      timeSortOrder === 'NEWEST_FIRST'
                        ? 'bg-indigo-600 text-white shadow-3xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="New orders always on top (Latest order time first)"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Newest First</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeSortOrder('OLDEST_FIRST')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      timeSortOrder === 'OLDEST_FIRST'
                        ? 'bg-indigo-600 text-white shadow-3xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Oldest orders first"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>Oldest First</span>
                  </button>
                </div>

                {/* View Layout Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setOrderViewMode('grid')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      orderViewMode === 'grid'
                        ? 'bg-white text-indigo-700 shadow-3xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Small-sized Systematic Compact Cards"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Compact Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderViewMode('dense')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      orderViewMode === 'dense'
                        ? 'bg-white text-indigo-700 shadow-3xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Systematic Dense Rows List"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Dense List</span>
                  </button>
                </div>
              </div>
            </div>

            {/* DYNAMIC CONTENT CHRONOLOGICAL FEED */}
            {selectedCategoryFilter === 'TIMELINE' ? (
              /* ORDER ACTIVITY LOGS TIMELINE stream */
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-sm">Central Order Activity Timeline Feed</h3>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                    {auditLogs.filter(l => l.entity === 'ORDER' || l.action?.includes('ORDER')).length} total actions
                  </span>
                </div>

                <div className="relative border-l-2 border-slate-100 pl-5 ml-2.5 space-y-5">
                  {auditLogs.filter(l => l.entity === 'ORDER' || l.action?.includes('ORDER')).length === 0 ? (
                    <div className="text-center text-slate-400 py-6 text-xs">
                      No system logs found for Order entity events.
                    </div>
                  ) : (
                    auditLogs
                      .filter(l => l.entity === 'ORDER' || l.action?.includes('ORDER'))
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((log) => (
                        <div key={log.id} className="relative group">
                          {/* Dot accent */}
                          <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-500 shadow-2xs group-hover:bg-indigo-500 transition" />
                          <div className="bg-slate-50/50 hover:bg-slate-50 p-3 rounded-lg border border-slate-100/60 text-xs transition">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-bold text-slate-800">{log.action}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                            </div>
                            <p className="text-slate-600 mt-1">
                              Target Order: <strong className="font-mono text-indigo-600 hover:underline cursor-pointer" onClick={() => {
                                const found = orders.find(o => o.id === log.entityId);
                                if (found) setSelectedOrder(found);
                              }}>{log.entityId}</strong>
                            </p>
                            {log.oldValue && log.newValue && (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Transition: <span className="font-semibold text-slate-700">{log.oldValue}</span> → <span className="font-semibold text-slate-900">{log.newValue}</span>
                              </p>
                            )}
                            {log.reason && (
                              <p className="text-[11px] text-rose-600 italic mt-1 font-medium bg-rose-50/60 p-1.5 rounded border border-rose-100">
                                Override Reason: "{log.reason}"
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400 font-medium">
                              <span>Executed By:</span>
                              <span className="font-bold text-slate-600">{log.who}</span>
                              <span className="px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded text-[9px] uppercase font-bold">{log.role}</span>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            ) : selectedCategoryFilter === 'RETURN' ? (
              /* DEDICATED RETURNS LIST */
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Returns Queue &amp; Fulfillment Registry</h3>
                  <span className="text-[11px] text-rose-600 font-black">{returns.length} requests</span>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-100/60 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Return ID</th>
                        <th className="py-3 px-3">Customer Details</th>
                        <th className="py-3 px-3">Product Name</th>
                        <th className="py-3 px-3 text-center">Qty</th>
                        <th className="py-3 px-3 text-right">Refund Total</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {returns.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                            No active return requests found.
                          </td>
                        </tr>
                      ) : (
                        returns.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">{r.id}</td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{r.customerName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {r.customerId}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-800">{r.productName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Batch: #{r.batchNumber}</div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold">{r.quantity}</td>
                            <td className="py-3 px-3 text-right font-black text-slate-950">₹{r.refundCreditAmount}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                {r.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  const linkedOrder = orders.find(o => o.id === r.orderId);
                                  if (linkedOrder) setSelectedOrder(linkedOrder);
                                  else alert(`Order ${r.orderId} not found.`);
                                }}
                                className="px-2 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                              >
                                View Order
                              </button>
                              {!r.assignedDeliveryBoyId && (r.status === 'APPROVED' || r.status === 'PENDING') && (
                                <button
                                  onClick={() => {
                                    setAssigningReturn(r);
                                    setSelectedReturnDBoyId(deliveryBoys[0]?.id || '');
                                  }}
                                  className="ml-1.5 px-2 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded cursor-pointer transition shadow-3xs"
                                >
                                  Assign Boy
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : selectedCategoryFilter === 'REPLACEMENT' ? (
              /* DEDICATED REPLACEMENTS LIST */
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Replacements Dispatch Queue</h3>
                  <span className="text-[11px] text-emerald-600 font-black">{replacements.length} requests</span>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-100/60 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Replacement ID</th>
                        <th className="py-3 px-3">Customer Details</th>
                        <th className="py-3 px-3">Product Name</th>
                        <th className="py-3 px-3 text-center">Qty</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {replacements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                            No active replacement requests found.
                          </td>
                        </tr>
                      ) : (
                        replacements.map((rep) => (
                          <tr key={rep.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">{rep.id}</td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{rep.customerName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {rep.customerId}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-800">{rep.productName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Original Batch: #{rep.originalBatchNumber}</div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold">{rep.quantity}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {rep.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  const linkedOrder = orders.find(o => o.id === rep.orderId);
                                  if (linkedOrder) setSelectedOrder(linkedOrder);
                                  else alert(`Order ${rep.orderId} not found.`);
                                }}
                                className="px-2 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                              >
                                View Order
                              </button>
                              {!rep.assignedDeliveryBoyId && (rep.status === 'APPROVED' || rep.status === 'PENDING') && (
                                <button
                                  onClick={() => {
                                    setAssigningReplacement(rep);
                                    setSelectedReplacementDBoyId(deliveryBoys[0]?.id || '');
                                  }}
                                  className="ml-1.5 px-2 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded cursor-pointer transition shadow-3xs"
                                >
                                  Assign Boy
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* CHRONOLOGICAL UNIFIED ORDERS CARD FEED - COMPACT & SYSTEMATIC */
              <div>
                {loading ? (
                  <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200 shadow-3xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    <p className="text-xs font-semibold">Syncing transaction state database...</p>
                  </div>
                ) : filteredAndSortedOrders.length === 0 ? (
                  <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200 shadow-3xs">
                    <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold">No orders found matching the active category filters.</p>
                  </div>
                ) : orderViewMode === 'grid' ? (
                  /* SYSTEMATIC COMPACT CARDS GRID */
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                    {filteredAndSortedOrders.map((o) => {
                      const isPriority = o.orderType === 'QUICK' || o.totalAmount > 2000;
                      return (
                        <div
                          key={o.id}
                          className={`bg-white rounded-xl border p-3 shadow-3xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between ${
                            isPriority
                              ? 'border-amber-300/90 ring-1 ring-amber-400/20 bg-linear-to-b from-amber-50/20 to-white'
                              : 'border-slate-200/90 hover:border-indigo-300'
                          }`}
                        >
                          {/* Left Accent Bar for Priority */}
                          {isPriority && (
                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                          )}

                          {/* ZONE 1: Systematic Header Bar */}
                          <div className={`flex items-center justify-between gap-2 border-b border-slate-100 pb-2 ${isPriority ? 'pl-1' : ''}`}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Order ID with Icon */}
                              <div
                                onClick={() => setSelectedOrder(o)}
                                className="font-mono font-black text-indigo-600 hover:text-indigo-800 cursor-pointer text-xs flex items-center gap-1 hover:underline"
                                title="Click to view details"
                              >
                                <Hash className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>{o.id}</span>
                              </div>

                              {/* Order Type Badge */}
                              {o.orderType === 'PANTRY' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80">
                                  <CreditCard className="w-2.5 h-2.5 text-purple-600 shrink-0" /> PANTRY
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                                  <Zap className="w-2.5 h-2.5 text-amber-600 shrink-0" /> QUICK COD
                                </span>
                              )}

                              {/* Priority Chip */}
                              {isPriority && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                  <Zap className="w-2.5 h-2.5 fill-rose-600 text-rose-600 shrink-0" /> HOT
                                </span>
                              )}

                              {/* Batch Assignment Status */}
                              {o.assignmentStatus === 'ASSIGNED_AND_LOCKED' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Physical batches deducted & locked">
                                  <Lock className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> Locked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse" title="Physical batch selection pending">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" /> Batch Req
                                </span>
                              )}
                            </div>

                            {/* Status & Exact Order Timestamp (Date on top, Time below without box) */}
                            <div className="flex items-center gap-2 shrink-0 justify-end">
                              <StatusBadge status={o.orderStatus} />
                              {(() => {
                                const dt = formatOrderDateTime(getOrderPreciseTimestamp(o));
                                return (
                                  <div className="flex flex-col items-end text-right font-mono leading-tight shrink-0">
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{dt.date}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 mt-0.5">
                                      <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span>{dt.time || '00:00 AM'}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* ZONE 2: Information Matrix (Customer, Items, Location, Fleet & Total) */}
                          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 text-xs ${isPriority ? 'pl-1' : ''}`}>
                            {/* Col 1 & 2: Customer, Items & Location */}
                            <div className="sm:col-span-2 space-y-1">
                              {/* Customer row */}
                              <div className="flex items-center gap-1.5 text-slate-700 truncate">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-bold text-slate-900 truncate max-w-[130px]">{o.customerName}</span>
                                <span className="text-slate-300">·</span>
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-slate-600 font-mono text-[11px] truncate">+91 {o.customerMobile}</span>
                              </div>

                              {/* Items summary row */}
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                                <Package className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="font-bold text-slate-800 shrink-0">
                                  {o.items.length} item{o.items.length > 1 ? 's' : ''} (Qty {o.items.reduce((s, i) => s + i.quantity, 0)})
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="truncate text-slate-500 text-[10px]" title={o.items.map(i => i.productName).join(', ')}>
                                  {o.items.map(i => i.productName).join(', ')}
                                </span>
                              </div>

                              {/* Live Transit Location */}
                              <div className="flex items-center gap-1 text-[10px] text-emerald-800 truncate bg-emerald-50/70 px-1.5 py-0.5 rounded border border-emerald-100/80 max-w-[320px]">
                                <Navigation className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                <span className="truncate">
                                  {o.currentLocation || (o.orderStatus === 'DELIVERED' ? 'Delivered at Doorstep' : o.orderStatus === 'OUT_FOR_DELIVERY' ? 'Out with Delivery Boy' : o.orderStatus === 'SHIPPED' ? 'Shipped from Hub' : 'Warehouse Fulfillment')}
                                </span>
                              </div>
                            </div>

                            {/* Col 3: Amount & Fleet Partner */}
                            <div className="flex sm:flex-col justify-between sm:justify-center items-end border-t sm:border-t-0 sm:border-l border-slate-100 pt-1.5 sm:pt-0 sm:pl-2.5">
                              {/* Total Amount */}
                              <div className="text-right">
                                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Bill Total</div>
                                <div className="text-sm sm:text-base font-black text-slate-900 font-mono flex items-center justify-end">
                                  <IndianRupee className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                                  <span>{o.totalAmount}</span>
                                </div>
                              </div>

                              {/* Fleet Assignment */}
                              <div className="text-right mt-0.5 sm:mt-1">
                                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Fleet</div>
                                <div className="flex items-center justify-end gap-1 text-[11px] mt-0.5">
                                  {o.assignedDeliveryBoyId ? (
                                    <div className="flex items-center gap-1 font-semibold text-slate-800 truncate max-w-[110px]" title={o.assignedDeliveryBoyName}>
                                      <Truck className="w-3 h-3 text-indigo-600 shrink-0" />
                                      <span className="truncate">{o.assignedDeliveryBoyName}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                      Unassigned
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* ZONE 3: Systematic Micro Action Ribbon */}
                          <div className={`flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 flex-wrap ${isPriority ? 'pl-1' : ''}`}>
                            {/* Standard Core Operations */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {/* Batches / Assign Batches */}
                              <button
                                onClick={() => setAssigningProductOrder(o)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 cursor-pointer ${
                                  o.assignmentStatus === 'ASSIGNED_AND_LOCKED'
                                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-3xs animate-pulse'
                                }`}
                                title={
                                  o.assignmentStatus === 'ASSIGNED_AND_LOCKED'
                                    ? 'View locked product batch assignment and print bills'
                                    : 'Select physical batches & lock inventory deduction'
                                }
                              >
                                <Package className="w-3 h-3 shrink-0" />
                                <span>{o.assignmentStatus === 'ASSIGNED_AND_LOCKED' ? 'Batches' : 'Assign'}</span>
                              </button>

                              {/* Track & Lock Progression */}
                              <button
                                onClick={() => {
                                  setSelectedOrder(o);
                                  setOrderModalView('DETAILS');
                                }}
                                className="px-2 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-md transition flex items-center gap-1 cursor-pointer shadow-3xs"
                                title="Track progress and advance irreversible locked steps"
                              >
                                <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Track</span>
                              </button>

                              {/* Tax Invoice & PDF Bill */}
                              <button
                                onClick={() => setPrintingCustomerBillOrder(o)}
                                className="px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-md transition flex items-center gap-1 cursor-pointer"
                                title="View Customer Tax Invoice & Download PDF"
                              >
                                <Receipt className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>Bill</span>
                              </button>

                              {/* Order Details Modal */}
                              <button
                                onClick={() => setSelectedOrder(o)}
                                className="px-2 py-1 text-[11px] font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-md transition flex items-center gap-1 cursor-pointer"
                                title="Full Order Inspection"
                              >
                                <Eye className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>Details</span>
                              </button>
                            </div>

                            {/* Contextual Execution Step */}
                            <div className="flex items-center gap-1">
                              {/* Ship Order */}
                              {o.orderStatus === 'CONFIRMED' && (
                                <button
                                  onClick={() => handleShipOrder(o.id)}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-md transition flex items-center gap-1 cursor-pointer shadow-3xs"
                                >
                                  <Send className="w-3 h-3 shrink-0" />
                                  <span>Ship</span>
                                </button>
                              )}

                              {/* Assign Rider */}
                              {['SHIPPED', 'DELIVERY_FAILED'].includes(o.orderStatus) && !o.assignedDeliveryBoyId && (
                                <button
                                  onClick={() => {
                                    setAssigningOrder(o);
                                    setSelectedDeliveryBoyId(deliveryBoys[0]?.id || '');
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-md transition flex items-center gap-1 cursor-pointer shadow-3xs animate-pulse"
                                >
                                  <Bike className="w-3 h-3 shrink-0" />
                                  <span>Assign Rider</span>
                                </button>
                              )}

                              {/* Reassign Rider */}
                              {((o.orderStatus === 'ASSIGNED') || (['SHIPPED', 'DELIVERY_FAILED'].includes(o.orderStatus) && !!o.assignedDeliveryBoyId)) && (
                                <button
                                  onClick={() => {
                                    setSelectedOrder(o);
                                    setTargetDeliveryBoyId(o.assignedDeliveryBoyId || deliveryBoys[0]?.id || '');
                                    setIsReassigning(true);
                                  }}
                                  className="px-2 py-1 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-md transition flex items-center gap-1 cursor-pointer"
                                  title="Reassign to another rider"
                                >
                                  <RotateCcw className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Reassign</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* SYSTEMATIC DENSE LIST VIEW */
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-3xs">
                    <div className="overflow-x-auto text-xs">
                      <table className="min-w-full divide-y divide-slate-200 text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Order &amp; Type</th>
                            <th className="py-2.5 px-3">Order Date &amp; Time</th>
                            <th className="py-2.5 px-3">Customer</th>
                            <th className="py-2.5 px-3">Items</th>
                            <th className="py-2.5 px-3">Location / Step</th>
                            <th className="py-2.5 px-3">Fleet</th>
                            <th className="py-2.5 px-3 text-right">Bill Total</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAndSortedOrders.map((o) => {
                            const isPriority = o.orderType === 'QUICK' || o.totalAmount > 2000;
                            const dt = formatOrderDateTime(getOrderPreciseTimestamp(o));
                            return (
                              <tr key={o.id} className="hover:bg-slate-50/80 transition">
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      onClick={() => setSelectedOrder(o)}
                                      className="font-mono font-bold text-indigo-600 hover:underline cursor-pointer flex items-center gap-0.5"
                                    >
                                      <Hash className="w-3 h-3 text-indigo-500" />
                                      {o.id}
                                    </span>
                                    {o.orderType === 'PANTRY' ? (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                        PANTRY
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        QUICK COD
                                      </span>
                                    )}
                                    {isPriority && (
                                      <span className="px-1 py-0.2 rounded text-[8px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                        HOT
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 leading-tight">
                                    <div className="flex items-center gap-1 font-semibold text-slate-700">
                                      <Calendar className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span>{dt.date}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                                      <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span>{dt.time || '00:00 AM'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-col font-mono leading-tight">
                                    <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{dt.date}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mt-0.5">
                                      <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span>{dt.time || '00:00 AM'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900 flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>{o.customerName}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                    <Phone className="w-2.5 h-2.5 text-slate-400" />
                                    <span>+91 {o.customerMobile}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-800 flex items-center gap-1">
                                    <Package className="w-3 h-3 text-indigo-500" />
                                    <span>{o.items.length} items (Qty {o.items.reduce((s, i) => s + i.quantity, 0)})</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                    {o.items.map(i => i.productName).join(', ')}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50/70 px-1.5 py-0.5 rounded border border-emerald-100 max-w-[200px] truncate">
                                    <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span className="truncate">{o.currentLocation || (o.orderStatus === 'DELIVERED' ? 'Delivered' : o.orderStatus === 'OUT_FOR_DELIVERY' ? 'Out for Delivery' : o.orderStatus === 'SHIPPED' ? 'Shipped' : 'Warehouse')}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  {o.assignedDeliveryBoyId ? (
                                    <div className="flex items-center gap-1 font-semibold text-slate-800 text-[11px]">
                                      <Truck className="w-3 h-3 text-indigo-600 shrink-0" />
                                      <span className="truncate max-w-[100px]">{o.assignedDeliveryBoyName}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                      Unassigned
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="font-mono font-black text-slate-900 text-xs flex items-center justify-end">
                                    <IndianRupee className="w-3 h-3 text-slate-600 shrink-0" />
                                    <span>{o.totalAmount}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <StatusBadge status={o.orderStatus} />
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => setAssigningProductOrder(o)}
                                      className={`px-1.5 py-1 text-[10px] font-bold rounded transition cursor-pointer flex items-center gap-1 ${
                                        o.assignmentStatus === 'ASSIGNED_AND_LOCKED'
                                          ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                          : 'bg-indigo-600 text-white hover:bg-indigo-700 animate-pulse'
                                      }`}
                                      title="Batches"
                                    >
                                      <Package className="w-3 h-3" />
                                      <span>{o.assignmentStatus === 'ASSIGNED_AND_LOCKED' ? 'Batches' : 'Assign'}</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedOrder(o);
                                        setOrderModalView('DETAILS');
                                      }}
                                      className="px-1.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded transition cursor-pointer flex items-center gap-1"
                                      title="Track & Lock"
                                    >
                                      <Lock className="w-3 h-3" />
                                      <span>Track</span>
                                    </button>
                                    <button
                                      onClick={() => setPrintingCustomerBillOrder(o)}
                                      className="px-1.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded transition cursor-pointer flex items-center gap-1"
                                      title="Bill & PDF"
                                    >
                                      <Receipt className="w-3 h-3" />
                                      <span>Bill</span>
                                    </button>
                                    <button
                                      onClick={() => setSelectedOrder(o)}
                                      className="px-1.5 py-1 text-[10px] font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded transition cursor-pointer"
                                      title="Details"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                    {o.orderStatus === 'CONFIRMED' && (
                                      <button
                                        onClick={() => handleShipOrder(o.id)}
                                        className="px-2 py-1 text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded transition cursor-pointer shadow-3xs"
                                        title="Ship Order"
                                      >
                                        <Send className="w-3 h-3" />
                                      </button>
                                    )}
                                    {['SHIPPED', 'DELIVERY_FAILED'].includes(o.orderStatus) && !o.assignedDeliveryBoyId && (
                                      <button
                                        onClick={() => {
                                          setAssigningOrder(o);
                                          setSelectedDeliveryBoyId(deliveryBoys[0]?.id || '');
                                        }}
                                        className="px-2 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded transition cursor-pointer shadow-3xs animate-pulse"
                                        title="Assign Rider"
                                      >
                                        <Bike className="w-3 h-3" />
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
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: Delivery Fleet Roster Management */}
      {activeSection === 'delivery-boys' && (
        <div className="space-y-4">
          {/* Top Control & KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Total Fleet</span>
                <Truck className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{deliveryBoys.length}</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Active Riders</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {deliveryBoys.filter((db) => db.status === 'ACTIVE').length}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>In-Transit / Pending</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-black text-amber-700 mt-1">
                {orders.filter((o) => ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus) && o.assignedDeliveryBoyId).length}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-sky-600 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Out For Delivery</span>
                <Bike className="w-3.5 h-3.5 text-sky-600" />
              </div>
              <div className="text-xl font-black text-sky-700 mt-1">
                {orders.filter((o) => o.orderStatus === 'OUT_FOR_DELIVERY').length}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
              <div className="text-[10px] text-purple-600 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Total Delivered</span>
                <CheckCircle className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="text-xl font-black text-purple-700 mt-1">
                {orders.filter((o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED').length}
              </div>
            </div>
          </div>

          {/* Search, Filter and Actions Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-1 w-full gap-2 items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search delivery partner by Name, Mobile, Area, Vehicle or ID..."
                  value={deliveryBoySearchQuery}
                  onChange={(e) => setDeliveryBoySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-slate-50 font-medium"
                />
                {deliveryBoySearchQuery && (
                  <button
                    onClick={() => setDeliveryBoySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={deliveryBoyStatusFilter}
                  onChange={(e) => setDeliveryBoyStatusFilter(e.target.value as any)}
                  className="py-2 px-3 text-xs border border-slate-200 rounded-lg bg-white font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="ALL">All Status ({deliveryBoys.length})</option>
                  <option value="ACTIVE">Active ({deliveryBoys.filter((d) => d.status === 'ACTIVE').length})</option>
                  <option value="INACTIVE">Inactive ({deliveryBoys.filter((d) => d.status === 'INACTIVE').length})</option>
                  <option value="SUSPENDED">Suspended ({deliveryBoys.filter((d) => d.status === 'SUSPENDED').length})</option>
                </select>
              </div>
            </div>

            {/* Register New Delivery Boy CTA */}
            <button
              onClick={() => setIsNewDeliveryBoyOpen(true)}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register Delivery Partner</span>
            </button>
          </div>

          {/* Delivery Boy Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveryBoys
              .filter((db) => {
                const matchesSearch =
                  db.fullName.toLowerCase().includes(deliveryBoySearchQuery.toLowerCase()) ||
                  db.mobile.includes(deliveryBoySearchQuery) ||
                  db.id.toLowerCase().includes(deliveryBoySearchQuery.toLowerCase()) ||
                  db.assignedArea.toLowerCase().includes(deliveryBoySearchQuery.toLowerCase()) ||
                  (db.vehicleNumber && db.vehicleNumber.toLowerCase().includes(deliveryBoySearchQuery.toLowerCase()));

                const matchesStatus =
                  deliveryBoyStatusFilter === 'ALL' || db.status === deliveryBoyStatusFilter;

                return matchesSearch && matchesStatus;
              })
              .map((db) => {
                const stats = getDeliveryBoyStats(db.id);

                return (
                  <div
                    key={db.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between overflow-hidden"
                  >
                    <div className="p-5 space-y-3.5">
                      {/* Top Header with Profile and Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div
                          onClick={() => {
                            setViewingDeliveryBoyWork(db);
                            setDboyWorkTab('ALL');
                            setDboyDateFilter('ALL');
                            setDboyCustomDate('');
                            setDboySearchQuery('');
                          }}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-base group-hover:scale-105 transition-transform shrink-0 border border-amber-200">
                            <Bike className="w-6 h-6 text-amber-700" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 text-sm group-hover:text-amber-700 transition-colors flex items-center gap-1.5">
                              <span>{db.fullName}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </h4>
                            <div className="text-[11px] font-mono text-slate-500">{db.id}</div>
                          </div>
                        </div>

                        {/* Status Toggle & Badge */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleDeliveryBoyStatus(db)}
                            title={db.status === 'ACTIVE' ? 'Click to Deactivate' : 'Click to Activate'}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              db.status === 'ACTIVE'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700'
                                : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span className="text-[10px] uppercase font-bold">{db.status}</span>
                          </button>
                        </div>
                      </div>

                      {/* Contact & Territory Details */}
                      <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <Phone className="w-3.5 h-3.5 text-amber-600" />
                            <span className="font-mono">+91 {db.mobile}</span>
                          </div>
                          <a
                            href={`tel:+91${db.mobile}`}
                            className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-0.5"
                          >
                            Call
                          </a>
                        </div>

                        <div className="flex items-center gap-1.5 pt-0.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">Area: <strong className="text-slate-800">{db.assignedArea}</strong></span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <div>
                            Vehicle: <strong className="text-slate-700">{db.vehicleNumber || 'JH-01-AB-1234'}</strong> ({db.vehicleType})
                          </div>
                        </div>

                        {db.alternateContact && (
                          <div className="text-[10px] text-slate-400">
                            Alt: <span className="font-mono">{db.alternateContact}</span>
                          </div>
                        )}
                      </div>

                      {/* Live Work Counter Badges */}
                      <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="p-1 rounded-lg bg-amber-50 border border-amber-100">
                          <div className="text-[9px] font-bold uppercase text-amber-700">Pending</div>
                          <div className="font-black text-amber-800 text-sm mt-0.5">{stats.activeCount}</div>
                        </div>
                        <div className="p-1 rounded-lg bg-sky-50 border border-sky-100">
                          <div className="text-[9px] font-bold uppercase text-sky-700">In-Transit</div>
                          <div className="font-black text-sky-800 text-sm mt-0.5">{stats.outCount}</div>
                        </div>
                        <div className="p-1 rounded-lg bg-emerald-50 border border-emerald-100">
                          <div className="text-[9px] font-bold uppercase text-emerald-700">Delivered</div>
                          <div className="font-black text-emerald-800 text-sm mt-0.5">{stats.completedCount}</div>
                        </div>
                        <div className="p-1 rounded-lg bg-purple-50 border border-purple-100">
                          <div className="text-[9px] font-bold uppercase text-purple-700">COD (₹)</div>
                          <div className="font-black text-purple-800 text-sm mt-0.5">₹{stats.codCollected}</div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="p-4 pt-0 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setViewingDeliveryBoyWork(db);
                          setDboyWorkTab('ALL');
                          setDboyDateFilter('ALL');
                          setDboyCustomDate('');
                          setDboySearchQuery('');
                        }}
                        className="flex-1 py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Full Work &amp; Delivery History</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SECTION 3: Field Auditors Management */}
      {activeSection === 'auditors' && (
        <div className="space-y-4">
          {/* Top Control & KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Total Auditors</span>
                <Users className="w-3.5 h-3.5 text-cyan-600" />
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{auditors.length}</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Active</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {auditors.filter((a) => a.status === 'ACTIVE').length}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Inactive</span>
                <Power className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-xl font-black text-rose-700 mt-1">
                {auditors.filter((a) => a.status === 'INACTIVE').length}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-purple-600 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Assigned Households</span>
                <Building className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="text-xl font-black text-purple-900 mt-1">
                {auditors.reduce((acc, a) => acc + (a.assignedCustomerIds?.length || 0), 0)}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Audits Conducted</span>
                <ClipboardCheck className="w-3.5 h-3.5 text-cyan-600" />
              </div>
              <div className="text-xl font-black text-cyan-900 mt-1">
                {auditorChecks.length}
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search Auditor by Name, Mobile, Zone, or Auditor ID..."
                value={auditorSearchQuery}
                onChange={(e) => setAuditorSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={auditorStatusFilter}
                onChange={(e) => setAuditorStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <button
                onClick={() => setIsNewAuditorOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Field Auditor</span>
              </button>
            </div>
          </div>

          {/* Auditors Card Grid */}
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
                  aud.assignedZone.toLowerCase().includes(q)
                );
              })
              .map((aud) => {
                const assignedCustomersList = customers.filter((c) =>
                  aud.assignedCustomerIds?.includes(c.id)
                );
                const auditorChecksList = auditorChecks.filter((chk) => chk.auditorId === aud.id);

                return (
                  <div
                    key={aud.id}
                    className={`bg-white rounded-2xl border transition shadow-xs flex flex-col justify-between overflow-hidden ${
                      aud.status === 'INACTIVE'
                        ? 'border-rose-200 bg-rose-50/20 opacity-90'
                        : 'border-slate-200 hover:border-cyan-400'
                    }`}
                  >
                    {/* Header */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg ${
                              aud.status === 'ACTIVE'
                                ? 'bg-cyan-100 text-cyan-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            <ClipboardCheck className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                              {aud.fullName}
                            </h4>
                            <span className="text-[11px] font-mono text-cyan-700 font-bold">{aud.id}</span>
                          </div>
                        </div>

                        {/* Status Badge + Active/Deactive Toggle Switch */}
                        <div className="flex flex-col items-end gap-1.5">
                          <StatusBadge status={aud.status} />
                          <button
                            onClick={() => handleToggleAuditorStatus(aud)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wide cursor-pointer transition flex items-center gap-1 border ${
                              aud.status === 'ACTIVE'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title={aud.status === 'ACTIVE' ? 'Deactivate Auditor' : 'Activate Auditor'}
                          >
                            <Power className="w-2.5 h-2.5" />
                            <span>{aud.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Contact & Zone Details */}
                      <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono font-bold text-slate-900">+91 {aud.mobile}</span>
                        </div>
                        {aud.email && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{aud.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            Zone: <strong className="text-slate-800">{aud.assignedZone}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Assigned Customers Scope Section */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Building className="w-3 h-3 text-cyan-600" />
                            <span>Assigned Households ({assignedCustomersList.length})</span>
                          </div>
                          <button
                            onClick={() => handleOpenAssignModal(aud)}
                            className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>Assign / Edit</span>
                          </button>
                        </div>

                        {assignedCustomersList.length === 0 ? (
                          <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            ⚠️ No customer households assigned yet. Click 'Assign' to grant access.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                            {assignedCustomersList.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-800 shadow-2xs"
                                title={`${c.fullName} - ${c.address}, ${c.city}`}
                              >
                                <span className="text-cyan-700 font-mono text-[9px]">{c.id}:</span>
                                <span className="truncate max-w-[100px]">{c.fullName}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions: Conducted Audits & Timestamps History Button */}
                    <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                      <div className="text-xs">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Audits Done</div>
                        <div className="font-black text-slate-900 text-sm">
                          {auditorChecksList.length} Checks
                        </div>
                      </div>

                      <button
                        onClick={() => setViewingAuditorWork(aud)}
                        className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>Work History &amp; Bills</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SECTION 4: Returns Management & Return Pickups */}
      {activeSection === 'returns' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm">
              Return Requests &amp; Pickup Dispatch Registry
            </h3>
            <p className="text-xs text-slate-500">
              Pickups can be assigned to delivery boys. Restores stock &amp; customer limit automatically on successful pickup.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Return ID</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Product &amp; Batch</th>
                  <th className="py-3 px-3 text-center">Qty</th>
                  <th className="py-3 px-3 text-right">Value to Credit</th>
                  <th className="py-3 px-3">Pickup Boy</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No return pickup requests currently in system.
                    </td>
                  </tr>
                ) : (
                  returns.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-black text-slate-900">{r.id}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-950">{r.customerName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.customerId}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{r.productName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Batch: {r.batchNumber}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{r.quantity}</td>
                      <td className="py-3 px-3 text-right font-black text-emerald-700">₹{r.refundCreditAmount}</td>
                      <td className="py-3 px-3">
                        {r.assignedDeliveryBoyName ? (
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-amber-500" />
                            {r.assignedDeliveryBoyName}
                          </span>
                        ) : (
                          <span className="text-amber-600 italic font-semibold">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'PENDING' && (
                            <button
                              onClick={() => {
                                setAssigningReturn(r);
                                setSelectedReturnDBoyId(deliveryBoys[0]?.id || '');
                              }}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                            >
                              Assign Pickup
                            </button>
                          )}
                          {r.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveReturn(r.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer"
                              >
                                Quick Approve
                              </button>
                              <button
                                onClick={() => handleRejectReturn(r.id)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === 'COMPLETED' && (
                            <span className="text-[11px] text-emerald-700 font-bold">Closed &amp; Credited</span>
                          )}
                          {!['PENDING', 'COMPLETED', 'REJECTED'].includes(r.status) && (
                            <span className="text-[11px] text-amber-700 font-semibold italic">In Pickup Loop</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: Replacements Management & Deliveries */}
      {activeSection === 'replacements' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm">
              Replacement Requests &amp; Dispatch Dispatch Registry
            </h3>
            <p className="text-xs text-slate-500">
              Dispatches replacements to customers. Can be assigned to delivery boys for zero-credit replacement delivery.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Replacement ID</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Defective Item</th>
                  <th className="py-3 px-3 text-center">Qty</th>
                  <th className="py-3 px-3">New Batch</th>
                  <th className="py-3 px-3">Delivery Boy</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {replacements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No replacement deliveries currently in system.
                    </td>
                  </tr>
                ) : (
                  replacements.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-black text-slate-900">{rep.id}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-950">{rep.customerName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{rep.customerId}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{rep.productName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Original: {rep.originalBatchNumber}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{rep.quantity}</td>
                      <td className="py-3 px-3 font-mono font-semibold">
                        {rep.replacementBatchNumber ? `Batch #${rep.replacementBatchNumber}` : 'Pending allocation'}
                      </td>
                      <td className="py-3 px-3">
                        {rep.assignedDeliveryBoyName ? (
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-amber-500" />
                            {rep.assignedDeliveryBoyName}
                          </span>
                        ) : (
                          <span className="text-amber-600 italic font-semibold">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={rep.status} />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {rep.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveReplacement(rep)}
                                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectReplacement(rep.id)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {rep.status === 'APPROVED' && (
                            <button
                              onClick={() => {
                                setAssigningReplacement(rep);
                                setSelectedReplacementDBoyId(deliveryBoys[0]?.id || '');
                              }}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                            >
                              Assign Fleet
                            </button>
                          )}
                          {rep.status === 'COMPLETED' && (
                            <span className="text-[11px] text-emerald-700 font-bold">Successfully Delivered</span>
                          )}
                          {!['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'].includes(rep.status) && (
                            <span className="text-[11px] text-cyan-700 font-semibold italic">In Replacement Loop</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE ORDER DETAILS & TAX BILL MODAL WITH PRODUCT IMAGES */}
      {selectedOrder && (
        <AppWindowModal
          isOpen={!!selectedOrder}
          onClose={() => {
            setSelectedOrder(null);
            setSelectedImageIndex(0);
            setOrderModalView('DETAILS');
          }}
          title={`Order Ref: ${selectedOrder.id}`}
          subtitle={`Customer: ${selectedOrder.customerName} (${selectedOrder.customerMobile}) • ${selectedOrder.deliveryAddress}`}
          icon={<Package className="w-5 h-5 text-indigo-600" />}
          size="2xl"
          badge={
            <div className="flex items-center gap-2">
              {selectedOrder.orderType === 'PANTRY' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                  <CreditCard className="w-3 h-3" /> PANTRY CREDIT
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                  <Coins className="w-3 h-3" /> CASH ON DELIVERY
                </span>
              )}
              <StatusBadge status={selectedOrder.orderStatus} />
            </div>
          }
          headerActions={
            <div className="flex items-center gap-1.5 mr-2">
              <button
                onClick={async () => {
                  setOrderModalView('BILL');
                  setIsGeneratingInvoicePdf(true);
                  setTimeout(async () => {
                    try {
                      await exportElementToPdf('official-tax-invoice-content', {
                        filename: `TaxInvoice-${selectedOrder.id}.pdf`,
                        orientation: 'portrait',
                      });
                    } catch (err) {
                      console.error('Failed to export Tax Invoice PDF:', err);
                    } finally {
                      setIsGeneratingInvoicePdf(false);
                    }
                  }, 150);
                }}
                disabled={isGeneratingInvoicePdf}
                className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg transition font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Download Tax Invoice PDF"
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
                onClick={() => {
                  setOrderModalView('BILL');
                  setTimeout(() => window.print(), 100);
                }}
                className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </button>
            </div>
          }
        >
          <div className="flex flex-col h-full">
            {/* View Switcher Tabs (Details, Bill with Images, Media Gallery) */}
            <div className="flex flex-wrap items-center gap-1.5 p-3 sm:px-6 bg-slate-50 border-b border-slate-200/80 shrink-0">
                <button
                  onClick={() => setOrderModalView('DETAILS')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    orderModalView === 'DETAILS'
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Order Details &amp; Items ({selectedOrder.items.length})</span>
                </button>

                <button
                  onClick={() => setOrderModalView('BILL')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    orderModalView === 'BILL'
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Tax Invoice &amp; Detailed Bill (With Photos)</span>
                </button>

                <button
                  onClick={() => setOrderModalView('IMAGES')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    orderModalView === 'IMAGES'
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Product Photos &amp; Verification Gallery ({getOrderMediaAssets(selectedOrder).length})</span>
                </button>
              </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto text-xs flex-1">
              
              {/* ========================================================= */}
              {/* TAB 1: FULL ORDER DETAILS & ITEM TABLE WITH IMAGES */}
              {/* ========================================================= */}
              {orderModalView === 'DETAILS' && (
                <div className="space-y-6">
                  {/* BATCH ASSIGNMENT & INVENTORY LOCK STATUS CARD */}
                  <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    selectedOrder.assignmentStatus === 'ASSIGNED_AND_LOCKED'
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50/90 border-amber-300 text-amber-950'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {selectedOrder.assignmentStatus === 'ASSIGNED_AND_LOCKED' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white flex items-center gap-1 shadow-3xs">
                            <Lock className="w-3 h-3" /> ASSIGNMENT CONFIRMED &amp; LOCKED
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-600 text-white flex items-center gap-1 animate-pulse shadow-3xs">
                            <AlertTriangle className="w-3 h-3" /> PENDING BATCH ASSIGNMENT
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-500 font-bold">
                          {selectedOrder.items.length} Product Line(s)
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {selectedOrder.assignmentStatus === 'ASSIGNED_AND_LOCKED'
                          ? 'Physical batches have been assigned and locked. Warehouse stock deducted atomically. Ready for packing and dispatch.'
                          : 'Customer order placed. No inventory has been deducted yet. You must assign actual batches and confirm to lock stock.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => setAssigningProductOrder(selectedOrder)}
                        className={`px-3.5 py-2 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          selectedOrder.assignmentStatus === 'ASSIGNED_AND_LOCKED'
                            ? 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white animate-bounce'
                        }`}
                      >
                        <Package className="w-4 h-4" />
                        <span>{selectedOrder.assignmentStatus === 'ASSIGNED_AND_LOCKED' ? 'View Batch Allocation' : 'Assign Batches Now'}</span>
                      </button>

                      {selectedOrder.assignmentStatus === 'ASSIGNED_AND_LOCKED' && (
                        <>
                          <button
                            onClick={() => setPrintingCustomerBillOrder(selectedOrder)}
                            className="px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          >
                            <Receipt className="w-4 h-4" />
                            <span>Customer Bill</span>
                          </button>
                          <button
                            onClick={() => setPrintingWarehouseSlipOrder(selectedOrder)}
                            className="px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer bg-slate-800 hover:bg-slate-900 text-white shadow-xs"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Packing Slip</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* One-Way Irreversible Step Progression & Location Tracker */}
                  <OrderStepLockStepper
                    order={selectedOrder}
                    deliveryBoys={deliveryBoys}
                    onOrderUpdated={(updated) => {
                      setSelectedOrder(updated);
                      fetchData();
                    }}
                  />

                  {/* Customer & Delivery Logistics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Card */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Customer Recipient Details</span>
                        </h4>
                        <span className="font-mono text-[10px] text-slate-400 font-bold">ID: {selectedOrder.customerId}</span>
                      </div>
                      <div className="text-sm font-black text-slate-900">{selectedOrder.customerName}</div>
                      <div className="text-slate-600 font-medium flex items-center gap-2">
                        <span>Contact:</span>
                        <a
                          href={`tel:${selectedOrder.customerMobile}`}
                          className="font-mono font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3 text-indigo-500" />
                          +91 {selectedOrder.customerMobile}
                        </a>
                      </div>
                      <div className="text-slate-700 flex items-start gap-1.5 pt-1">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-800 leading-snug">{selectedOrder.deliveryAddress}</p>
                          <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> GPS Geocoded Drop Location
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Partner / Handover Card */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                          <Bike className="w-3.5 h-3.5 text-amber-500" />
                          <span>Assigned Delivery Partner</span>
                        </h4>
                        {selectedOrder.assignedDeliveryBoyId && (
                          <button
                            onClick={() => {
                              const db = deliveryBoys.find((d) => d.id === selectedOrder.assignedDeliveryBoyId);
                              if (db) {
                                setViewingDeliveryBoyWork(db);
                                setDboyWorkTab('ALL');
                                setDboyDateFilter('ALL');
                                setDboyCustomDate('');
                                setDboySearchQuery('');
                              }
                            }}
                            className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded cursor-pointer transition"
                          >
                            View Full History ↗
                          </button>
                        )}
                      </div>

                      {selectedOrder.assignedDeliveryBoyId ? (
                        <>
                          <div className="text-sm font-black text-slate-900">
                            {selectedOrder.assignedDeliveryBoyName || 'Delivery Partner'}
                          </div>
                          <div className="text-slate-600 font-medium flex items-center gap-2">
                            <span>Partner ID:</span>
                            <span className="font-mono font-bold text-slate-800">{selectedOrder.assignedDeliveryBoyId}</span>
                          </div>
                          {(() => {
                            const db = deliveryBoys.find((d) => d.id === selectedOrder.assignedDeliveryBoyId);
                            return (
                              <div className="text-[11px] text-slate-600 space-y-1">
                                {db?.mobile && (
                                  <div className="flex items-center gap-2">
                                    <span>Phone:</span>
                                    <a href={`tel:${db.mobile}`} className="font-mono font-bold text-indigo-600 hover:underline flex items-center gap-1">
                                      <Phone className="w-3 h-3" /> +91 {db.mobile}
                                    </a>
                                  </div>
                                )}
                                {db?.vehicleNumber && (
                                  <div className="text-slate-500">
                                    Vehicle: <strong className="font-mono text-slate-800">{db.vehicleType} • {db.vehicleNumber}</strong>
                                  </div>
                                )}
                                {selectedOrder.assignedAt && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Assigned At: {selectedOrder.assignedAt}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <div className="py-3 text-center bg-white rounded-lg border border-dashed border-slate-300">
                          <p className="text-slate-400 italic">No delivery partner assigned yet.</p>
                          <button
                            onClick={() => {
                              setTargetDeliveryBoyId(deliveryBoys[0]?.id || '');
                              setIsReassigning(true);
                            }}
                            className="mt-2 px-3 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-700 transition"
                          >
                            + Assign Delivery Partner
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MODULE 2: Ordered Items & Batch Allocation WITH PRODUCT IMAGES */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Ordered Items &amp; Batch Allocation</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold text-[11px]">
                          {selectedOrder.items.length} Items • Total Qty: {selectedOrder.items.reduce((sum, i) => sum + i.quantity, 0)}
                        </span>
                        <button
                          onClick={() => setOrderModalView('IMAGES')}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                        >
                          <ImageIcon className="w-3 h-3" /> View All Photos
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left">
                          <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="py-3 px-3 text-center w-16">Photo</th>
                              <th className="py-3 px-3">Product Name</th>
                              <th className="py-3 px-3">Shopkeeper (Supplier)</th>
                              <th className="py-3 px-3 text-right">MRP</th>
                              <th className="py-3 px-3">Batch Reference</th>
                              <th className="py-3 px-3 text-center">Quantity</th>
                              <th className="py-3 px-3 text-right">Unit Price</th>
                              <th className="py-3 px-3 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {selectedOrder.items.map((item, index) => {
                              const itemImg = getItemImage(item);
                              const itemBatch = batches.find((b) => b.batchNumber === item.batchNumber || b.id === item.batchId);
                              const itemProduct = products.find((p) => p.id === item.productId || (item.barcode && p.barcode === item.barcode));
                              const shopkeeperName = item.shopkeeperName || itemBatch?.shopkeeperName || 'Vendor';
                              const effectiveMrp = item.mrp || itemBatch?.mrp || itemProduct?.mrp || item.price;

                              return (
                                <tr key={index} className="hover:bg-slate-50/70 transition group">
                                  {/* Product Thumbnail with Lightbox Click */}
                                  <td className="py-2.5 px-3 text-center">
                                    <div
                                      onClick={() =>
                                        setPreviewImageModal({
                                          url: itemImg,
                                          title: item.productName,
                                          subtitle: `${item.brand ? `${item.brand} • ` : ''}Batch: #${item.batchNumber} • Qty: ${item.quantity} • ₹${item.price}`,
                                        })
                                      }
                                      className="w-13 h-13 mx-auto rounded-lg overflow-hidden border border-slate-200 bg-slate-100 relative cursor-pointer group/img shadow-2xs hover:border-indigo-500 transition"
                                      title="Click to enlarge image"
                                    >
                                      <img
                                        src={itemImg}
                                        alt={item.productName}
                                        className="w-full h-full object-cover group-hover/img:scale-105 transition duration-200"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src =
                                            'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80';
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition">
                                        <ZoomIn className="w-4 h-4 text-white drop-shadow" />
                                      </div>
                                    </div>
                                  </td>

                                  {/* Product Specs with Barcode */}
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                      <span>{item.productName}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                                      {item.brand && <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">{item.brand}</span>}
                                      {item.weightSize && <span>{item.weightSize}</span>}
                                      {(item.barcode || itemProduct?.barcode) && (
                                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                          Barcode: {item.barcode || itemProduct?.barcode}
                                        </span>
                                      )}
                                      {itemProduct?.hsn && (
                                        <span className="font-mono text-slate-400">HSN: {itemProduct.hsn}</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Shopkeeper Name (Dark & Small, without Wholesale Sourced text) */}
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                      <Store className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                                      <span>{shopkeeperName}</span>
                                    </div>
                                  </td>

                                  {/* MRP */}
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="font-black text-purple-900 text-xs font-mono">
                                      ₹{effectiveMrp}
                                    </div>
                                    <div className="text-[10px] text-slate-400">Standard MRP</div>
                                  </td>

                                  {/* Batch Reference & Dates */}
                                  <td className="py-2.5 px-3">
                                    <div className="font-mono text-indigo-700 font-bold text-xs">
                                      #{item.batchNumber || 'STANDARD-BATCH'}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      {item.expiryDate ? (
                                        <span>Exp: <strong className="text-slate-600">{item.expiryDate}</strong></span>
                                      ) : itemBatch?.expiryDate ? (
                                        <span>Exp: <strong className="text-slate-600">{itemBatch.expiryDate}</strong></span>
                                      ) : (
                                        <span>Fresh Verified</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Quantity */}
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 font-black text-xs font-mono">
                                      {item.quantity}
                                    </span>
                                  </td>

                                  {/* Unit Price */}
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="font-bold text-slate-800">₹{item.price}</div>
                                  </td>

                                  {/* Subtotal */}
                                  <td className="py-2.5 px-3 text-right font-black text-slate-950 text-xs font-mono">
                                    ₹{item.price * item.quantity}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Invoice Totals Summary */}
                      <div className="p-3.5 bg-slate-50 flex flex-wrap justify-between items-center border-t border-slate-200 gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 text-xs">Payment Method:</span>
                          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {selectedOrder.paymentMethod === 'COD'
                              ? '💵 Cash on Delivery (COD)'
                              : selectedOrder.orderType === 'PANTRY'
                              ? '💳 Pantry Revolving Credit'
                              : '💳 Online Prepaid'}
                          </span>
                          <StatusBadge status={selectedOrder.paymentStatus} />
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          {selectedOrder.deliveryFee ? (
                            <div className="text-slate-500">
                              Delivery: <strong className="text-slate-700 font-mono">₹{selectedOrder.deliveryFee}</strong>
                            </div>
                          ) : null}
                          <div className="text-slate-900 font-bold flex items-center gap-1.5">
                            <span className="text-slate-600">Total Order Amount:</span>
                            <span className="text-base text-indigo-700 font-black font-mono">₹{selectedOrder.totalAmount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MODULE 3: Quick Product Images Ribbon Preview */}
                  <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Fulfillment Product Visual Verification Assets</span>
                      </h4>
                      <span className="text-[10px] text-slate-400">Click any image to view full resolution</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      {getOrderMediaAssets(selectedOrder).map((media, idx) => (
                        <div
                          key={idx}
                          onClick={() => setPreviewImageModal({ url: media.url, title: media.title, subtitle: media.subtitle })}
                          className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white cursor-pointer hover:border-indigo-500 shadow-2xs transition"
                        >
                          <img
                            src={media.url}
                            alt={media.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition p-2 flex flex-col justify-end text-white">
                            <p className="text-[10px] font-black leading-tight truncate">{media.title}</p>
                            <p className="text-[8px] text-slate-300 truncate">{media.subtitle}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* MODULE 4: Lifecycle Tracker Visual Timeline */}
                  <div>
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-2.5">
                      Granular Delivery Lifecycle Stages
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center text-[10px]">
                      {[
                        { label: 'Confirmed', key: 'CONFIRMED', date: selectedOrder.createdAt },
                        { label: 'Shipped', key: 'SHIPPED', date: selectedOrder.shippedAt },
                        { label: 'Assigned', key: 'ASSIGNED', date: selectedOrder.assignedAt },
                        { label: 'Accepted', key: 'ACCEPTED', date: selectedOrder.acceptedAt },
                        { label: 'Out for Delivery', key: 'OUT_FOR_DELIVERY', date: selectedOrder.outForDeliveryAt },
                        { label: 'Failed', key: 'DELIVERY_FAILED', date: selectedOrder.failedAt, isFailed: true },
                        { label: 'Completed', key: 'COMPLETED', date: selectedOrder.deliveredAt },
                      ].map((step, idx) => {
                        const isPassed = !!step.date;
                        const isActive =
                          selectedOrder.orderStatus === step.key ||
                          (step.key === 'COMPLETED' && (selectedOrder.orderStatus === 'COMPLETED' || selectedOrder.orderStatus === 'DELIVERED'));
                        if (step.isFailed && selectedOrder.orderStatus !== 'DELIVERY_FAILED') return null;

                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg border transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-700 font-black shadow-sm scale-105'
                                : isPassed
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-50 text-slate-400 border-slate-100'
                            }`}
                          >
                            <div className="font-bold">{step.label}</div>
                            {step.date ? (
                              <div className="text-[8px] opacity-90 mt-1 font-mono break-all">{step.date}</div>
                            ) : (
                              <div className="text-[8px] opacity-50 mt-1 italic">Pending</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* MODULE 5: Return / Replacement / Reassignment History */}
                  {(returns.some((r) => r.orderId === selectedOrder.id) ||
                    replacements.some((rep) => rep.orderId === selectedOrder.id) ||
                    (selectedOrder.assignmentHistory && selectedOrder.assignmentHistory.length > 0)) && (
                    <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-slate-50/50">
                      <h4 className="font-black text-slate-800 uppercase tracking-wider text-[10px]">
                        Reverse Logistics &amp; Fleet Assignments
                      </h4>

                      {returns
                        .filter((r) => r.orderId === selectedOrder.id)
                        .map((r) => (
                          <div key={r.id} className="bg-amber-50 text-amber-900 p-2.5 rounded-lg border border-amber-200 text-[11px]">
                            <strong>Return Request #{r.id}:</strong> Status is <strong>{r.status}</strong> for {r.quantity} qty of {r.productName}. Refund Amount: ₹{r.refundCreditAmount}.
                          </div>
                        ))}

                      {replacements
                        .filter((rep) => rep.orderId === selectedOrder.id)
                        .map((rep) => (
                          <div key={rep.id} className="bg-emerald-50 text-emerald-900 p-2.5 rounded-lg border border-emerald-200 text-[11px]">
                            <strong>Replacement Request #{rep.id}:</strong> Status is <strong>{rep.status}</strong> for {rep.productName}.
                          </div>
                        ))}

                      {selectedOrder.assignmentHistory?.map((h, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex justify-between items-start gap-2">
                          <div>
                            Reassigned from <strong>{h.previousDeliveryBoyName}</strong> to <strong className="text-indigo-600">{h.newDeliveryBoyName}</strong>
                            <p className="text-slate-400 text-[10px]">Reason: {h.reason || 'Logistics optimization'}</p>
                          </div>
                          <span className="font-mono text-[9px] text-slate-400">{h.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: OFFICIAL TAX INVOICE & DETAILED BILL (WITH PHOTOS) */}
              {/* ========================================================= */}
              {orderModalView === 'BILL' && (
                <div id="official-tax-invoice-content" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
                  {/* Bill Header */}
                  <div className="flex flex-wrap justify-between items-start border-b border-slate-200 pb-5 gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-sm">KM</span>
                        <div>
                          <h2 className="text-lg font-black text-slate-900 tracking-tight">KISAN SUPER MART</h2>
                          <p className="text-[10px] text-slate-500 font-semibold">Quick Retail &amp; Pantry Logistics Hub</p>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-2 space-y-0.5">
                        <p>Main Road, Circular Hub, Ranchi, Jharkhand - 834001</p>
                        <p><strong>GSTIN:</strong> 20AABCK1234F1Z5 • <strong>FSSAI Lic:</strong> 10021089000123</p>
                        <p><strong>Helpline:</strong> +91 94311-00000 • <strong>Support:</strong> care@kisanmart.com</p>
                      </div>
                    </div>

                    <div className="text-right bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Retail Tax Invoice</div>
                      <div className="font-mono font-black text-slate-900 text-sm mt-0.5">INV-{selectedOrder.id}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Order Placed:{' '}
                        <strong className="text-slate-800 font-mono">
                          {formatOrderDateTime(getOrderPreciseTimestamp(selectedOrder)).full}
                        </strong>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Channel:{' '}
                        <strong className="text-indigo-600">
                          {selectedOrder.orderType === 'PANTRY' ? 'Pantry Card (Pre-approved)' : 'Quick Express Delivery'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Customer and Logistics Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="font-black text-slate-400 uppercase text-[10px] tracking-wider mb-1">Billed To / Customer Details</div>
                      <div className="font-black text-slate-900 text-sm">{selectedOrder.customerName}</div>
                      <div className="text-slate-600 mt-0.5">Customer ID: <span className="font-mono font-bold text-slate-800">{selectedOrder.customerId}</span></div>
                      <div className="text-slate-600">Mobile: <span className="font-mono font-bold text-slate-800">+91 {selectedOrder.customerMobile}</span></div>
                      <div className="text-slate-700 mt-1 leading-snug">Address: <strong>{selectedOrder.deliveryAddress}</strong></div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="font-black text-slate-400 uppercase text-[10px] tracking-wider mb-1">Dispatched &amp; Delivered By</div>
                      <div className="font-black text-slate-900 text-sm">
                        {selectedOrder.assignedDeliveryBoyName || 'Unassigned Rider'}
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        Rider ID: <span className="font-mono font-bold text-slate-800">{selectedOrder.assignedDeliveryBoyId || 'N/A'}</span>
                      </div>
                      {(() => {
                        const db = deliveryBoys.find((d) => d.id === selectedOrder.assignedDeliveryBoyId);
                        return (
                          <div className="text-slate-600 space-y-0.5">
                            {db?.mobile && <div>Mobile: <span className="font-mono font-bold">+91 {db.mobile}</span></div>}
                            {db?.vehicleNumber && <div>Vehicle: <span className="font-mono font-bold">{db.vehicleType} - {db.vehicleNumber}</span></div>}
                            <div className="text-emerald-700 font-bold text-[10px] mt-1">Status: Handover Clearance Confirmed</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Itemized Table with Product Photos */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-100 font-black text-slate-700 uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-14">Image</th>
                          <th className="py-2.5 px-3">Item Description &amp; Brand</th>
                          <th className="py-2.5 px-3">Batch &amp; HSN</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">MRP</th>
                          <th className="py-2.5 px-3 text-right">Rate</th>
                          <th className="py-2.5 px-3 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedOrder.items.map((it, idx) => {
                          const itImg = getItemImage(it);
                          const itProd = products.find((p) => p.id === it.productId || (it.barcode && p.barcode === it.barcode));
                          return (
                            <tr key={idx} className="hover:bg-slate-50/60">
                              <td className="py-2 px-3 text-center">
                                <img
                                  src={itImg}
                                  alt={it.productName}
                                  className="w-10 h-10 object-cover rounded-md border border-slate-200 mx-auto bg-slate-50"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&q=80';
                                  }}
                                />
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-bold text-slate-900">{it.productName}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  {it.brand && <span className="font-semibold">{it.brand}</span>}
                                  {it.weightSize && <span>• {it.weightSize}</span>}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-mono text-indigo-700 text-[11px]">#{it.batchNumber || 'N/A'}</div>
                                <div className="text-[9px] text-slate-400 font-mono">HSN: {itProd?.hsn || '1901'}</div>
                              </td>
                              <td className="py-2 px-3 text-center font-bold text-slate-900">{it.quantity}</td>
                              <td className="py-2 px-3 text-right text-slate-400 text-[11px]">₹{it.mrp || it.price}</td>
                              <td className="py-2 px-3 text-right font-semibold text-slate-800">₹{it.price}</td>
                              <td className="py-2 px-3 text-right font-black text-slate-950 font-mono">₹{it.price * it.quantity}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Breakdown & Tax Stamp */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    {/* Payment Stamp & Auth */}
                    <div className="border border-dashed border-slate-300 p-4 rounded-xl space-y-2 bg-slate-50/50">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Payment &amp; Settlement Receipt</div>
                      {selectedOrder.orderType === 'PANTRY' ? (
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-900">
                          <div className="font-black text-xs flex items-center gap-1">
                            <Check className="w-4 h-4 text-purple-700" />
                            PAID VIA PANTRY REVOLVING CREDIT
                          </div>
                          <p className="text-[10px] text-purple-700 mt-1">
                            Amount debited from Customer pre-approved credit balance. Zero cash collected at door.
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                          <div className="font-black text-xs flex items-center gap-1">
                            <Coins className="w-4 h-4 text-amber-700" />
                            CASH ON DELIVERY (COD): ₹{selectedOrder.totalAmount}
                          </div>
                          <p className="text-[10px] text-amber-700 mt-1">
                            Delivery Boy Handover: {selectedOrder.paymentStatus === 'COD_COLLECTED' || selectedOrder.paymentStatus === 'PAID' ? 'CASH COLLECTED & DEPOSITED' : 'TO BE COLLECTED FROM CUSTOMER'}
                          </p>
                        </div>
                      )}
                      <div className="text-[9px] text-slate-400 italic">
                        This is a computer-generated tax invoice. No signature required.
                      </div>
                    </div>

                    {/* Tax & Total Summary */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-mono font-bold text-slate-800">₹{selectedOrder.subtotal || selectedOrder.totalAmount}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Delivery &amp; Logistics Surcharge:</span>
                        <span className="font-mono font-bold text-slate-800">₹{selectedOrder.deliveryFee || 0}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Applicable GST (CGST 2.5% + SGST 2.5%):</span>
                        <span className="font-mono font-semibold text-slate-700">Included</span>
                      </div>
                      <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-sm">
                        <span className="font-black text-slate-900">Grand Total Invoice Sum:</span>
                        <span className="font-mono font-black text-indigo-700 text-lg">₹{selectedOrder.totalAmount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Print / Export Action buttons */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 print:hidden">
                    <button
                      onClick={async () => {
                        setIsGeneratingInvoicePdf(true);
                        try {
                          await exportElementToPdf('official-tax-invoice-content', {
                            filename: `TaxInvoice-${selectedOrder.id}.pdf`,
                            orientation: 'portrait',
                          });
                        } catch (err) {
                          console.error('Failed to export Tax Invoice PDF:', err);
                        } finally {
                          setIsGeneratingInvoicePdf(false);
                        }
                      }}
                      disabled={isGeneratingInvoicePdf}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-2 cursor-pointer"
                      title="Download Tax Invoice as crisp PDF file"
                    >
                      {isGeneratingInvoicePdf ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download PDF Invoice</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Official Bill Copy</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 3: FULL PRODUCT MEDIA & VERIFICATION GALLERY */}
              {/* ========================================================= */}
              {orderModalView === 'IMAGES' && (
                <div className="space-y-6">
                  {/* Hero Image Showcase */}
                  <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">High-Resolution Fulfillment Media</h4>
                        <p className="text-[11px] text-slate-500">Warehouse batch photographs and catalog visual assets for cargo verification</p>
                      </div>
                      <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
                        Asset Frame #{selectedImageIndex + 1} of {getOrderMediaAssets(selectedOrder).length}
                      </span>
                    </div>

                    {(() => {
                      const allAssets = getOrderMediaAssets(selectedOrder);
                      const currentAsset = allAssets[selectedImageIndex] || allAssets[0];

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Large Canvas */}
                          <div className="md:col-span-2 aspect-video bg-slate-900 rounded-xl overflow-hidden relative shadow-inner group">
                            <img
                              src={currentAsset.url}
                              alt={currentAsset.title}
                              className="w-full h-full object-contain transition duration-300"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
                              }}
                            />
                            <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-xs text-white p-2.5 rounded-lg flex items-center justify-between">
                              <div>
                                <p className="font-bold text-xs">{currentAsset.title}</p>
                                <p className="text-[10px] text-slate-300">{currentAsset.subtitle}</p>
                              </div>
                              <button
                                onClick={() => setPreviewImageModal({ url: currentAsset.url, title: currentAsset.title, subtitle: currentAsset.subtitle })}
                                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white transition cursor-pointer"
                                title="Enlarge full screen"
                              >
                                <ZoomIn className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Thumbnails list */}
                          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Order Items Gallery</div>
                            <div className="grid grid-cols-2 gap-2">
                              {allAssets.map((asset, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedImageIndex(idx)}
                                  className={`aspect-square rounded-xl overflow-hidden border transition relative cursor-pointer text-left ${
                                    selectedImageIndex === idx
                                      ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                                      : 'border-slate-200 hover:border-slate-400 bg-white'
                                  }`}
                                >
                                  <img
                                    src={asset.url}
                                    alt={asset.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src =
                                        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80';
                                    }}
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[8px] text-white font-bold truncate">
                                    {asset.title}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* MODULE 6: Order-Specific System Modification & Override Audit Logs */}
              <div className="bg-slate-100/40 p-4 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-700 uppercase tracking-wider text-[10px]">Order State Audit &amp; Override Trail</h4>
                  <span className="text-[10px] font-mono bg-white text-slate-500 px-1.5 py-0.2 rounded border border-slate-200">
                    {auditLogs.filter((l) => l.entityId === selectedOrder.id).length} actions recorded
                  </span>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {auditLogs.filter((l) => l.entityId === selectedOrder.id).length === 0 ? (
                    <p className="text-slate-400 italic text-center py-2 text-[11px]">No modification logs exist for this order.</p>
                  ) : (
                    auditLogs
                      .filter((l) => l.entityId === selectedOrder.id)
                      .map((log) => (
                        <div key={log.id} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-1">
                          <div className="flex justify-between items-center text-slate-800">
                            <span className="font-bold">{log.action}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{log.timestamp}</span>
                          </div>
                          {log.oldValue && log.newValue && (
                            <p className="text-slate-500 text-[10px]">
                              Status Correction: <span className="font-semibold text-slate-600">{log.oldValue}</span> →{' '}
                              <span className="font-semibold text-slate-800">{log.newValue}</span>
                            </p>
                          )}
                          {log.reason && (
                            <p className="text-rose-600 font-medium italic text-[10px] bg-rose-50/50 px-1.5 py-0.5 rounded border border-rose-100">
                              "Override Reason: {log.reason}"
                            </p>
                          )}
                          <div className="text-[9px] text-slate-400 font-semibold flex items-center gap-1 mt-1">
                            <span>Actor:</span>
                            <span className="text-slate-600 font-bold">{log.who}</span>
                            <span>({log.role})</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* ACTION DIALOGS / BUTTONS IN DETAIL SHEET */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Operation Commands:</span>
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => {
                        setOverrideOrderId(selectedOrder.id);
                        setOverrideStatus(selectedOrder.orderStatus);
                        setOverrideReason('');
                        setIsOverrideModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Admin Override Status</span>
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  {(selectedOrder.orderStatus === 'CONFIRMED' || selectedOrder.orderStatus === 'PENDING') && (
                    <button
                      onClick={() => handleShipOrder(selectedOrder.id)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg text-xs shadow-3xs transition cursor-pointer"
                    >
                      Ship Order
                    </button>
                  )}

                  {(selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERY_FAILED' || selectedOrder.orderStatus === 'ASSIGNED') && (
                    <button
                      onClick={() => {
                        setTargetDeliveryBoyId(deliveryBoys[0]?.id || '');
                        setIsReassigning(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs shadow-3xs transition cursor-pointer"
                    >
                      {selectedOrder.assignedDeliveryBoyId ? 'Reassign Delivery Boy' : 'Assign Delivery Boy'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </AppWindowModal>
      )}

      {/* REASSIGNMENT FORM MODAL (Rule 10 & 11) */}
      {isReassigning && selectedOrder && (
        <AppWindowModal
          isOpen={isReassigning}
          onClose={() => {
            setIsReassigning(false);
            setReassignReason('');
            setTargetDeliveryBoyId('');
          }}
          title="Fleet Assignment"
          subtitle={`Order: ${selectedOrder.id} (${selectedOrder.customerName})`}
          icon={<Truck className="w-5 h-5 text-indigo-600" />}
          size="md"
        >
          <form onSubmit={handleReassignDelivery} className="p-6 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Delivery Boy</label>
                <select
                  value={targetDeliveryBoyId}
                  onChange={(e) => setTargetDeliveryBoyId(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-bold text-slate-800"
                  required
                >
                  <option value="">-- Choose Delivery Personnel --</option>
                  {deliveryBoys.map((db) => {
                    const stats = getDeliveryBoyStats(db.id);
                    return (
                      <option key={db.id} value={db.id} disabled={db.status !== 'ACTIVE'}>
                        {db.fullName} ({db.assignedArea}) [{db.status}] • Active: {stats.activeCount} | Done: {stats.completedCount}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Reason is MANDATORY if reassignment (Rule 10 & 11) */}
              {selectedOrder.assignedDeliveryBoyId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reassignment Reason <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Previous boy vehicle breakdown / out of coverage"
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsReassigning(false);
                  setReassignReason('');
                  setTargetDeliveryBoyId('');
                }}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer"
              >
                Confirm Assignment
              </button>
            </div>
          </form>
        </AppWindowModal>
      )}

      {/* Assign Delivery Boy Modal for orders row */}
      {assigningOrder && (
        <AppWindowModal
          isOpen={!!assigningOrder}
          onClose={() => setAssigningOrder(null)}
          title="Assign Delivery Personnel"
          subtitle={`Order: ${assigningOrder.id} (${assigningOrder.customerName})`}
          icon={<Truck className="w-5 h-5 text-indigo-600" />}
          size="md"
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Delivery Boy
              </label>
              <select
                value={selectedDeliveryBoyId}
                onChange={(e) => setSelectedDeliveryBoyId(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-semibold text-slate-700"
              >
                <option value="">-- Choose Delivery Boy --</option>
                {deliveryBoys.map((db) => {
                  const stats = getDeliveryBoyStats(db.id);
                  return (
                    <option key={db.id} value={db.id}>
                      {db.fullName} ({db.assignedArea}) • Active Tasks: {stats.activeCount} | Completed Today: {stats.completedCount}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-100">
              <div><strong>Address:</strong> {assigningOrder.deliveryAddress}</div>
              <div><strong>Type:</strong> {assigningOrder.orderType} Order</div>
              <div><strong>Bill Total:</strong> ₹{assigningOrder.totalAmount}</div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setAssigningOrder(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignDelivery}
                disabled={!selectedDeliveryBoyId}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </AppWindowModal>
      )}

      {/* Assign Return Pickup Modal */}
      {assigningReturn && (
        <AppWindowModal
          isOpen={!!assigningReturn}
          onClose={() => setAssigningReturn(null)}
          title="Assign Return Pickup Dispatch"
          subtitle={`Return Request: ${assigningReturn.id} (${assigningReturn.customerName})`}
          icon={<RotateCcw className="w-5 h-5 text-amber-600" />}
          size="md"
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Delivery Boy</label>
              <select
                value={selectedReturnDBoyId}
                onChange={(e) => setSelectedReturnDBoyId(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-semibold text-slate-700"
              >
                <option value="">-- Choose Delivery Boy --</option>
                {deliveryBoys.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.fullName} ({db.assignedArea})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setAssigningReturn(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignReturnDBoy}
                disabled={!selectedReturnDBoyId}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
              >
                Confirm Pickup Assignment
              </button>
            </div>
          </div>
        </AppWindowModal>
      )}

      {/* Assign Replacement Delivery Modal */}
      {assigningReplacement && (
        <AppWindowModal
          isOpen={!!assigningReplacement}
          onClose={() => setAssigningReplacement(null)}
          title="Assign Replacement Delivery Boy"
          subtitle={`Replacement Request: ${assigningReplacement.id} (${assigningReplacement.customerName})`}
          icon={<RefreshCw className="w-5 h-5 text-emerald-600" />}
          size="md"
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Delivery Boy</label>
              <select
                value={selectedReplacementDBoyId}
                onChange={(e) => setSelectedReplacementDBoyId(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-semibold text-slate-700"
              >
                <option value="">-- Choose Delivery Boy --</option>
                {deliveryBoys.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.fullName} ({db.assignedArea})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setAssigningReplacement(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignReplacementDBoy}
                disabled={!selectedReplacementDBoyId}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
              >
                Confirm Replacement Delivery
              </button>
            </div>
          </div>
        </AppWindowModal>
      )}

      {/* New Delivery Boy Modal with ALL 15 REQUIRED FIELDS (Rule 3) */}
      {isNewDeliveryBoyOpen && (
        <AppWindowModal
          isOpen={isNewDeliveryBoyOpen}
          onClose={() => setIsNewDeliveryBoyOpen(false)}
          title="Register New Logistics Delivery Boy Master"
          subtitle="Generates automatic Delivery Boy ID starting with DB- (e.g. DB-000001)"
          icon={<Truck className="w-5 h-5 text-amber-500" />}
          size="xl"
        >
          <div className="p-6">
            <form onSubmit={handleCreateDeliveryBoy} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* ID placeholder */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Delivery Boy ID
                  </label>
                  <input
                    type="text"
                    value="Automatic Generated (e.g. DB-000001)"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 text-slate-400 rounded-lg cursor-not-allowed font-semibold"
                    disabled
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Roster Status
                  </label>
                  <select
                    value={newDBoyData.status}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, status: e.target.value as any })}
                    className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-bold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Yadav"
                    value={newDBoyData.fullName}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    required
                  />
                </div>

                {/* Mobile */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Mobile Number (Primary / Unique Login ID) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">{newDBoyData.mobile.length}/10</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9835012345"
                    value={newDBoyData.mobile}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, mobile: e.target.value.replace(/\D/g, '') })}
                    className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:outline-none font-mono font-bold ${
                      newDBoyMobileStatus.available === false
                        ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/40 text-rose-900'
                        : newDBoyMobileStatus.available === true
                        ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/40 text-emerald-900'
                        : 'border-slate-300 focus:ring-indigo-500 text-slate-800'
                    }`}
                    required
                  />
                  {newDBoyMobileStatus.checking && (
                    <p className="text-[10px] text-indigo-600 mt-1 flex items-center gap-1 font-medium">
                      <span className="inline-block w-2 h-2 rounded-full border border-indigo-600 border-t-transparent animate-spin"></span>
                      Checking mobile uniqueness...
                    </p>
                  )}
                  {newDBoyMobileStatus.available === true && (
                    <p className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      Unique Mobile: Available across entire database
                    </p>
                  )}
                  {newDBoyMobileStatus.available === false && (
                    <p className="text-[10px] text-rose-600 font-medium mt-1 leading-tight flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                      <span>{newDBoyMobileStatus.error}</span>
                    </p>
                  )}
                </div>

                {/* Alternate Mobile */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Alternate Contact
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Optional backup number"
                    value={newDBoyData.alternateContact}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, alternateContact: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>

                {/* Emergency Contact */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Emergency Contact Name/Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Spouse / Parent Contact details"
                    value={newDBoyData.emergencyContact}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, emergencyContact: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  />
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={newDBoyData.vehicleType}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, vehicleType: e.target.value as any })}
                    className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-slate-700"
                  >
                    <option value="BIKE">Motorcycle / Bike</option>
                    <option value="SCOOTER">Scooter / Scooty</option>
                    <option value="VAN">Delivery Van / Auto</option>
                    <option value="CYCLE">Cycle</option>
                  </select>
                </div>

                {/* Vehicle Number */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JH-01-AB-9876"
                    value={newDBoyData.vehicleNumber}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-slate-800"
                  />
                </div>

                {/* Assigned Area */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Assigned Delivery Coverage Area
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lalpur, Ranchi"
                    value={newDBoyData.assignedArea}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, assignedArea: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  />
                </div>

                {/* Joining Date */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={newDBoyData.joiningDate}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  />
                </div>

                {/* Profile image URL */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Profile Photo URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/photos/rajesh.jpg"
                    value={newDBoyData.profilePhoto}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, profilePhoto: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>

                {/* Address */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Full Local Residential Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="House No, Street, Landmark, Ranchi"
                    value={newDBoyData.address}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, address: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  />
                </div>

                {/* Notes */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Internal HR / Logistics Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Police verification done / previous experience notes"
                    value={newDBoyData.notes}
                    onChange={(e) => setNewDBoyData({ ...newDBoyData, notes: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewDeliveryBoyOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newDBoyMobileStatus.checking || newDBoyMobileStatus.available === false || newDBoyData.mobile.length !== 10}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition ${
                    newDBoyMobileStatus.checking || newDBoyMobileStatus.available === false || newDBoyData.mobile.length !== 10
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
                  }`}
                >
                  {newDBoyMobileStatus.checking ? 'Checking Mobile...' : 'Save Delivery Boy Master'}
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* ADMIN OVERRIDE STATUS FORM MODAL */}
      {isOverrideModalOpen && (
        <AppWindowModal
          isOpen={isOverrideModalOpen}
          onClose={() => {
            setIsOverrideModalOpen(false);
            setOverrideReason('');
          }}
          title="Authorized Admin Force Override"
          subtitle="Manual database intervention to force-correct the lifecycle state of this order."
          icon={<Shield className="w-5 h-5 text-rose-600" />}
          size="md"
        >
          <form onSubmit={handleAdminOverrideSubmit} className="p-6 space-y-4">
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-xs text-rose-800">
              This action will be permanently recorded in the immutable audit trail.
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Order ID display */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Target Order ID
                </label>
                <input
                  type="text"
                  value={overrideOrderId}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-600 rounded-lg cursor-not-allowed font-mono font-bold"
                  disabled
                />
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Target Override Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white font-bold text-slate-800"
                  required
                >
                  <option value="" disabled>-- Select Override Status --</option>
                  <option value="PENDING">PENDING</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="SHIPPED">SHIPPED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="DELIVERY_FAILED">DELIVERY_FAILED</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>

              {/* Justification Reason Textarea */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Auditor Justification &amp; Override Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Customer requested urgent batch exchange / Manual override due to fleet malfunction..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none font-medium placeholder:text-slate-400"
                  required
                  minLength={5}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsOverrideModalOpen(false);
                  setOverrideReason('');
                }}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancel Intervention
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-black text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition cursor-pointer"
              >
                💾 Save Force Correction
              </button>
            </div>
          </form>
        </AppWindowModal>
      )}

      {/* REGISTER NEW FIELD AUDITOR MODAL */}
      {isNewAuditorOpen && (
        <AppWindowModal
          isOpen={isNewAuditorOpen}
          onClose={() => setIsNewAuditorOpen(false)}
          title="Register New Field Auditor"
          subtitle="Create auditor master record and assign household customers for physical inspection."
          icon={<ClipboardCheck className="w-5 h-5 text-cyan-700" />}
          size="xl"
        >
          <form onSubmit={handleCreateAuditor} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Auditor Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vikas Kumar Sahu"
                    value={newAuditorData.fullName}
                    onChange={(e) => setNewAuditorData({ ...newAuditorData, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none font-bold"
                    required
                  />
                </div>

                {/* Mobile */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Mobile Number (Login ID) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">{newAuditorData.mobile.length}/10</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    maxLength={10}
                    value={newAuditorData.mobile}
                    onChange={(e) => setNewAuditorData({ ...newAuditorData, mobile: e.target.value.replace(/\D/g, '') })}
                    className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:outline-none font-mono font-bold ${
                      newAuditorMobileStatus.available === false
                        ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/40 text-rose-900'
                        : newAuditorMobileStatus.available === true
                        ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/40 text-emerald-900'
                        : 'border-slate-300 focus:ring-cyan-500'
                    }`}
                    required
                  />
                  {newAuditorMobileStatus.checking && (
                    <p className="text-[10px] text-cyan-700 mt-1 flex items-center gap-1 font-medium">
                      <span className="inline-block w-2 h-2 rounded-full border border-cyan-700 border-t-transparent animate-spin"></span>
                      Checking mobile uniqueness...
                    </p>
                  )}
                  {newAuditorMobileStatus.available === true && (
                    <p className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      Unique Mobile: Available across entire database
                    </p>
                  )}
                  {newAuditorMobileStatus.available === false && (
                    <p className="text-[10px] text-rose-600 font-medium mt-1 leading-tight flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                      <span>{newAuditorMobileStatus.error}</span>
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    placeholder="vikas.auditor@ranchipantry.com"
                    value={newAuditorData.email}
                    onChange={(e) => setNewAuditorData({ ...newAuditorData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Assigned Zone */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Assigned Coverage Zone
                  </label>
                  <select
                    value={newAuditorData.assignedZone}
                    onChange={(e) => setNewAuditorData({ ...newAuditorData, assignedZone: e.target.value })}
                    className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none bg-white font-medium text-slate-700"
                  >
                    <option value="Central Ranchi (Zone A)">Central Ranchi (Zone A)</option>
                    <option value="Ranchi North (Kanke / Morabadi)">Ranchi North (Kanke / Morabadi)</option>
                    <option value="Ranchi South (Doranda / Hinoo)">Ranchi South (Doranda / Hinoo)</option>
                    <option value="Ranchi East (Namkum / Tatisilwai)">Ranchi East (Namkum / Tatisilwai)</option>
                    <option value="Ranchi West (Ratu / Kathal More)">Ranchi West (Ratu / Kathal More)</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Auditor Initial Status
                  </label>
                  <select
                    value={newAuditorData.status}
                    onChange={(e) => setNewAuditorData({ ...newAuditorData, status: e.target.value as any })}
                    className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none bg-white font-bold text-slate-700"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized)</option>
                    <option value="INACTIVE">INACTIVE (Deactivated)</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Internal HR / Area Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Senior Auditor, certified for FMCG weights inspection"
                    value={newAuditorData.notes}
                    onChange={(e) => setNewAuditorData({ ...newAuditorData, notes: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* ASSIGN CUSTOMERS TO AUDITOR */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-cyan-800">
                    Assign Households to this Auditor ({newAuditorData.assignedCustomerIds.length} Selected)
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setNewAuditorData({
                          ...newAuditorData,
                          assignedCustomerIds: customers.map((c) => c.id),
                        })
                      }
                      className="text-cyan-700 hover:underline text-[11px] font-bold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewAuditorData({
                          ...newAuditorData,
                          assignedCustomerIds: [],
                        })
                      }
                      className="text-slate-500 hover:underline text-[11px] font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search household by name, address, or customer ID..."
                    value={newAuditorCustomerSearch}
                    onChange={(e) => setNewAuditorCustomerSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                  {customers
                    .filter((c) => {
                      if (!newAuditorCustomerSearch.trim()) return true;
                      const q = newAuditorCustomerSearch.toLowerCase();
                      return (
                        c.fullName.toLowerCase().includes(q) ||
                        c.mobile.includes(q) ||
                        c.id.toLowerCase().includes(q) ||
                        c.address?.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => {
                      const isSelected = newAuditorData.assignedCustomerIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleToggleNewAuditorCustomerSelection(c.id)}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition text-xs ${
                            isSelected ? 'bg-cyan-50/80 font-bold text-cyan-950' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-700 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 shrink-0" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-900">{c.fullName}</span>
                                <span className="font-mono text-[10px] text-cyan-700 bg-white px-1.5 py-0.2 rounded border border-cyan-200">
                                  {c.id}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {c.address}, {c.city} • +91 {c.mobile}
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-[10px] font-mono text-purple-700">
                            Limit: ₹{c.pantryLimit}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewAuditorOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newAuditorMobileStatus.checking || newAuditorMobileStatus.available === false || newAuditorData.mobile.length !== 10}
                  className={`px-5 py-2 text-xs font-black text-white rounded-lg shadow-sm transition flex items-center gap-1.5 ${
                    newAuditorMobileStatus.checking || newAuditorMobileStatus.available === false || newAuditorData.mobile.length !== 10
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-cyan-700 hover:bg-cyan-800 cursor-pointer'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{newAuditorMobileStatus.checking ? 'Checking Mobile...' : 'Save Field Auditor'}</span>
                </button>
              </div>
            </form>
        </AppWindowModal>
      )}

      {/* ASSIGN CUSTOMERS TO AUDITOR MODAL */}
      {assigningAuditor && (
        <AppWindowModal
          isOpen={!!assigningAuditor}
          onClose={() => setAssigningAuditor(null)}
          title={`Assign Customers to ${assigningAuditor.fullName}`}
          subtitle={`Auditor ID: ${assigningAuditor.id} • Coverage Zone: ${assigningAuditor.assignedZone}`}
          icon={<Users className="w-5 h-5 text-cyan-700" />}
          size="xl"
          badge={
            <span className="px-2.5 py-0.5 bg-cyan-700 text-white rounded-full text-xs font-black">
              {selectedAssignedCustomerIds.length} Assigned
            </span>
          }
        >
          <div className="p-6 space-y-4 text-xs">
            <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-100 text-xs text-cyan-900 flex items-center justify-between">
                <div>
                  <span className="font-bold">Auditor Zone:</span> {assigningAuditor.assignedZone} •{' '}
                  <span className="font-bold">Status:</span> {assigningAuditor.status}
                </div>
                <span className="px-2.5 py-1 bg-cyan-700 text-white rounded-lg text-xs font-black">
                  {selectedAssignedCustomerIds.length} Assigned
                </span>
              </div>

              {/* Search & Bulk Select */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search household by Name, Mobile, Address, ID..."
                    value={assignCustomerSearchQuery}
                    onChange={(e) => setAssignCustomerSearchQuery(e.target.value)}
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

              {/* Customer Checklist */}
              <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto divide-y divide-slate-100 bg-white shadow-2xs">
                {customers
                  .filter((c) => {
                    if (!assignCustomerSearchQuery.trim()) return true;
                    const q = assignCustomerSearchQuery.toLowerCase();
                    return (
                      c.fullName.toLowerCase().includes(q) ||
                      c.mobile.includes(q) ||
                      c.id.toLowerCase().includes(q) ||
                      c.address?.toLowerCase().includes(q)
                    );
                  })
                  .map((c) => {
                    const isSelected = selectedAssignedCustomerIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleToggleCustomerSelection(c.id)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition text-xs ${
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
                Auditor will only see the selected households in their Auditor Portal.
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

      {/* AUDITOR FULL WORK ACTIVITY & TIMESTAMPS LOG MODAL */}
      {viewingAuditorWork && (
        <AppWindowModal
          isOpen={!!viewingAuditorWork}
          onClose={() => setViewingAuditorWork(null)}
          title={`Audit History: ${viewingAuditorWork.fullName} (${viewingAuditorWork.id})`}
          subtitle={`Coverage: ${viewingAuditorWork.assignedZone} • Mobile: +91 ${viewingAuditorWork.mobile}`}
          icon={<Activity className="w-5 h-5 text-cyan-700" />}
          size="2xl"
          badge={
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                viewingAuditorWork.status === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-800 border-emerald-400/30'
                  : 'bg-rose-500/20 text-rose-800 border-rose-400/30'
              }`}
            >
              {viewingAuditorWork.status}
            </span>
          }
        >
          <div className="p-6 space-y-5 text-xs">
              {/* Summary KPIs for this Auditor */}
              {(() => {
                const auditsThisAuditor = auditorChecks.filter((c) => c.auditorId === viewingAuditorWork.id);
                const totalInspected = auditsThisAuditor.reduce((acc, c) => acc + (c.totalItemsCount || 0), 0);
                const totalMissing = auditsThisAuditor.reduce((acc, c) => acc + (c.notAvailableCount || 0), 0);
                const totalDeductions = auditsThisAuditor.reduce((acc, c) => acc + (c.totalWalletDeduction || 0), 0);

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-cyan-50 rounded-xl border border-cyan-100">
                      <div className="text-[10px] font-bold text-cyan-700 uppercase">Total Audits Done</div>
                      <div className="text-xl font-black text-cyan-950 mt-0.5">{auditsThisAuditor.length}</div>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Products Verified</div>
                      <div className="text-xl font-black text-slate-900 mt-0.5">{totalInspected} items</div>
                    </div>
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="text-[10px] font-bold text-amber-700 uppercase">Missing / Discrepancies</div>
                      <div className="text-xl font-black text-amber-900 mt-0.5">{totalMissing} items</div>
                    </div>
                    <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100">
                      <div className="text-[10px] font-bold text-rose-700 uppercase">Wallet Deductions</div>
                      <div className="text-xl font-black text-rose-900 mt-0.5 font-mono">₹{totalDeductions}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Audits Table with Full Timestamps & Product Check Counts */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                    All Conducted Household Audits &amp; Inspections
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Timestamp precision with itemized inspection details
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Audit ID &amp; Timestamps</th>
                        <th className="py-2.5 px-3">Customer Household</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Inspected</th>
                        <th className="py-2.5 px-3 text-center text-emerald-700">Available</th>
                        <th className="py-2.5 px-3 text-center text-amber-700">Missing</th>
                        <th className="py-2.5 px-3 text-right">Wallet Impact</th>
                        <th className="py-2.5 px-3 text-right">Audit Bill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditorChecks.filter((c) => c.auditorId === viewingAuditorWork.id).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400">
                            No physical field audits completed by this auditor yet.
                          </td>
                        </tr>
                      ) : (
                        auditorChecks
                          .filter((c) => c.auditorId === viewingAuditorWork.id)
                          .map((chk) => (
                            <tr key={chk.id} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                                  <span>{chk.id}</span>
                                  {chk.billId && (
                                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200">
                                      {chk.billId}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-700 flex items-center gap-1 mt-1 font-semibold">
                                  <Calendar className="w-3 h-3 text-cyan-600" />
                                  <span>Date: {chk.visitDate || chk.requestedDate || 'N/A'}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>Time: {chk.visitTime || (chk.startedAt ? chk.startedAt.split(' ')[1] : chk.requestedTime) || '11:00 AM'}</span>
                                </div>
                                {chk.completedAt && (
                                  <div className="text-[9px] text-emerald-700 flex items-center gap-1">
                                    <span>✓ Completed: {chk.completedAt.split(' ')[1] || chk.completedAt} ({chk.durationFormatted || `${chk.durationMinutes || 24}m`})</span>
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900">{chk.customerName}</div>
                                <div className="text-[10px] font-mono text-slate-400">{chk.customerId}</div>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <StatusBadge status={chk.status as any} />
                              </td>

                              <td className="py-3 px-3 text-center font-bold text-slate-800">
                                {chk.totalItemsCount || (chk.itemsChecked?.length || 0)} items
                              </td>

                              <td className="py-3 px-3 text-center font-bold text-emerald-700">
                                {chk.availableCount ?? chk.itemsChecked?.filter((i) => i.verificationStatus === 'AVAILABLE').length ?? 0}
                              </td>

                              <td className="py-3 px-3 text-center font-bold text-amber-700">
                                {chk.notAvailableCount ?? chk.itemsChecked?.filter((i) => i.verificationStatus === 'NOT_AVAILABLE' || (i as any).verificationStatus === 'MISSING').length ?? 0}
                              </td>

                              <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                                ₹{chk.totalWalletDeduction || 0}
                              </td>

                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => setSelectedAuditBill(chk)}
                                  className="px-2.5 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-bold transition shadow-2xs inline-flex items-center gap-1 cursor-pointer"
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

      {/* FULL ITEMIZED AUDIT BILL MODAL */}
      {selectedAuditBill && (
        <AuditBillModal
          audit={selectedAuditBill}
          onClose={() => setSelectedAuditBill(null)}
          isAdminView={true}
        />
      )}

      {/* DELIVERY PARTNER 360 WORK LOG & FULL DELIVERY HISTORY MODAL */}
      {viewingDeliveryBoyWork && (() => {
        // Calculate rider specific datasets
        const rawRiderOrders = orders.filter(
          (o) =>
            o.assignedDeliveryBoyId === viewingDeliveryBoyWork.id ||
            o.assignmentHistory?.some((h) => h.newDeliveryBoyId === viewingDeliveryBoyWork.id)
        );

        const riderReturns = returns.filter((r) => r.assignedDeliveryBoyId === viewingDeliveryBoyWork.id);
        const riderReplacements = replacements.filter((rep) => rep.assignedDeliveryBoyId === viewingDeliveryBoyWork.id);

        // Date Filter Helper
        const matchesDateFilter = (order: Order) => {
          if (dboyDateFilter === 'ALL') return true;

          // Prefer deliveredAt for completed, else outForDeliveryAt or assignedAt or createdAt
          const targetDateStr =
            order.deliveredAt ||
            order.outForDeliveryAt ||
            order.assignedAt ||
            order.createdAt ||
            order.updatedAt;

          const dateObj = parseFormattedDate(targetDateStr);
          if (!dateObj) return true;

          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, -1);
          const startOfLast7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          if (dboyDateFilter === 'TODAY') {
            return dateObj >= startOfToday;
          }
          if (dboyDateFilter === 'YESTERDAY') {
            return dateObj >= startOfYesterday && dateObj <= endOfYesterday;
          }
          if (dboyDateFilter === 'WEEK') {
            return dateObj >= startOfLast7;
          }
          if (dboyDateFilter === 'MONTH') {
            return dateObj >= startOfMonth;
          }
          if (dboyDateFilter === 'CUSTOM' && dboyCustomDate) {
            const customD = new Date(dboyCustomDate);
            return (
              dateObj.getFullYear() === customD.getFullYear() &&
              dateObj.getMonth() === customD.getMonth() &&
              dateObj.getDate() === customD.getDate()
            );
          }
          return true;
        };

        // Filter by Date
        const dateFilteredOrders = rawRiderOrders.filter(matchesDateFilter);

        // Search Filter
        const searchFilteredOrders = dateFilteredOrders.filter((o) => {
          if (!dboySearchQuery) return true;
          const query = dboySearchQuery.toLowerCase();
          return (
            o.id.toLowerCase().includes(query) ||
            o.customerName.toLowerCase().includes(query) ||
            o.customerId.toLowerCase().includes(query) ||
            o.customerMobile.includes(query) ||
            o.deliveryAddress.toLowerCase().includes(query) ||
            o.items.some((i) => i.productName.toLowerCase().includes(query))
          );
        });

        // Tab Filtered Orders
        const displayOrders = searchFilteredOrders.filter((o) => {
          if (dboyWorkTab === 'ALL') return true;
          if (dboyWorkTab === 'PENDING') {
            return ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'READY_TO_SHIP'].includes(o.orderStatus);
          }
          if (dboyWorkTab === 'DELIVERED') {
            return o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED';
          }
          if (dboyWorkTab === 'FAILED') {
            return o.orderStatus === 'DELIVERY_FAILED' || o.orderStatus === 'CANCELLED';
          }
          return true;
        });

        // Computed Stats for this rider
        const totalPendingCount = rawRiderOrders.filter((o) =>
          ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)
        ).length;
        const totalDeliveredCount = rawRiderOrders.filter(
          (o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED'
        ).length;
        const totalFailedCount = rawRiderOrders.filter(
          (o) => o.orderStatus === 'DELIVERY_FAILED' || o.orderStatus === 'CANCELLED'
        ).length;
        const totalCodCollected = rawRiderOrders
          .filter((o) => (o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED') && (o.paymentMethod === 'COD' || o.codAmount > 0))
          .reduce((sum, o) => sum + (o.totalAmount || o.codAmount || 0), 0);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
              {/* MODAL TOP HEADER */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-2xl shadow-inner shrink-0">
                    <Bike className="w-7 h-7 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-black tracking-tight">{viewingDeliveryBoyWork.fullName}</h2>
                      <span className="font-mono text-[11px] bg-amber-500/20 text-amber-200 px-2.5 py-0.5 rounded-full border border-amber-400/30 font-bold">
                        {viewingDeliveryBoyWork.id}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          viewingDeliveryBoyWork.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                            : 'bg-rose-500/20 text-rose-200 border-rose-400/30'
                        }`}
                      >
                        {viewingDeliveryBoyWork.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-amber-100/90 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-amber-300" />
                        +91 {viewingDeliveryBoyWork.mobile}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-300" />
                        {viewingDeliveryBoyWork.assignedArea}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] opacity-80">
                        <Truck className="w-3.5 h-3.5 text-amber-300" />
                        {viewingDeliveryBoyWork.vehicleNumber} ({viewingDeliveryBoyWork.vehicleType})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Header Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <a
                    href={`tel:+91${viewingDeliveryBoyWork.mobile}`}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Rider</span>
                  </a>
                  <button
                    onClick={() => handleToggleDeliveryBoyStatus(viewingDeliveryBoyWork)}
                    className="px-3 py-1.5 bg-amber-500/30 hover:bg-amber-500/40 border border-amber-300/30 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Toggle Status</span>
                  </button>
                  <button
                    onClick={() => setViewingDeliveryBoyWork(null)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-white/80 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* RIDER LIVE METRIC STRIP */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 sm:p-4 bg-slate-50 border-b border-slate-200">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Lifetime</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{rawRiderOrders.length} orders</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs bg-amber-50/40">
                  <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Pending Right Now</span>
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-xl font-black text-amber-700 mt-0.5">{totalPendingCount} pending</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/40">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Delivered &amp; Confirmed</span>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">{totalDeliveredCount} done</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/40">
                  <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Failed / Cancelled</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  <div className="text-xl font-black text-rose-700 mt-0.5">{totalFailedCount} failed</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-2xs bg-purple-50/40 col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center justify-between">
                    <span>COD In Hand</span>
                    <Coins className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="text-xl font-black text-purple-700 mt-0.5 font-mono">₹{totalCodCollected}</div>
                </div>
              </div>

              {/* DATE & SEARCH CONTROLS BAR */}
              <div className="p-3 sm:p-4 bg-white border-b border-slate-200 space-y-3">
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                  {/* Date Filter Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                    <span className="text-[11px] font-black uppercase text-slate-400 flex items-center gap-1 mr-1">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                      Date:
                    </span>
                    {(['ALL', 'TODAY', 'YESTERDAY', 'WEEK', 'MONTH', 'CUSTOM'] as const).map((filterType) => (
                      <button
                        key={filterType}
                        onClick={() => setDboyDateFilter(filterType)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          dboyDateFilter === filterType
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {filterType === 'ALL' && 'All Time'}
                        {filterType === 'TODAY' && "Today's Delivery"}
                        {filterType === 'YESTERDAY' && "Yesterday"}
                        {filterType === 'WEEK' && 'Last 7 Days'}
                        {filterType === 'MONTH' && 'This Month'}
                        {filterType === 'CUSTOM' && 'Custom Date 📅'}
                      </button>
                    ))}
                  </div>

                  {/* Search in Rider Deliveries */}
                  <div className="relative w-full md:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search Customer, Mobile, Address, Order #..."
                      value={dboySearchQuery}
                      onChange={(e) => setDboySearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-slate-50 font-medium"
                    />
                    {dboySearchQuery && (
                      <button
                        onClick={() => setDboySearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Date Input Strip */}
                {dboyDateFilter === 'CUSTOM' && (
                  <div className="flex items-center gap-3 p-2 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
                    <span className="font-bold text-amber-900">Select Target Delivery Date:</span>
                    <input
                      type="date"
                      value={dboyCustomDate}
                      onChange={(e) => setDboyCustomDate(e.target.value)}
                      className="border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-950 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-amber-700">
                      {dboyCustomDate
                        ? `Filtering deliveries on ${dboyCustomDate}`
                        : 'Choose a date to filter completed/assigned deliveries'}
                    </span>
                  </div>
                )}

                {/* Filter Tab Navigation */}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-2 flex-wrap">
                  {[
                    { id: 'ALL', label: 'All Orders Log', count: searchFilteredOrders.length },
                    {
                      id: 'PENDING',
                      label: '⏳ Pending with Rider',
                      count: searchFilteredOrders.filter((o) =>
                        ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'READY_TO_SHIP'].includes(o.orderStatus)
                      ).length,
                      color: 'text-amber-700',
                    },
                    {
                      id: 'DELIVERED',
                      label: '✅ Delivered & Confirmed',
                      count: searchFilteredOrders.filter(
                        (o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED'
                      ).length,
                      color: 'text-emerald-700',
                    },
                    {
                      id: 'FAILED',
                      label: '❌ Failed / Cancelled',
                      count: searchFilteredOrders.filter(
                        (o) => o.orderStatus === 'DELIVERY_FAILED' || o.orderStatus === 'CANCELLED'
                      ).length,
                      color: 'text-rose-700',
                    },
                    {
                      id: 'RETURNS',
                      label: '🔄 Reverse Pickups',
                      count: riderReturns.length + riderReplacements.length,
                      color: 'text-sky-700',
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setDboyWorkTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        dboyWorkTab === tab.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                          dboyWorkTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* MODAL MAIN CONTENT SCROLL AREA */}
              <div id="delivery-boy-tripsheet-content" className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50 text-xs">
                {dboyWorkTab === 'RETURNS' ? (
                  /* REVERSE LOGISTICS & REPLACEMENT PICKUPS */
                  <div className="space-y-3">
                    <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                      Reverse Pickups &amp; Return Tasks ({riderReturns.length + riderReplacements.length})
                    </h4>
                    {riderReturns.length === 0 && riderReplacements.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                        No return or replacement tasks assigned to this delivery partner.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {riderReturns.map((r) => (
                          <div
                            key={r.id}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                                  RETURN PICKUP
                                </span>
                                <div className="font-mono font-bold text-slate-900 mt-1">{r.id}</div>
                              </div>
                              <StatusBadge status={r.status as any} />
                            </div>
                            <div className="text-slate-700">
                              <div>Customer: <strong>{r.customerName}</strong> ({r.customerId})</div>
                              <div>Order Ref: <span className="font-mono">{r.orderId}</span></div>
                              <div>Reason: <em>"{r.reason}"</em></div>
                              <div className="text-[10px] text-slate-400 font-mono mt-1">Requested: {r.createdAt}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ORDERS WORKFEED LIST */
                  <div className="space-y-3">
                    {displayOrders.length === 0 ? (
                      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <Package className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">No Deliveries Found</h4>
                        <p className="text-slate-500 max-w-sm mx-auto text-xs">
                          {dboySearchQuery || dboyDateFilter !== 'ALL'
                            ? 'No delivery matches the active date range or search filter for this delivery partner.'
                            : 'This delivery partner has not been assigned any orders matching this tab.'}
                        </p>
                      </div>
                    ) : (
                      displayOrders.map((ord) => {
                        const isPending = ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'READY_TO_SHIP'].includes(
                          ord.orderStatus
                        );
                        const isDelivered = ord.orderStatus === 'COMPLETED' || ord.orderStatus === 'DELIVERED';
                        const isFailed = ord.orderStatus === 'DELIVERY_FAILED' || ord.orderStatus === 'CANCELLED';

                        return (
                          <div
                            key={ord.id}
                            className={`bg-white rounded-xl border shadow-3xs transition-all overflow-hidden ${
                              isPending
                                ? 'border-amber-300 ring-1 ring-amber-500/20'
                                : isDelivered
                                ? 'border-emerald-200'
                                : isFailed
                                ? 'border-rose-200'
                                : 'border-slate-200'
                            }`}
                          >
                            {/* Order Header Ribbon */}
                            <div
                              className={`px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b text-xs ${
                                isPending
                                  ? 'bg-amber-50/70 border-amber-100'
                                  : isDelivered
                                  ? 'bg-emerald-50/40 border-emerald-100'
                                  : isFailed
                                  ? 'bg-rose-50/40 border-rose-100'
                                  : 'bg-slate-50 border-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-slate-900 text-xs flex items-center gap-1">
                                  <Hash className="w-3 h-3 text-indigo-500" />
                                  {ord.id}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    ord.orderType === 'PANTRY'
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {ord.orderType}
                                </span>
                                {(ord as any).deliveryPriority === 'HIGH' && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5">
                                    <Zap className="w-2.5 h-2.5 text-rose-600 fill-rose-600" />
                                    PRIORITY
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <StatusBadge status={ord.orderStatus} />
                                <button
                                  onClick={() => setSelectedOrder(ord)}
                                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-md text-[11px] transition flex items-center gap-1 shadow-3xs cursor-pointer"
                                >
                                  <Eye className="w-3 h-3 text-slate-600" />
                                  <span>View &amp; Bill</span>
                                </button>
                              </div>
                            </div>

                            {/* Order Body Grid - Compact 3-Column */}
                            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                              {/* Customer Information Block */}
                              <div className="space-y-1 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                                <div className="text-[9px] font-black uppercase text-slate-400">Customer &amp; Drop</div>
                                <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                                  <span className="truncate">{ord.customerName}</span>
                                  <span className="text-[10px] font-mono text-slate-400 font-normal">{ord.customerId}</span>
                                </div>
                                <div className="flex items-center justify-between pt-0.5">
                                  <div className="font-mono font-semibold text-slate-700 flex items-center gap-1 text-[11px]">
                                    <Phone className="w-3 h-3 text-amber-600 shrink-0" />
                                    +91 {ord.customerMobile}
                                  </div>
                                  <a
                                    href={`tel:+91${ord.customerMobile}`}
                                    className="text-[9px] font-bold text-amber-700 hover:underline bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                                  >
                                    Call
                                  </a>
                                </div>
                                <div className="text-slate-600 pt-0.5 flex items-start gap-1 leading-snug">
                                  <MapPin className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                                  <span className="text-[10px] line-clamp-2">{ord.deliveryAddress}</span>
                                </div>
                              </div>

                              {/* Timestamps & Detailed Workflow Log */}
                              <div className="space-y-1 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                                <div className="text-[9px] font-black uppercase text-slate-400">Workflow Timestamps</div>
                                <div className="grid grid-cols-2 gap-1 text-[10px]">
                                  <div className="p-1 rounded bg-white border border-slate-200/60">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Placed</div>
                                    <div className="font-mono font-bold text-slate-800 truncate" title={formatOrderDateTime(getOrderPreciseTimestamp(ord)).full}>
                                      {formatOrderDateTime(getOrderPreciseTimestamp(ord)).full}
                                    </div>
                                  </div>
                                  <div className="p-1 rounded bg-white border border-slate-200/60">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Assigned</div>
                                    <div className="font-mono font-bold text-slate-800 truncate">{ord.assignedAt || 'N/A'}</div>
                                  </div>
                                  <div className="p-1 rounded bg-white border border-slate-200/60">
                                    <div className="text-[8px] text-sky-600 font-bold uppercase">Transit</div>
                                    <div className="font-mono font-bold text-sky-800 truncate">{ord.outForDeliveryAt || (ord.orderStatus === 'OUT_FOR_DELIVERY' ? 'In Progress' : 'N/A')}</div>
                                  </div>
                                  <div
                                    className={`p-1 rounded border ${
                                      isDelivered
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                        : isFailed
                                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                                        : 'bg-white border-slate-200/60 text-slate-800'
                                    }`}
                                  >
                                    <div className="text-[8px] font-bold uppercase">
                                      {isDelivered ? 'Delivered' : isFailed ? 'Failed' : 'Status'}
                                    </div>
                                    <div className="font-mono font-bold truncate">
                                      {ord.deliveredAt || (isDelivered ? ord.updatedAt : 'Pending')}
                                    </div>
                                  </div>
                                </div>

                                {isFailed && ord.failedReason && (
                                  <div className="p-1 bg-rose-50 rounded text-rose-800 text-[10px] border border-rose-200">
                                    <strong>Failure:</strong> {ord.failedReason}
                                  </div>
                                )}
                              </div>

                              {/* Items Breakdown & Financials */}
                              <div className="space-y-1 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-400">
                                    <span>Bag Items ({ord.items.length})</span>
                                    <span className="font-mono font-bold text-slate-600">
                                      Qty: {ord.items.reduce((s, i) => s + i.quantity, 0)}
                                    </span>
                                  </div>

                                  <div className="space-y-1 mt-1 max-h-20 overflow-y-auto pr-0.5">
                                    {ord.items.map((it, idx) => {
                                      const itImg = getItemImage(it);
                                      return (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between text-[10px] text-slate-700 bg-white p-1 rounded border border-slate-200/80 shadow-3xs"
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <img
                                              src={itImg}
                                              alt={it.productName}
                                              className="w-5 h-5 object-cover rounded bg-slate-100 border border-slate-200 shrink-0 cursor-pointer"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewImageModal({
                                                  url: itImg,
                                                  title: it.productName,
                                                  subtitle: `Order #${ord.id} • Qty: ${it.quantity} • ₹${it.price}`,
                                                });
                                              }}
                                              title="Click to zoom"
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).src =
                                                  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&q=80';
                                              }}
                                            />
                                            <span className="truncate font-medium text-slate-900">{it.productName}</span>
                                          </div>
                                          <span className="font-bold text-slate-900 ml-1.5 shrink-0 font-mono text-[10px]">
                                            x{it.quantity}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between mt-1">
                                  <div>
                                    <div className="text-[8px] font-bold text-slate-400 uppercase">Payment</div>
                                    <div className="font-bold text-slate-800 text-[10px]">
                                      {ord.paymentMethod === 'COD' ? '💵 COD' : ord.orderType === 'PANTRY' ? '💳 Pantry' : '💳 Prepaid'}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[8px] font-bold text-slate-400 uppercase">Order Value</div>
                                    <div className="text-sm font-black text-slate-950 font-mono flex items-center justify-end">
                                      <IndianRupee className="w-3 h-3 text-slate-700" />
                                      <span>{ord.totalAmount}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-600 font-medium">
                  Showing <strong>{displayOrders.length}</strong> deliveries for partner <strong>{viewingDeliveryBoyWork.fullName}</strong>.
                  {totalPendingCount > 0 && (
                    <span className="ml-2 font-bold text-amber-700">
                      ⚠️ {totalPendingCount} active orders currently in delivery queue.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setIsGeneratingTripSheetPdf(true);
                      try {
                        await exportElementToPdf('delivery-boy-tripsheet-content', {
                          filename: `TripSheet-${viewingDeliveryBoyWork.fullName.replace(/\s+/g, '_')}.pdf`,
                          orientation: 'portrait',
                        });
                      } catch (err) {
                        console.error('Failed to export Trip Sheet PDF:', err);
                      } finally {
                        setIsGeneratingTripSheetPdf(false);
                      }
                    }}
                    disabled={isGeneratingTripSheetPdf}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Download Trip Sheet as PDF"
                  >
                    {isGeneratingTripSheetPdf ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
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
                    className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Trip Sheet</span>
                  </button>
                  <button
                    onClick={() => setViewingDeliveryBoyWork(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer"
                  >
                    Close Work Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* LIGHTBOX PRODUCT IMAGE PREVIEW MODAL */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <h4 className="font-bold text-sm text-slate-100">{previewImageModal.title}</h4>
                {previewImageModal.subtitle && (
                  <p className="text-xs text-slate-400 mt-0.5">{previewImageModal.subtitle}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewImageModal(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={previewImageModal.url}
                alt={previewImageModal.title}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
                }}
              />
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Full resolution cargo verification snapshot</span>
              <button
                onClick={() => setPreviewImageModal(null)}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN ORDER PRODUCT & BATCH ASSIGNMENT MODAL */}
      {assigningProductOrder && (
        <OrderProductAssignmentModal
          order={assigningProductOrder}
          onClose={() => setAssigningProductOrder(null)}
          onOrderUpdated={(updated: Order) => {
            setAssigningProductOrder(null);
            if (selectedOrder && selectedOrder.id === updated.id) {
              setSelectedOrder(updated);
            }
            fetchData();
          }}
        />
      )}

      {/* CUSTOMER RETAIL INVOICE BILL MODAL */}
      {printingCustomerBillOrder && (
        <CustomerBillModal
          order={printingCustomerBillOrder}
          onClose={() => setPrintingCustomerBillOrder(null)}
        />
      )}

      {/* WAREHOUSE PICKING & PACKING SLIP MODAL */}
      {printingWarehouseSlipOrder && (
        <WarehousePackingSlipModal
          order={printingWarehouseSlipOrder}
          onClose={() => setPrintingWarehouseSlipOrder(null)}
          onMarkPacked={() => {
            setPrintingWarehouseSlipOrder(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
