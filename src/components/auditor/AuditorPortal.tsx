import React, { useState, useEffect, useRef } from 'react';
import { Customer, PantryCardItem, AuditorCheck, Auditor, WalletTransaction, PantryPayment, CustomerProductTimeline, PantryCreditLedger, AuditorReturnOrder, Order } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { AuditBillModal } from '../common/AuditBillModal';
import { ProductTimelineModal } from '../common/ProductTimelineModal';
import { AppWindowModal } from '../common/AppWindowModal';
import { AuditorWorkPdfReport } from './AuditorWorkPdfReport';
import { CreditLimitDetailModal, LimitMetricTab } from '../customer/CreditLimitDetailModal';
import { getDeliveryDayCount } from '../../utils/dateTimeUtils';
import { useTheme } from '../../context/ThemeContext';
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
  RefreshCw,
  User,
  MapPin,
  Phone,
  ShieldCheck,
  FileCheck,
  Printer,
  Building,
  Calendar,
  Wallet,
  ArrowRight,
  Eye,
  PlusCircle,
  Check,
  FileText,
  AlertCircle,
  Lock,
  QrCode,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export const AuditorPortal: React.FC = () => {
  const { user, auditor } = useAuth();
  const { currentTheme } = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isInspectionMaximized, setIsInspectionMaximized] = useState(false);
  const [pantryItems, setPantryItems] = useState<
    (PantryCardItem & {
      daysSinceDelivery: number;
      isReturnEligible: boolean;
      isNearExpiry: boolean;
      isExpired: boolean;
    })[]
  >([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [metricModalTab, setMetricModalTab] = useState<LimitMetricTab | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inspect' | 'scheduled' | 'history' | 'pantryPay' | 'returns'>('inspect');
  const [pantrySubTab, setPantrySubTab] = useState<'active' | 'used' | 'ledger'>('active');
  const [customerLedger, setCustomerLedger] = useState<PantryCreditLedger[]>([]);
  const [auditorReturns, setAuditorReturns] = useState<AuditorReturnOrder[]>([]);

  // Customer Product History Timelines
  const [customerTimelines, setCustomerTimelines] = useState<CustomerProductTimeline[]>([]);
  const [selectedTimeline, setSelectedTimeline] = useState<CustomerProductTimeline | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Pantry Pay records for auditor verification
  const [pantryPayments, setPantryPayments] = useState<PantryPayment[]>([]);
  const [pantryPayLoading, setPantryPayLoading] = useState(false);
  const [pantryPaySearch, setPantryPaySearch] = useState('');
  const [walletHistory, setWalletHistory] = useState<WalletTransaction[]>([]);

  // Customer wallet info
  const [customerWallet, setCustomerWallet] = useState<{ walletBalance: number } | null>(null);

  // Active Audit state per item
  const [itemStatuses, setItemStatuses] = useState<
    Record<
      string,
      {
        status: 'AVAILABLE' | 'NOT_AVAILABLE' | 'DAMAGED' | 'EXPIRED' | 'NEAR_EXPIRY' | 'PARTIAL';
        action: 'NONE' | 'WALLET_DEDUCTION' | 'RETURN_INITIATED' | 'REPLACEMENT_INITIATED' | 'PANTRY_PAY' | 'MIXED';
        qtyAvailable: number;
        qtyMissing: number;
        qtyDamaged: number;
        qtyReturn: number;
        qtyReplacement: number;
        selectedSwapUsedItemId?: string;
        qtyPantryPay: number;
        remarks: string;
      }
    >
  >({});
  const [overallRemarks, setOverallRemarks] = useState('');
  const [submittingAudit, setSubmittingAudit] = useState(false);
  const [auditorSignature, setAuditorSignature] = useState(true);
  const [customerSignature, setCustomerSignature] = useState(true);

  // Revision & Re-edit of customer-rejected audit bills
  const [revisingAudit, setRevisingAudit] = useState<AuditorCheck | null>(null);

  // PDF Report Generation Modal states
  const [showPdfReportModal, setShowPdfReportModal] = useState(false);
  const [pdfReportAudit, setPdfReportAudit] = useState<AuditorCheck | null>(null);

  // Dedicated Product Scrolling & Filter States
  const productsScrollRef = useRef<HTMLDivElement>(null);
  const [productSearchText, setProductSearchText] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState<'ALL' | 'DISCREPANCY' | 'MISSING' | 'DAMAGED' | 'OK'>('ALL');
  const [zoomedImage, setZoomedImage] = useState<{ src: string; title: string; barcode?: string; batchNumber?: string; mfgDate?: string; expDate?: string } | null>(null);

  const scrollProductsBy = (offset: number) => {
    if (productsScrollRef.current) {
      productsScrollRef.current.scrollBy({ top: offset, behavior: 'smooth' });
    }
  };

  const scrollProductsToEdge = (edge: 'top' | 'bottom') => {
    if (productsScrollRef.current) {
      productsScrollRef.current.scrollTo({
        top: edge === 'top' ? 0 : productsScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  // Audits list
  const [allAudits, setAllAudits] = useState<AuditorCheck[]>([]);

  // Selected audit for detailed view modal
  const [viewAuditModal, setViewAuditModal] = useState<AuditorCheck | null>(null);

  // Schedule new audit modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    customerId: '',
    requestedDate: new Date().toISOString().split('T')[0],
    requestedTime: '11:00 AM',
    purpose: 'Routine Physical Pantry Verification & Quality Check',
  });
  const [scheduling, setScheduling] = useState(false);

  const [currentAuditorProfile, setCurrentAuditorProfile] = useState<Auditor | null>(auditor || null);
  const [allRegisteredCustomers, setAllRegisteredCustomers] = useState<Customer[]>([]);
  const [showAllHouses, setShowAllHouses] = useState(false);
  const [isAddHouseModalOpen, setIsAddHouseModalOpen] = useState(false);
  const [addHouseTab, setAddHouseTab] = useState<'NEW' | 'EXISTING'>('NEW');
  const [newHouseForm, setNewHouseForm] = useState({
    fullName: '',
    mobile: '',
    address: '',
    area: 'Lalpur',
    city: 'Ranchi',
    pinCode: '834001',
    pantryLimit: 10000,
  });
  const [newHouseSaving, setNewHouseSaving] = useState(false);
  const [existingHouseSearch, setExistingHouseSearch] = useState('');

  const fetchCustomersAndPastAudits = async () => {
    setLoading(true);
    try {
      const myAudId = auditor?.id || user?.auditorId || '';
      const [cList, chkList, pPayList, audList, audRetList] = await Promise.all([
        api.getCustomers(),
        api.getAuditorChecks(),
        api.getAllPantryPayments(),
        api.getAuditors(),
        api.getAuditorReturnOrders(myAudId ? { auditorId: myAudId } : undefined),
      ]);

      const cleanUserMobile = (user?.mobile || '').replace(/\D/g, '').slice(-10);
      const myAuditor =
        audList.find(
          (a) =>
            (auditor?.id && a.id === auditor.id) ||
            (user?.auditorId && a.id === user.auditorId) ||
            (cleanUserMobile && a.mobile.replace(/\D/g, '').slice(-10) === cleanUserMobile) ||
            (user?.name && a.fullName.trim().toLowerCase() === user.name.trim().toLowerCase())
        ) || auditor || audList[0];

      setCurrentAuditorProfile(myAuditor || null);
      setAllRegisteredCustomers(cList);

      // Scoped View: If auditor is configured and showAllHouses is false, show assigned customers
      let filteredCustomers = cList;
      const assignedIds = new Set(myAuditor?.assignedCustomerIds || []);
      const hasDirectAssignments = assignedIds.size > 0 || cList.some((c) => (c as any).assignedAuditorId === myAuditor?.id);

      if (!showAllHouses && myAuditor && hasDirectAssignments) {
        filteredCustomers = cList.filter(
          (c) => assignedIds.has(c.id) || (c as any).assignedAuditorId === myAuditor.id
        );
      }

      setCustomers(filteredCustomers);
      setAllAudits(chkList);
      setPantryPayments(pPayList);
      setAuditorReturns(audRetList);
      if (filteredCustomers.length > 0) {
        setSelectedCustomerId((prev) => (filteredCustomers.some((c) => c.id === prev) ? prev : filteredCustomers[0].id));
        setScheduleForm((prev) => ({ ...prev, customerId: filteredCustomers[0].id }));
      } else {
        setSelectedCustomerId('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAssignHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewHouseSaving(true);
    try {
      const cleanMobile = newHouseForm.mobile.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length !== 10) {
        alert('Please enter a valid 10-digit mobile number');
        return;
      }

      const avail = await api.checkMobileAvailability(cleanMobile);
      if (!avail.available) {
        alert(avail.error || 'This mobile number is already registered.');
        return;
      }

      const created = await api.createCustomer({
        fullName: newHouseForm.fullName,
        mobile: cleanMobile,
        address: newHouseForm.address,
        area: newHouseForm.area,
        city: newHouseForm.city,
        pinCode: newHouseForm.pinCode,
        pantryLimit: Number(newHouseForm.pantryLimit) || 10000,
        availablePantryLimit: Number(newHouseForm.pantryLimit) || 10000,
        isPantryAllowed: true,
      });

      if (currentAuditorProfile) {
        const updatedIds = Array.from(new Set([...(currentAuditorProfile.assignedCustomerIds || []), created.id]));
        await api.updateAuditor(currentAuditorProfile.id, {
          assignedCustomerIds: updatedIds,
        });
        setCurrentAuditorProfile({
          ...currentAuditorProfile,
          assignedCustomerIds: updatedIds,
        });
      }

      alert(`✅ Household "${created.fullName}" registered & assigned to your route!`);
      setIsAddHouseModalOpen(false);
      setNewHouseForm({
        fullName: '',
        mobile: '',
        address: '',
        area: 'Lalpur',
        city: 'Ranchi',
        pinCode: '834001',
        pantryLimit: 10000,
      });

      await fetchCustomersAndPastAudits();
      setSelectedCustomerId(created.id);
    } catch (err: any) {
      alert(err.message || 'Failed to add household');
    } finally {
      setNewHouseSaving(false);
    }
  };

  const handleToggleLinkExistingHouse = async (custId: string) => {
    if (!currentAuditorProfile) return;
    const currentList = currentAuditorProfile.assignedCustomerIds || [];
    let updated: string[];
    if (currentList.includes(custId)) {
      updated = currentList.filter((id) => id !== custId);
    } else {
      updated = [...currentList, custId];
    }
    try {
      await api.updateAuditor(currentAuditorProfile.id, { assignedCustomerIds: updated });
      setCurrentAuditorProfile({ ...currentAuditorProfile, assignedCustomerIds: updated });
      await fetchCustomersAndPastAudits();
    } catch (err: any) {
      alert(err.message || 'Failed to update assignment');
    }
  };

  const fetchPantryPayRecords = async () => {
    setPantryPayLoading(true);
    try {
      const pPayList = await api.getAllPantryPayments();
      setPantryPayments(pPayList);
    } catch (err) {
      console.error('Failed to load Pantry Pay records:', err);
    } finally {
      setPantryPayLoading(false);
    }
  };

  const handleConfirmPantryPayment = async (paymentId: string) => {
    try {
      const updated = await api.confirmPantryPayment(paymentId);
      const isRecharge = updated.isWalletRecharge || updated.paymentType === 'WALLET_RECHARGE' || updated.productId === 'WALLET-RECHARGE-1000' || updated.barcode === 'WALLET-1000' || updated.productId === 'WALLET-RECHARGE-100' || updated.barcode === 'WALLET-100';
      if (isRecharge) {
        alert(`✅ Fixed ₹${updated.amount.toLocaleString('en-IN')} Wallet Recharge confirmed! ₹${updated.amount.toLocaleString('en-IN')} has been credited to customer ${updated.customerName}'s wallet balance.`);
      } else {
        alert(`✅ Pantry Payment ${paymentId} verified and confirmed by Auditor!`);
      }
      fetchPantryPayRecords();
      if (selectedCustomerId) {
        api.getWalletBalance(selectedCustomerId).then(setCustomerWallet).catch(() => {});
        api.getWalletTransactions(selectedCustomerId).then(setWalletHistory).catch(() => {});
      }
    } catch (err: any) {
      alert(err.message || 'Failed to confirm payment');
    }
  };

  useEffect(() => {
    fetchCustomersAndPastAudits();
  }, []);

  // Fetch Pantry Items & Wallet when customer changes
  useEffect(() => {
    if (!selectedCustomerId) return;
    const fetchPantryItemsAndWallet = async () => {
      try {
        const [items, walletData, timelines, ledger, walletTxns, orders] = await Promise.all([
          api.getPantryCard(selectedCustomerId),
          api.getWalletBalance(selectedCustomerId).catch(() => ({ walletBalance: 1000 })),
          api.getCustomerProductTimeline(selectedCustomerId).catch(() => []),
          api.getCustomerCreditLedger(selectedCustomerId).catch(() => []),
          api.getWalletTransactions(selectedCustomerId).catch(() => []),
          api.getOrders({ customerId: selectedCustomerId }).catch(() => []),
        ]);
        setPantryItems(items);
        setCustomerOrders(orders);
        setCustomerWallet(walletData);
        setCustomerTimelines(timelines);
        setCustomerLedger(ledger);
        setWalletHistory(walletTxns);

        // Check if there is an active rejected audit for this customer or if revisingAudit matches
        const targetAudit =
          (revisingAudit && revisingAudit.customerId === selectedCustomerId)
            ? revisingAudit
            : allAudits.find(
                (a) =>
                  a.customerId === selectedCustomerId &&
                  (a.status === 'CUSTOMER_REJECTED' ||
                    a.status === 'DISPUTED' ||
                    a.billStatus === 'CUSTOMER_REJECTED' ||
                    a.billStatus === 'DISPUTED')
              );

        if (targetAudit && !revisingAudit) {
          setRevisingAudit(targetAudit);
        }

        if (targetAudit?.overallRemarks) {
          setOverallRemarks(targetAudit.overallRemarks);
        }

        // Initialize state
        const initialStatus: Record<
          string,
          {
            status: 'AVAILABLE' | 'NOT_AVAILABLE' | 'DAMAGED' | 'EXPIRED' | 'NEAR_EXPIRY' | 'PARTIAL';
            action: 'NONE' | 'WALLET_DEDUCTION' | 'RETURN_INITIATED' | 'REPLACEMENT_INITIATED' | 'PANTRY_PAY' | 'MIXED';
            qtyAvailable: number;
            qtyMissing: number;
            qtyDamaged: number;
            qtyReturn: number;
            qtyReplacement: number;
            qtyPantryPay: number;
            remarks: string;
          }
        > = {};

        items.forEach((item) => {
          const checked = targetAudit?.itemsChecked?.find(
            (c) => c.pantryCardItemId === item.id || c.productId === item.productId
          );

          if (checked) {
            initialStatus[item.id] = {
              status: (checked.verificationStatus as any) || 'AVAILABLE',
              action: (checked.actionTaken as any) || ((checked.qtyMissing ?? 0) > 0 ? 'WALLET_DEDUCTION' : 'NONE'),
              qtyAvailable: typeof checked.qtyAvailable === 'number' ? checked.qtyAvailable : item.quantity,
              qtyMissing: checked.qtyMissing || 0,
              qtyDamaged: checked.qtyDamaged || 0,
              qtyReturn: checked.qtyReturn || 0,
              qtyReplacement: checked.qtyReplacement || 0,
              qtyPantryPay: checked.qtyPantryPay || 0,
              remarks: checked.remarks || '',
            };
          } else {
            const isNotAvail = item.auditorVerificationStatus === 'NOT_AVAILABLE';
            initialStatus[item.id] = {
              status: (item.auditorVerificationStatus as any) || (item.isExpired ? 'EXPIRED' : 'AVAILABLE'),
              action: isNotAvail ? 'WALLET_DEDUCTION' : 'NONE',
              qtyAvailable: item.quantity,
              qtyMissing: 0,
              qtyDamaged: 0,
              qtyReturn: 0,
              qtyReplacement: 0,
              qtyPantryPay: 0,
              remarks: item.lastAuditorRemarks || '',
            };
          }
        });

        setItemStatuses(initialStatus);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPantryItemsAndWallet();
  }, [selectedCustomerId, revisingAudit]);

  const handleStartRevisingAudit = (auditToRevise: AuditorCheck) => {
    setRevisingAudit(auditToRevise);
    setSelectedCustomerId(auditToRevise.customerId);
    setActiveTab('inspect');
    setPantrySubTab('active');
    setOverallRemarks(auditToRevise.overallRemarks || '');
    setAuditorSignature(true);
    setCustomerSignature(true);

    if (selectedCustomerId === auditToRevise.customerId && pantryItems.length > 0) {
      const initialStatus: Record<string, any> = {};
      pantryItems.forEach((item) => {
        const checked = auditToRevise.itemsChecked?.find(
          (c) => c.pantryCardItemId === item.id || c.productId === item.productId
        );
        if (checked) {
          initialStatus[item.id] = {
            status: checked.verificationStatus || 'AVAILABLE',
            action: checked.actionTaken || ((checked.qtyMissing ?? 0) > 0 ? 'WALLET_DEDUCTION' : 'NONE'),
            qtyAvailable: typeof checked.qtyAvailable === 'number' ? checked.qtyAvailable : item.quantity,
            qtyMissing: checked.qtyMissing || 0,
            qtyDamaged: checked.qtyDamaged || 0,
            qtyReturn: checked.qtyReturn || 0,
            qtyReplacement: checked.qtyReplacement || 0,
            qtyPantryPay: checked.qtyPantryPay || 0,
            remarks: checked.remarks || '',
          };
        } else {
          initialStatus[item.id] = {
            status: item.isExpired ? 'EXPIRED' : 'AVAILABLE',
            action: 'NONE',
            qtyAvailable: item.quantity,
            qtyMissing: 0,
            qtyDamaged: 0,
            qtyReturn: 0,
            qtyReplacement: 0,
            qtyPantryPay: 0,
            remarks: '',
          };
        }
      });
      setItemStatuses(initialStatus);
    }
  };

  const handleSelectedSwapUsedItemChange = (itemId: string, swapUsedItemId: string) => {
    setItemStatuses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        selectedSwapUsedItemId: swapUsedItemId,
      },
    }));
  };

  const handleQtyChange = (
    itemId: string,
    field: 'qtyAvailable' | 'qtyMissing' | 'qtyDamaged' | 'qtyReturn' | 'qtyReplacement' | 'qtyPantryPay',
    val: string
  ) => {
    const item = pantryItems.find((i) => i.id === itemId);
    if (!item) return;

    // Check if user is attempting to change replacement on an item without matching barcode in Used History
    if (field === 'qtyReplacement') {
      const matchingUsed = pantryItems.filter(
        (u) =>
          u.quantity === 0 &&
          u.barcode &&
          item.barcode &&
          u.barcode.trim().toLowerCase() === item.barcode.trim().toLowerCase()
      );
      if (matchingUsed.length === 0) {
        return; // Locked: replacement cannot be entered if barcode not in Used History
      }
    }

    const numVal = Math.max(0, parseInt(val) || 0);
    
    setItemStatuses((prev) => {
      const current = prev[itemId] || {
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

      let next = { ...current, [field]: numVal };

      // If user is changing a discrepancy field, auto-calculate Available
      if (field !== 'qtyAvailable') {
        const others = 
          (field === 'qtyMissing' ? numVal : next.qtyMissing) +
          (field === 'qtyDamaged' ? numVal : next.qtyDamaged) +
          (field === 'qtyReturn' ? numVal : next.qtyReturn) +
          (field === 'qtyReplacement' ? numVal : next.qtyReplacement) +
          (field === 'qtyPantryPay' ? numVal : next.qtyPantryPay);
        
        // Ensure discrepancy total doesn't exceed item quantity
        if (others > item.quantity) {
          // If it exceeds, cap the current field to the remaining allowance
          const allowanceExcludingCurrent = 
            (field === 'qtyMissing' ? 0 : next.qtyMissing) +
            (field === 'qtyDamaged' ? 0 : next.qtyDamaged) +
            (field === 'qtyReturn' ? 0 : next.qtyReturn) +
            (field === 'qtyReplacement' ? 0 : next.qtyReplacement) +
            (field === 'qtyPantryPay' ? 0 : next.qtyPantryPay);
          
          const cappedVal = Math.max(0, item.quantity - allowanceExcludingCurrent);
          next[field] = cappedVal;
          next.qtyAvailable = 0;
        } else {
          next.qtyAvailable = item.quantity - others;
        }
      } else {
        // If user is explicitly changing Available, we should probably adjust Missing or just cap it
        next.qtyAvailable = Math.min(item.quantity, numVal);
        // Optional: If Available is set, maybe reset or reduce others?
        // For now, let's just ensure sum <= total
        const others = next.qtyMissing + next.qtyDamaged + next.qtyReturn + next.qtyReplacement + next.qtyPantryPay;
        if (next.qtyAvailable + others > item.quantity) {
          // If total exceeds, we keep Available and reset others proportional? 
          // Simple approach: reset others if they conflict
          next.qtyMissing = 0;
          next.qtyDamaged = 0;
          next.qtyReturn = 0;
          next.qtyReplacement = 0;
          next.qtyPantryPay = 0;
        }
      }
      
      // Determine overall status based on breakdown
      if (next.qtyMissing === 0 && next.qtyDamaged === 0 && next.qtyPantryPay === 0 && next.qtyReturn === 0 && next.qtyReplacement === 0) {
        next.status = 'AVAILABLE';
        next.action = 'NONE';
      } else if (next.qtyReturn > 0 && next.qtyMissing === 0 && next.qtyDamaged === 0 && next.qtyPantryPay === 0 && next.qtyReplacement === 0) {
        next.status = 'PARTIAL';
        next.action = 'RETURN_INITIATED';
      } else if (next.qtyReplacement > 0 && next.qtyMissing === 0 && next.qtyDamaged === 0 && next.qtyPantryPay === 0 && next.qtyReturn === 0) {
        next.status = 'PARTIAL';
        next.action = 'REPLACEMENT_INITIATED';
      } else if (next.qtyPantryPay > 0 && next.qtyMissing === 0 && next.qtyDamaged === 0 && next.qtyReturn === 0 && next.qtyReplacement === 0) {
        next.status = 'PARTIAL';
        next.action = 'PANTRY_PAY';
      } else if (next.qtyAvailable === 0 && next.qtyDamaged === 0 && next.qtyPantryPay === 0 && next.qtyReturn === 0 && next.qtyReplacement === 0 && next.qtyMissing > 0) {
        next.status = 'NOT_AVAILABLE';
        next.action = 'WALLET_DEDUCTION';
      } else {
        next.status = 'PARTIAL';
        next.action = 'MIXED';
      }

      return { ...prev, [itemId]: next };
    });
  };

  const handleActionChange = (
    itemId: string,
    action: 'NONE' | 'WALLET_DEDUCTION' | 'RETURN_INITIATED' | 'REPLACEMENT_INITIATED' | 'PANTRY_PAY' | 'MIXED'
  ) => {
    setItemStatuses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        action,
      },
    }));
  };

  const handleRemarksChange = (itemId: string, remarks: string) => {
    setItemStatuses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        remarks,
      },
    }));
  };

  // Calculate live totals for the active inspection
  const totalChecked = pantryItems.length;
  let missingCountTotal = 0;
  let damagedCountTotal = 0;
  let returnCountTotal = 0;
  let replacementCountTotal = 0;
  let pantryPayCountTotal = 0;
  let estimatedWalletDeduction = 0;
  let estimatedCreditRestore = 0;

  pantryItems.forEach((item) => {
    const st = itemStatuses[item.id];
    if (st) {
      missingCountTotal += st.qtyMissing;
      damagedCountTotal += st.qtyDamaged;
      returnCountTotal += st.qtyReturn;
      replacementCountTotal += st.qtyReplacement;
      pantryPayCountTotal += st.qtyPantryPay;
      
      const unitPrice = item.unitPrice || (item.totalValue / item.quantity) || 100;
      estimatedWalletDeduction += st.qtyMissing * unitPrice;
      estimatedCreditRestore += (st.qtyPantryPay + st.qtyReturn) * unitPrice;
    }
  });

  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAuditorProfile?.status === 'INACTIVE') {
      alert('❌ Action restricted: Your Field Auditor account is currently inactive. Please contact administrator.');
      return;
    }
    if (!selectedCustomerId || !user) return;

    const auditorId = auditor?.id || user.auditorId || 'AUD-001';

    const itemsChecked = pantryItems.map((item) => {
      const st = itemStatuses[item.id];
      const unitPrice = item.unitPrice || (item.totalValue / (item.quantity || 1)) || (item as any).productPrice || 100;
      const pName = item.productName || (item as any).name || (item as any).title || (item as any).pantryCardItemName || 'Grocery Item';
      
      const matchingUsed = pantryItems.filter(
        (u) =>
          u.quantity === 0 &&
          u.barcode &&
          item.barcode &&
          u.barcode.trim().toLowerCase() === item.barcode.trim().toLowerCase()
      );
      const selectedSwapId = st?.selectedSwapUsedItemId || matchingUsed[0]?.id;
      const targetUsed = matchingUsed.find((u) => u.id === selectedSwapId) || matchingUsed[0];

      return {
        pantryCardItemId: item.id,
        productId: item.productId,
        productName: pName,
        productPrice: unitPrice,
        unitPrice: unitPrice,
        quantity: item.quantity || 1,
        systemQuantity: item.quantity || 1,
        barcode: item.barcode || '',
        batchNumber: item.batchNumber,
        manufacturingDate: item.manufacturingDate,
        expiryDate: item.expiryDate,
        verificationStatus: st?.status || 'AVAILABLE',
        actionTaken: st?.action || 'NONE',
        qtyAvailable: st?.qtyAvailable ?? item.quantity ?? 1,
        qtyMissing: st?.qtyMissing || 0,
        qtyDamaged: st?.qtyDamaged || 0,
        qtyReturn: st?.qtyReturn || 0,
        qtyReplacement: st?.qtyReplacement || 0,
        replacementTargetUsedItemId: (st?.qtyReplacement || 0) > 0 ? targetUsed?.id : undefined,
        replacedBatchNumber: (st?.qtyReplacement || 0) > 0 ? targetUsed?.batchNumber : undefined,
        replacedMfgDate: (st?.qtyReplacement || 0) > 0 ? targetUsed?.manufacturingDate : undefined,
        replacedExpDate: (st?.qtyReplacement || 0) > 0 ? targetUsed?.expiryDate : undefined,
        qtyPantryPay: st?.qtyPantryPay || 0,
        remarks: st?.remarks || '',
      };
    });

    setSubmittingAudit(true);
    try {
      const isRevision = !!revisingAudit;
      const newAudit = await api.submitAuditorCheck({
        auditId: revisingAudit?.id,
        auditorId,
        customerId: selectedCustomerId,
        itemsChecked,
        overallRemarks,
      });

      alert(
        isRevision
          ? `✅ Revised Audit Bill (v${newAudit.billVersion || 2}) Successfully Re-submitted to Customer!\n` +
            `• Bill ID: ${newAudit.billId || newAudit.id}\n` +
            `• Total items checked: ${itemsChecked.length}\n` +
            `• Missing / Discrepancies: ${missingCountTotal}\n` +
            `• Wallet Deductions: ₹${estimatedWalletDeduction}\n\n` +
            `Customer can now review and Accept or Reject the revised bill.`
          : `✅ Audit Bill Successfully Generated by Auditor!\n` +
            `• Bill ID: ${newAudit.billId || newAudit.id}\n` +
            `• Total items checked: ${itemsChecked.length}\n` +
            `• Missing / Discrepancies: ${missingCountTotal}\n` +
            `• Wallet Deductions: ₹${estimatedWalletDeduction}\n` +
            `• Credit Restored (Pantry Pay): ₹${estimatedCreditRestore}\n\n` +
            `Status: PENDING CUSTOMER CONFIRMATION.`
      );
      setRevisingAudit(null);
      setOverallRemarks('');
      fetchCustomersAndPastAudits();
      setViewAuditModal(newAudit);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAudit(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAuditorProfile?.status === 'INACTIVE') {
      alert('❌ Action restricted: Your Field Auditor account is currently inactive. Please contact administrator.');
      return;
    }
    if (!scheduleForm.customerId) return;
    setScheduling(true);
    try {
      const auditorId = auditor?.id || user?.auditorId || 'AUD-001';
      await api.createAuditRequest({
        customerId: scheduleForm.customerId,
        auditorId,
        requestedDate: scheduleForm.requestedDate,
        requestedTime: scheduleForm.requestedTime,
        purpose: scheduleForm.purpose,
      });
      alert('Field Audit Request scheduled successfully!');
      setIsScheduleModalOpen(false);
      fetchCustomersAndPastAudits();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setScheduling(false);
    }
  };

  const handleStartAudit = async (auditId: string) => {
    if (currentAuditorProfile?.status === 'INACTIVE') {
      alert('❌ Action restricted: Your Field Auditor account is currently inactive. Please contact administrator.');
      return;
    }
    try {
      const updated = await api.startAuditCheck(auditId);
      alert(`Audit ${auditId} is now IN_PROGRESS. You can now verify pantry items.`);
      setSelectedCustomerId(updated.customerId);
      setActiveTab('inspect');
      fetchCustomersAndPastAudits();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return !q || c.fullName.toLowerCase().includes(q) || c.mobile.includes(q) || c.id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Inactive Auditor Banner if deactivated */}
      {currentAuditorProfile?.status === 'INACTIVE' && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-800 animate-in slide-in-from-top-2">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <div className="flex-1">
            <h4 className="font-black text-sm">Auditor Account Inactive / Deactivated</h4>
            <p className="text-xs text-rose-700">
              Your field auditor access has been deactivated by the system administrator. Physical verification submissions and audit schedules are currently restricted. Please contact admin.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white">DEACTIVATED</span>
        </div>
      )}

      {/* CUSTOMER REJECTED AUDITS ALERT BANNER */}
      {(() => {
        const rejectedAuditsList = allAudits.filter(
          (a) =>
            a.status === 'CUSTOMER_REJECTED' ||
            a.status === 'DISPUTED' ||
            a.billStatus === 'CUSTOMER_REJECTED' ||
            a.billStatus === 'DISPUTED'
        );
        if (rejectedAuditsList.length === 0) return null;

        return (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-rose-950 animate-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-sm text-rose-900">
                  Action Required: {rejectedAuditsList.length} Audit Bill{rejectedAuditsList.length > 1 ? 's' : ''} Rejected by Customer
                </h4>
                <p className="text-xs text-rose-800 mt-0.5">
                  The customer has reviewed their bill and requested corrections. Click below to reopen the audit with all previously filled data and reduced quantities restored.
                </p>
                {rejectedAuditsList[0].customerRejectionReason && (
                  <div className="text-[11px] font-bold text-rose-700 mt-1">
                    Feedback for {rejectedAuditsList[0].customerName}: &ldquo;{rejectedAuditsList[0].customerRejectionReason}&rdquo;
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleStartRevisingAudit(rejectedAuditsList[0])}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reopen &amp; Revise Bill #{rejectedAuditsList[0].billId || rejectedAuditsList[0].id}</span>
            </button>
          </div>
        );
      })()}

      {/* Official Field Auditor Identity Badge Card */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-xl border border-cyan-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-600/30 border-2 border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-900/40 shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base sm:text-lg font-black text-white tracking-tight">
                {currentAuditorProfile?.fullName || auditor?.fullName || user?.name || 'Field Auditor'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                OFFICIAL AUDITOR
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  currentAuditorProfile?.status === 'INACTIVE'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                ● {currentAuditorProfile?.status || 'ACTIVE'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-bold">Auditor ID:</span>
                <span className="font-mono font-black text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-700/60">
                  {currentAuditorProfile?.id || auditor?.id || user?.auditorId || 'AUD-001'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-bold">Mobile:</span>
                <span className="font-mono font-black text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  +91 {currentAuditorProfile?.mobile || auditor?.mobile || user?.mobile || '9876500001'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>{currentAuditorProfile?.assignedZone || 'Central Ranchi (Zone A)'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
          <div className="text-left md:text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Route</div>
            <div className="text-sm font-black text-cyan-300 font-mono">
              {currentAuditorProfile?.assignedCustomerIds?.length || 0} Household{(currentAuditorProfile?.assignedCustomerIds?.length || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={() => setIsAddHouseModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-cyan-900/40 transition cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Enroll House</span>
          </button>
        </div>
      </div>

      {/* Top Navigation & Household Selection */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-4 z-50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-700 flex items-center justify-center text-white shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black text-slate-900 tracking-tight leading-tight">
                {currentAuditorProfile?.fullName || auditor?.fullName || 'Field Officer'}
              </h2>
              <span className="font-mono text-[10px] font-black text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                {currentAuditorProfile?.id || 'AUD-001'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-bold">
              📞 +91 {currentAuditorProfile?.mobile || auditor?.mobile || user?.mobile || '9876500001'} • {customers.length} House{customers.length !== 1 ? 's' : ''} in route
            </p>
          </div>
        </div>

        {/* HOUSEHOLD SELECTOR DROPDOWN & ADD BUTTON */}
        <div className="flex-1 w-full max-w-lg flex items-center gap-2">
          <div className="relative group flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Building className="w-4 h-4 text-slate-400 group-focus-within:text-cyan-600" />
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-50 transition appearance-none cursor-pointer"
            >
              <option value="">-- SELECT HOUSEHOLD ({customers.length} {showAllHouses ? 'total' : 'in route'}) --</option>
              {customers.map((c) => {
                const hasRejected = allAudits.some(
                  (a) =>
                    a.customerId === c.id &&
                    (a.status === 'CUSTOMER_REJECTED' ||
                      a.status === 'DISPUTED' ||
                      a.billStatus === 'CUSTOMER_REJECTED' ||
                      a.billStatus === 'DISPUTED')
                );
                return (
                  <option key={c.id} value={c.id}>
                    {c.id} - {c.fullName} (+91 {c.mobile}){hasRejected ? ' ⚠️ [REJECTED BILL - REVISION NEEDED]' : ''}
                  </option>
                );
              })}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <button
            onClick={() => setIsAddHouseModalOpen(true)}
            className="px-3 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-cyan-100 transition shrink-0 cursor-pointer"
            title="Register New Household or Assign to Route"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ House</span>
          </button>

          <button
            onClick={() => {
              const next = !showAllHouses;
              setShowAllHouses(next);
              let filtered = allRegisteredCustomers;
              if (!next && currentAuditorProfile && Array.isArray(currentAuditorProfile.assignedCustomerIds) && currentAuditorProfile.assignedCustomerIds.length > 0) {
                filtered = allRegisteredCustomers.filter((c) => currentAuditorProfile.assignedCustomerIds?.includes(c.id));
              }
              setCustomers(filtered);
              if (filtered.length > 0 && !filtered.some((c) => c.id === selectedCustomerId)) {
                setSelectedCustomerId(filtered[0].id);
              }
            }}
            className={`px-2.5 py-2.5 rounded-xl text-[11px] font-bold border transition shrink-0 cursor-pointer ${
              showAllHouses
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title={showAllHouses ? 'Click to show only assigned route' : 'Click to show all registered houses'}
          >
            {showAllHouses ? 'All' : 'Route'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('inspect')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'inspect' ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-100' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Inspect</span>
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'scheduled' ? 'bg-amber-600 text-white shadow-lg shadow-amber-100' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Schedule</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('pantryPay');
              fetchPantryPayRecords();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'pantryPay' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Pantry Limit History</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'history' ? 'bg-purple-700 text-white shadow-lg shadow-purple-100' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Bills</span>
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'returns' ? 'bg-rose-700 text-white shadow-lg shadow-rose-100' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Return Orders ({auditorReturns.length})</span>
          </button>
        </div>
      </div>

      {/* Main Working Area Content */}
      {!selectedCustomerId && activeTab !== 'scheduled' && activeTab !== 'history' && activeTab !== 'returns' ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center space-y-4 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-cyan-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-cyan-50/50 text-cyan-600">
            <Building className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900">No Household Selected</h3>
            <p className="text-slate-500 max-w-md mx-auto text-xs font-medium">
              Select an assigned household above, or click below to enroll a new house / link any registered household to your audit route.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsAddHouseModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-100 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Register / Link Household</span>
            </button>
            <button
              onClick={() => {
                setShowAllHouses(true);
                setCustomers(allRegisteredCustomers);
                if (allRegisteredCustomers.length > 0) {
                  setSelectedCustomerId(allRegisteredCustomers[0].id);
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition cursor-pointer"
            >
              <span>Browse All Registered Houses ({allRegisteredCustomers.length})</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: ACTIVE PHYSICAL INSPECTION */}
          {activeTab === 'inspect' && selectedCustomerId && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
              {/* Left Column: Fixed Customer Profile */}
              <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="space-y-3 pb-4 border-b border-slate-100 text-center">
                    <div className="w-16 h-16 bg-cyan-50 rounded-full flex items-center justify-center mx-auto text-cyan-600">
                      <User className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg leading-tight">{selectedCustomer?.fullName}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Household ID: {selectedCustomer?.id}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-xs">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <span className="text-slate-600 font-medium">{selectedCustomer?.address}, {selectedCustomer?.city}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-600 font-medium">+91 {selectedCustomer?.mobile}</span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] text-purple-600 font-black uppercase tracking-wider">Credit Limit</p>
                        <p className="text-base font-black text-purple-900">₹{selectedCustomer?.availablePantryLimit}</p>
                      </div>
                      <Zap className="w-6 h-6 text-purple-300" />
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] text-emerald-600 font-black uppercase tracking-wider">Wallet</p>
                        <p className="text-base font-black text-emerald-900">₹{selectedCustomer?.walletBalance}</p>
                      </div>
                      <Wallet className="w-6 h-6 text-emerald-300" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Physical Inventory Checklist */}
              <div className="lg:col-span-3 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                {/* Selected Customer Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">{selectedCustomer?.fullName}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800">
                        {selectedCustomer?.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedCustomer?.address}, {selectedCustomer?.city}, {selectedCustomer?.state} -{' '}
                      {selectedCustomer?.pinCode}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl text-right">
                      <div className="text-[10px] text-purple-600 font-semibold uppercase">Pantry Limit</div>
                      <div className="text-sm font-black text-purple-900">
                        ₹{selectedCustomer?.availablePantryLimit} / ₹{selectedCustomer?.pantryLimit}
                      </div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-right">
                      <div className="text-[10px] text-emerald-700 font-semibold uppercase flex items-center justify-end gap-1">
                        <Wallet className="w-3 h-3" /> Customer Wallet
                      </div>
                      <div className="text-sm font-black text-emerald-900">
                        ₹{selectedCustomer?.walletBalance ?? customerWallet?.walletBalance ?? 1000}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5-BOX INTERACTIVE PANTRY CREDIT & STOCK VALUE BREAKDOWN (Click to Inspect Items) */}
                {selectedCustomer && (() => {
                  const approvedLimit = selectedCustomer.pantryLimit || 0;
                  const activeStockItems = pantryItems.filter((i) => (i.quantity || 0) > 0 && i.status !== 'RETURNED');
                  const stockValuation = activeStockItems.reduce((acc, item) => acc + (item.quantity || 0) * (item.unitPrice || 0), 0);
                  const inTransitPantryOrders = customerOrders.filter(
                    (o) =>
                      (o.orderType === 'PANTRY' || (o as any).type === 'PANTRY') &&
                      ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(
                        (((o.orderStatus || (o as any).status) || '').toUpperCase())
                      )
                  );
                  const inTransitOrdersValue = inTransitPantryOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
                  const effectiveUsedLimit = stockValuation + inTransitOrdersValue;
                  const closingAvailableLimit = Math.max(0, approvedLimit - effectiveUsedLimit);

                  return (
                    <div
                      style={{
                        backgroundColor: currentTheme.surfaceDark,
                        borderColor: currentTheme.surfaceDarkBorder,
                      }}
                      className="text-white rounded-2xl p-3.5 sm:p-4 border shadow-md space-y-3"
                    >
                      <div
                        style={{ borderColor: currentTheme.surfaceDarkBorder }}
                        className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentTheme.primary }} />
                          <span className="text-xs font-black text-slate-200">
                            Revolving Credit Line &amp; Stock Value Live Breakdown
                          </span>
                          <span
                            style={{
                              backgroundColor: currentTheme.menuBg,
                              borderColor: currentTheme.menuBorder,
                              color: currentTheme.menuItemText,
                            }}
                            className="text-[10px] border px-2 py-0.5 rounded-full font-semibold"
                          >
                            Click any box for item-wise list
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Formula: Approved - (Home Stock + In Transit) = Available
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-left">
                        {/* 1. Approved Limit */}
                        <button
                          type="button"
                          onClick={() => setMetricModalTab('APPROVED')}
                          style={{
                            backgroundColor: currentTheme.menuBg,
                            borderColor: currentTheme.menuBorder,
                          }}
                          className="hover:opacity-95 p-2.5 rounded-xl border transition text-left cursor-pointer group"
                        >
                          <div className="text-[10px] text-purple-300 font-bold uppercase truncate flex items-center justify-between">
                            <span>1. Approved Limit</span>
                            <span className="text-[9px] opacity-0 group-hover:opacity-100 text-purple-300 font-normal">View ↗</span>
                          </div>
                          <div className="text-base font-black text-white mt-1">
                            ₹{approvedLimit.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5">Admin sanctioned credit</div>
                        </button>

                        {/* 2. Home Stock Value */}
                        <button
                          type="button"
                          onClick={() => setMetricModalTab('HOME_STOCK')}
                          className="bg-amber-950/40 hover:bg-amber-950/60 p-2.5 rounded-xl border border-amber-600/40 hover:border-amber-400 transition text-left cursor-pointer group"
                        >
                          <div className="text-[10px] text-amber-300 font-bold uppercase truncate flex items-center justify-between">
                            <span>2. Home Stock Value</span>
                            <span className="text-[9px] opacity-0 group-hover:opacity-100 text-amber-300 font-normal">View ↗</span>
                          </div>
                          <div className="text-base font-black text-amber-300 mt-1">
                            ₹{stockValuation.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[9px] text-amber-200/70 mt-0.5">
                            {activeStockItems.length} active products
                          </div>
                        </button>

                        {/* 3. In-Transit Orders */}
                        <button
                          type="button"
                          onClick={() => setMetricModalTab('IN_TRANSIT')}
                          className="bg-blue-950/40 hover:bg-blue-950/60 p-2.5 rounded-xl border border-blue-600/40 hover:border-blue-400 transition text-left cursor-pointer group"
                        >
                          <div className="text-[10px] text-blue-300 font-bold uppercase truncate flex items-center justify-between">
                            <span>3. In-Transit Orders</span>
                            <span className="text-[9px] opacity-0 group-hover:opacity-100 text-blue-300 font-normal">View ↗</span>
                          </div>
                          <div className="text-base font-black text-blue-300 mt-1">
                            ₹{inTransitOrdersValue.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[9px] text-blue-200/70 mt-0.5">
                            {inTransitPantryOrders.length} orders dispatched
                          </div>
                        </button>

                        {/* 4. Total Used */}
                        <button
                          type="button"
                          onClick={() => setMetricModalTab('TOTAL_USED')}
                          className="bg-rose-950/40 hover:bg-rose-950/60 p-2.5 rounded-xl border border-rose-600/40 hover:border-rose-400 transition text-left cursor-pointer group"
                        >
                          <div className="text-[10px] text-rose-300 font-bold uppercase truncate flex items-center justify-between">
                            <span>4. Total Used (2+3)</span>
                            <span className="text-[9px] opacity-0 group-hover:opacity-100 text-rose-300 font-normal">View ↗</span>
                          </div>
                          <div className="text-base font-black text-rose-300 mt-1">
                            ₹{effectiveUsedLimit.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[9px] text-rose-200/70 mt-0.5">Stock + In-Transit</div>
                        </button>

                        {/* 5. Closing Available */}
                        <button
                          type="button"
                          onClick={() => setMetricModalTab('AVAILABLE')}
                          className="col-span-2 sm:col-span-1 bg-emerald-950/50 hover:bg-emerald-950/70 p-2.5 rounded-xl border border-emerald-500/50 hover:border-emerald-400 transition text-left cursor-pointer group"
                        >
                          <div className="text-[10px] text-emerald-300 font-bold uppercase truncate flex items-center justify-between">
                            <span>5. Closing Available</span>
                            <span className="text-[9px] opacity-0 group-hover:opacity-100 text-emerald-300 font-normal">View ↗</span>
                          </div>
                          <div className="text-base font-black text-emerald-400 mt-1">
                            ₹{closingAvailableLimit.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[9px] text-emerald-200/70 mt-0.5">Current order limit</div>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Permission Status Banner */}
                {(() => {
                  const currentCustomerAudit = allAudits.find(
                    (a) => a.customerId === selectedCustomerId && a.status !== 'COMPLETED'
                  );
                  const isPermissionGranted = currentCustomerAudit
                    ? currentCustomerAudit.isPermissionGranted ||
                      currentCustomerAudit.status === 'CUSTOMER_CONFIRMED' ||
                      !!currentCustomerAudit.customerConfirmedAt
                    : false;

                  return isPermissionGranted ? (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2 font-bold">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <span>Customer Inspection Permission Confirmed</span>
                          <div className="text-[10px] font-mono text-emerald-700 font-semibold">
                            Confirmed at: {currentCustomerAudit?.customerConfirmedAt || currentCustomerAudit?.customerConfirmedDate || 'Recorded'}
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-600 text-white font-extrabold text-[10px] rounded-lg">
                        UNLOCKED
                      </span>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-start gap-2">
                        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-amber-950 font-black">
                            🔒 Customer Confirmation &amp; Permission Pending
                          </strong>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Customer must confirm and grant inspection permission from their Customer Portal before you can review items or generate the Audit Bill.
                          </p>
                        </div>
                      </div>

                      {currentCustomerAudit && (
                        <button
                          type="button"
                          onClick={() => handleStartAudit(currentCustomerAudit.id)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg transition shrink-0 cursor-pointer"
                        >
                          Check Status
                        </button>
                      )}
                    </div>
                  );
                })()}



                {/* PANTRY ITEMS INSPECTION & SETTLEMENT WORKSPACE CONTAINER */}
                <div
                  className={
                    isInspectionMaximized
                      ? 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 flex flex-col justify-center items-center overflow-hidden animate-in fade-in duration-200'
                      : 'space-y-4'
                  }
                >
                  <div
                    className={
                      isInspectionMaximized
                        ? 'bg-slate-50 border border-slate-300 rounded-3xl w-full h-full max-w-[98vw] max-h-[96vh] flex flex-col shadow-2xl overflow-hidden text-slate-900'
                        : 'space-y-4'
                    }
                  >
                    {/* Fullscreen Modal Header (Visible only when maximized) */}
                    {isInspectionMaximized && (
                      <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white p-3.5 sm:px-6 flex items-center justify-between border-b border-cyan-800/40 shrink-0 shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                            <ClipboardCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm sm:text-base font-black text-white">
                                Full-Screen Pantry Inspection &amp; Audit Settlement Workspace
                              </h3>
                              <span className="bg-cyan-500/30 text-cyan-200 border border-cyan-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Maximized View
                              </span>
                            </div>
                            <p className="text-xs text-cyan-200/80 mt-0.5">
                              Customer: <strong>{selectedCustomer?.fullName}</strong> • ID: <strong>{selectedCustomer?.id}</strong> • Mobile: {selectedCustomer?.mobile}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsInspectionMaximized(false)}
                            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/20 shadow-xs"
                            title="Restore to standard view"
                          >
                            <Minimize2 className="w-4 h-4 text-cyan-300" />
                            <span>Minimize / Restore</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsInspectionMaximized(false)}
                            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Content Body (Scrollable in maximized view) */}
                    <div className={isInspectionMaximized ? 'p-4 sm:p-6 overflow-y-auto flex-1 space-y-4' : 'space-y-4'}>
                      
                      {/* Maximize Toggle Banner (Visible in standard view) */}
                      {!isInspectionMaximized && (
                        <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white p-3 rounded-2xl border border-cyan-700/40 flex items-center justify-between shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                              <Maximize2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-black text-white flex items-center gap-1.5">
                                <span>Pantry Inspection &amp; Settlement Workspace</span>
                                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                  Window Mode
                                </span>
                              </div>
                              <div className="text-[10px] text-cyan-200/80">
                                Active stock, product images, settlement recommendations, and sign-off in a full size window.
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsInspectionMaximized(true)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Open Full Size Window</span>
                          </button>
                        </div>
                      )}

                      {/* Live Summary Bar */}
                      {pantryItems.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center text-xs">
                          <div>
                            <div className="text-slate-400 text-[10px]">Total Items</div>
                            <div className="text-base font-bold text-slate-900">{totalChecked}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 text-[10px]">Missing / Not Available</div>
                            <div className="text-base font-bold text-slate-700">{missingCountTotal}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 text-[10px]">Damaged / Expired</div>
                            <div className="text-base font-bold text-rose-600">{damagedCountTotal}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 text-[10px]">Wallet Deduction</div>
                            <div className="text-base font-bold text-rose-700">₹{estimatedWalletDeduction}</div>
                          </div>
                        </div>
                      )}

                      {/* Sub-tab switcher: Active Stock vs Used History Box */}
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                        <button
                          onClick={() => setPantrySubTab('active')}
                          className={`flex-1 py-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            pantrySubTab === 'active'
                              ? 'bg-cyan-700 text-white shadow-xs'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>Active Stock</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-100 text-cyan-900 font-black">
                            {pantryItems.filter((i) => i.quantity > 0).length}
                          </span>
                        </button>

                        <button
                          onClick={() => setPantrySubTab('used')}
                          className={`flex-1 py-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            pantrySubTab === 'used'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>Used History</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-900 font-black">
                            {pantryItems.filter((i) => i.quantity === 0).length}
                          </span>
                        </button>

                        <button
                          onClick={() => setPantrySubTab('ledger')}
                          className={`flex-1 py-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            pantrySubTab === 'ledger'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>Pantry Limit History</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-900 font-black">
                            {customerLedger.length}
                          </span>
                        </button>
                      </div>

                      {/* Physical Verification Items List */}
                      <form onSubmit={handleSubmitAudit} className="space-y-4">
                  {(() => {
                    if (pantrySubTab === 'ledger') {
                      const filteredPantryPayments = pantryPayments.filter(p => p.customerId === selectedCustomerId);
                      return (
                        <div className="space-y-6">
                          {/* 1. PANTRY CREDIT RESTORE LEDGER */}
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                                <ArrowUpDown className="w-5 h-5 text-emerald-600" />
                                Pantry Credit Restore History
                              </h3>
                              <span className="px-2.5 py-1 bg-emerald-600 text-white font-black text-[10px] rounded-lg shadow-sm uppercase tracking-wider">
                                CREDIT LIMIT
                              </span>
                            </div>
                            
                            <div className="overflow-hidden border border-emerald-100 rounded-lg shadow-xs bg-white">
                              <table className="w-full text-xs">
                                <thead className="bg-emerald-100 text-emerald-900 uppercase font-black tracking-wider text-[10px]">
                                  <tr>
                                    <th className="py-2.5 px-3 text-left">Date</th>
                                    <th className="py-2.5 px-3 text-left">Description</th>
                                    <th className="py-2.5 px-3 text-right">Amount</th>
                                    <th className="py-2.5 px-3 text-right">Final Limit</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-50">
                                  {customerLedger.length === 0 ? (
                                    <tr>
                                      <td colSpan={4} className="py-10 text-center text-slate-400">No credit restore records.</td>
                                    </tr>
                                  ) : (
                                    customerLedger.map((l) => (
                                      <tr key={l.id} className="hover:bg-emerald-50/50 transition">
                                        <td className="py-3 px-3">
                                          <div className="font-mono text-[10px] text-slate-500">{new Date(l.createdAt).toLocaleDateString()}</div>
                                          <div className="text-[9px] text-slate-400">{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="font-bold text-slate-900 capitalize">{l.transactionType.replace(/_/g, ' ').toLowerCase()}</div>
                                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{l.description}</div>
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                          <div className="font-black text-emerald-600">+₹{l.amount}</div>
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                          <div className="font-black text-slate-800">₹{l.closingLimit}</div>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* 2. PANTRY PAY HISTORY (DIRECT PAYMENTS) */}
                          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-bold text-cyan-900 flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-cyan-600" />
                                Pantry Pay (Direct UPI/Bank) History
                              </h3>
                              <span className="px-2.5 py-1 bg-cyan-600 text-white font-black text-[10px] rounded-lg shadow-sm uppercase tracking-wider">
                                DIRECT PAY
                              </span>
                            </div>

                            <div className="overflow-hidden border border-cyan-100 rounded-lg shadow-xs bg-white">
                              <table className="w-full text-xs">
                                <thead className="bg-cyan-100 text-cyan-900 uppercase font-black tracking-wider text-[10px]">
                                  <tr>
                                    <th className="py-2.5 px-3 text-left">Date & ID</th>
                                    <th className="py-2.5 px-3 text-left">Product</th>
                                    <th className="py-2.5 px-3 text-right">Amount</th>
                                    <th className="py-2.5 px-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-cyan-50">
                                  {filteredPantryPayments.length === 0 ? (
                                    <tr>
                                      <td colSpan={4} className="py-10 text-center text-slate-400">No direct payment records.</td>
                                    </tr>
                                  ) : (
                                    filteredPantryPayments.map((p) => (
                                      <tr key={p.id} className="hover:bg-cyan-50/50 transition">
                                        <td className="py-3 px-3">
                                          <div className="font-mono text-slate-900 font-bold">{p.id}</div>
                                          <div className="text-[9px] text-slate-400">{p.createdAt}</div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="font-bold text-slate-900">{p.productName}</div>
                                          <div className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 inline-block mt-1 font-sans">
                                            {p.paymentMethod}
                                          </div>
                                        </td>
                                        <td className="py-3 px-3 text-right font-black text-cyan-700 font-mono">₹{p.amount}</td>
                                        <td className="py-3 px-3 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                            p.paymentStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {p.paymentStatus}
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* 3. WALLET TRANSACTION HISTORY */}
                          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-indigo-600" />
                                Wallet Transaction History
                              </h3>
                              <span className="px-2.5 py-1 bg-indigo-600 text-white font-black text-[10px] rounded-lg shadow-sm uppercase tracking-wider">
                                WALLET
                              </span>
                            </div>

                            <div className="overflow-hidden border border-indigo-100 rounded-lg shadow-xs bg-white">
                              <table className="w-full text-xs">
                                <thead className="bg-indigo-100 text-indigo-900 uppercase font-black tracking-wider text-[10px]">
                                  <tr>
                                    <th className="py-2.5 px-3 text-left">Date & ID</th>
                                    <th className="py-2.5 px-3 text-left">Type & Reason</th>
                                    <th className="py-2.5 px-3 text-right">Amount</th>
                                    <th className="py-2.5 px-3 text-right">Balance</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-indigo-50">
                                  {walletHistory.length === 0 ? (
                                    <tr>
                                      <td colSpan={4} className="py-10 text-center text-slate-400">No wallet records.</td>
                                    </tr>
                                  ) : (
                                    walletHistory.map((w) => (
                                      <tr key={w.id} className="hover:bg-indigo-50/50 transition">
                                        <td className="py-3 px-3">
                                          <div className="font-mono text-slate-900 font-bold">{w.id}</div>
                                          <div className="text-[9px] text-slate-400">{w.date} {w.time}</div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${w.amount > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                            <span className="font-bold text-slate-800 uppercase text-[10px] tracking-tight">{w.transactionType}</span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{w.reason}</div>
                                        </td>
                                        <td className={`py-3 px-3 text-right font-black font-mono ${w.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {w.amount > 0 ? '+' : ''}₹{Math.abs(w.amount)}
                                        </td>
                                        <td className="py-3 px-3 text-right font-bold text-slate-700 font-mono">₹{w.newBalance}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const currentList = pantryItems.filter((i) => {
                      const matchesTab = pantrySubTab === 'active' ? i.quantity > 0 : i.quantity === 0;
                      const q = (productSearchText || searchQuery).toLowerCase();
                      const matchesSearch = !q || (i.productName || '').toLowerCase().includes(q) || (i.barcode || '').includes(q) || (i.batchNumber || '').toLowerCase().includes(q);

                      const current = itemStatuses[i.id];
                      const hasDiscrepancy = current && (
                        current.qtyMissing > 0 ||
                        current.qtyDamaged > 0 ||
                        current.qtyReturn > 0 ||
                        current.qtyReplacement > 0 ||
                        current.qtyPantryPay > 0
                      );

                      if (productStatusFilter === 'DISCREPANCY') {
                        return matchesTab && matchesSearch && hasDiscrepancy;
                      }
                      if (productStatusFilter === 'MISSING') {
                        return matchesTab && matchesSearch && current && current.qtyMissing > 0;
                      }
                      if (productStatusFilter === 'DAMAGED') {
                        return matchesTab && matchesSearch && current && (current.qtyDamaged > 0 || current.qtyReturn > 0);
                      }
                      if (productStatusFilter === 'OK') {
                        return matchesTab && matchesSearch && current && !hasDiscrepancy;
                      }

                      return matchesTab && matchesSearch;
                    });

                    if (currentList.length === 0 && pantryItems.filter(i => pantrySubTab === 'active' ? i.quantity > 0 : i.quantity === 0).length === 0) {
                      return (
                        <div className="py-12 text-center text-slate-400">
                          <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-700">
                            {pantrySubTab === 'active'
                              ? 'No active pantry items to audit'
                              : 'No used history items found'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {pantrySubTab === 'active'
                              ? 'This customer has no stock in their physical pantry.'
                              : 'Used items will appear here once their quantity reaches 0.'}
                          </p>
                        </div>
                      );
                    }

                    const rawActiveCount = pantryItems.filter(i => pantrySubTab === 'active' ? i.quantity > 0 : i.quantity === 0).length;

                    return (
                      <div className="space-y-4">
                        {/* REVISION IN-PROGRESS ALERT BANNER */}
                        {revisingAudit && (
                          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 shadow-sm space-y-2 animate-in slide-in-from-top-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                                <div>
                                  <h4 className="font-black text-sm text-amber-950">
                                    Revising Audit Bill #{revisingAudit.billId || revisingAudit.id} (Version {revisingAudit.billVersion || 1})
                                  </h4>
                                  <p className="text-xs text-amber-800">
                                    Customer requested corrections. All previously filled input boxes and reduced quantities are preserved below. Re-adjust any values and submit.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Cancel revising this bill and reset all fields?')) {
                                    setRevisingAudit(null);
                                    fetchCustomersAndPastAudits();
                                  }
                                }}
                                className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-lg text-xs font-bold transition cursor-pointer self-start sm:self-auto"
                              >
                                Cancel Revision
                              </button>
                            </div>
                            {revisingAudit.customerRejectionReason && (
                              <div className="p-2.5 bg-white border border-amber-200 rounded-lg text-xs text-slate-800">
                                <strong className="text-rose-700">Customer Rejection Reason:</strong> &ldquo;{revisingAudit.customerRejectionReason}&rdquo;
                                {revisingAudit.customerRejectedDate && (
                                  <span className="text-[10px] text-slate-400 ml-2">
                                    ({revisingAudit.customerRejectedDate} {revisingAudit.customerRejectedTime || ''})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* TOP SECTION: Full-Width Audit Settlement Summary */}
                        <div
                          style={{
                            backgroundColor: currentTheme.surfaceDark,
                            borderColor: currentTheme.surfaceDarkBorder,
                          }}
                          className="rounded-xl p-4 text-white shadow-lg border space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <ClipboardCheck className="w-5 h-5" style={{ color: currentTheme.primary }} />
                              <div>
                                <h3 className="text-sm font-bold tracking-tight">Audit Settlement Summary</h3>
                                <p className="text-[10px] text-slate-300">Live doorstep reconciliation &amp; bill calculation</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPdfReportAudit(revisingAudit || null);
                                  setShowPdfReportModal(true);
                                }}
                                style={{
                                  backgroundColor: currentTheme.primary,
                                  color: currentTheme.textOnPrimary,
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs hover:opacity-90"
                                title="Download PDF of all data filled by auditor"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Download PDF Report</span>
                              </button>
                              <span
                                style={{
                                  backgroundColor: currentTheme.menuBg,
                                  borderColor: currentTheme.menuBorder,
                                  color: currentTheme.menuItemText,
                                }}
                                className="text-[10px] font-mono px-2 py-1 rounded-md border"
                              >
                                Live Calculation
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                            <div style={{ backgroundColor: currentTheme.menuBg, borderColor: currentTheme.menuBorder }} className="p-2.5 rounded-lg border">
                              <p className="text-[10px] opacity-80 font-bold uppercase mb-0.5">Wallet Deduct</p>
                              <p className="text-lg font-black text-rose-400">₹{estimatedWalletDeduction}</p>
                            </div>
                            <div style={{ backgroundColor: currentTheme.menuBg, borderColor: currentTheme.menuBorder }} className="p-2.5 rounded-lg border">
                              <p className="text-[10px] opacity-80 font-bold uppercase mb-0.5">Limit Restore</p>
                              <p className="text-lg font-black text-emerald-400">₹{estimatedCreditRestore}</p>
                            </div>
                            <div style={{ backgroundColor: currentTheme.menuBg, borderColor: currentTheme.menuBorder }} className="p-2.5 rounded-lg border">
                              <p className="text-[10px] opacity-80 font-bold uppercase mb-0.5">Missing Qty</p>
                              <p className="text-base font-black text-amber-400">{missingCountTotal} Items</p>
                            </div>
                            <div style={{ backgroundColor: currentTheme.menuBg, borderColor: currentTheme.menuBorder }} className="p-2.5 rounded-lg border">
                              <p className="text-[10px] opacity-80 font-bold uppercase mb-0.5">Returns Qty</p>
                              <p className="text-base font-black text-orange-400">{returnCountTotal} Items</p>
                            </div>
                            <div style={{ backgroundColor: currentTheme.menuBg, borderColor: currentTheme.menuBorder }} className="p-2.5 rounded-lg border">
                              <p className="text-[10px] opacity-80 font-bold uppercase mb-0.5">Replacements</p>
                              <p className="text-base font-black text-indigo-400">{replacementCountTotal} Items</p>
                            </div>
                            <div style={{ backgroundColor: currentTheme.menuBg, borderColor: currentTheme.menuBorder }} className="p-2.5 rounded-lg border">
                              <p className="text-[10px] opacity-80 font-bold uppercase mb-0.5">Pantry Pay</p>
                              <p className="text-base font-black text-cyan-400">{pantryPayCountTotal} Items</p>
                            </div>
                          </div>
                        </div>

                        {/* MIDDLE SECTION: Full-Width Product Items List & Controls */}
                        <div className="space-y-3">
                          {/* Dedicated Products Toolbar & Side Scroll Handles */}
                          <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                <span>Pantry Items</span>
                                <span className="bg-white text-slate-700 text-[11px] font-mono px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                  {currentList.length} of {rawActiveCount}
                                </span>
                              </span>

                              {/* Quick Filter Buttons */}
                              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => setProductStatusFilter('ALL')}
                                  className={`px-2 py-0.5 rounded-md transition ${productStatusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                  All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setProductStatusFilter('DISCREPANCY')}
                                  className={`px-2 py-0.5 rounded-md transition ${productStatusFilter === 'DISCREPANCY' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:text-amber-700'}`}
                                >
                                  Discrepancies
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setProductStatusFilter('MISSING')}
                                  className={`px-2 py-0.5 rounded-md transition ${productStatusFilter === 'MISSING' ? 'bg-rose-500 text-white' : 'text-slate-500 hover:text-rose-700'}`}
                                >
                                  Missing
                                </button>
                              </div>
                            </div>

                            {/* Product Search & Dedicated Scroll Buttons */}
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              {/* Local Stock Search */}
                              <div className="relative flex-1 sm:flex-initial">
                                <Search className="w-3.5 h-3.5 text-amber-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  placeholder="Local Stock Search..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="w-full sm:w-36 pl-8 pr-6 py-1 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold placeholder-amber-500/50"
                                />
                                {searchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Filter Products */}
                              <div className="relative flex-1 sm:flex-initial">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  placeholder="Filter products..."
                                  value={productSearchText}
                                  onChange={(e) => setProductSearchText(e.target.value)}
                                  className="w-full sm:w-36 pl-8 pr-6 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                                />
                                {productSearchText && (
                                  <button
                                    type="button"
                                    onClick={() => setProductSearchText('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Simple List Total Indicator */}
                              <div className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 shrink-0">
                                {currentList.length} {currentList.length === 1 ? 'Item' : 'Items'} Found
                              </div>
                            </div>
                          </div>

                          {/* Dedicated Scrollable Product Cards Viewport */}
                          <div
                            ref={productsScrollRef}
                            className="w-full focus:outline-none"
                          >
                            {currentList.length === 0 ? (
                              <div className="py-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <Search className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                                <p className="font-semibold text-slate-600 text-xs">No products match the selected filter</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProductSearchText('');
                                    setProductStatusFilter('ALL');
                                  }}
                                  className="mt-2 text-xs font-bold text-cyan-600 hover:underline"
                                >
                                  Reset Filters
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {currentList.map((item, itemIdx) => {
                                  const current = itemStatuses[item.id] || {
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

                                  const itemVal = item.totalValue || item.unitPrice * item.quantity;
                                  const totalBreakdown = 
                                    current.qtyAvailable + 
                                    current.qtyMissing + 
                                    current.qtyDamaged + 
                                    current.qtyReturn + 
                                    current.qtyReplacement + 
                                    current.qtyPantryPay;
                                  const mismatch = totalBreakdown !== item.quantity;

                                  return (
                                    <div
                                      key={item.id}
                                      className={`rounded-xl border transition flex flex-col sm:flex-row bg-white overflow-hidden shadow-xs hover:border-cyan-300 ${
                                        current.qtyMissing > 0
                                          ? 'border-amber-300 bg-amber-50/10'
                                          : current.qtyDamaged > 0
                                          ? 'border-rose-200 bg-rose-50/10'
                                          : 'border-slate-200'
                                      }`}
                                    >
                                      {/* Left side: Large Product Image in Standard View */}
                                      <div 
                                        className="w-full sm:w-48 h-48 sm:h-auto bg-slate-50 border-r border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-zoom-in"
                                        onClick={() => setZoomedImage({
                                          src: item.image,
                                          title: item.productName,
                                          barcode: item.barcode,
                                          batchNumber: item.batchNumber,
                                          mfgDate: item.manufacturingDate,
                                          expDate: item.expiryDate
                                        })}
                                      >
                                        <ImageWithFallback 
                                          src={item.image} 
                                          alt={item.productName} 
                                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <span className="text-white text-[10px] font-bold bg-slate-900/90 px-2 py-1 rounded-md border border-slate-700 flex items-center gap-1 shadow">
                                            <Search className="w-3 h-3 text-cyan-400" />
                                            <span>Click to Zoom</span>
                                          </span>
                                        </div>
                                        <span className="absolute top-2 left-2 text-[10px] font-mono font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-700">
                                          #{itemIdx + 1}
                                        </span>
                                      </div>

                                      {/* Right side: All product information, status inputs & settlement fields */}
                                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                          <div className="space-y-2 flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <h4 className="font-black text-slate-900 text-sm leading-snug" title={item.productName}>
                                                {item.productName}
                                              </h4>
                                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                {item.brand} • {item.weightSize}
                                              </span>
                                              <span className="text-[10px] font-black text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                                                Qty: {item.quantity} × ₹{item.unitPrice} = ₹{itemVal}
                                              </span>
                                            </div>

                                            {/* Clean Specs & Delivery Strip (No heavy boxes, pure highlight color for Day Count) */}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 bg-slate-50/80 px-3 py-2 rounded-xl border border-slate-150">
                                              {/* Batch Number */}
                                              <div className="flex items-center gap-1">
                                                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-tight">Batch:</span>
                                                <span className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{item.batchNumber || 'N/A'}</span>
                                              </div>

                                              {/* Barcode */}
                                              <div className="flex items-center gap-1">
                                                <QrCode className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="font-mono text-slate-700 text-[11px]">{item.barcode || 'N/A'}</span>
                                              </div>

                                              {/* Mfg Date */}
                                              {item.manufacturingDate && (
                                                <div className="flex items-center gap-1 text-[11px]">
                                                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-tight">Mfg:</span>
                                                  <span className="font-mono text-slate-700">{item.manufacturingDate}</span>
                                                </div>
                                              )}

                                              {/* Expiry Date */}
                                              <div className="flex items-center gap-1 text-[11px]">
                                                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-tight">Exp:</span>
                                                <span className={`font-mono font-bold ${item.isExpired ? 'text-rose-600' : item.isNearExpiry ? 'text-amber-600' : 'text-slate-700'}`}>
                                                  {item.expiryDate || 'N/A'}
                                                  {item.isExpired && <span className="ml-1 text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-sans font-bold">EXP</span>}
                                                  {item.isNearExpiry && !item.isExpired && <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1 py-0.2 rounded font-sans font-bold">NEAR</span>}
                                                </span>
                                              </div>

                                              {/* Delivered Date & Live Day Count (Clean highlight text color, NO BOX) */}
                                              {(() => {
                                                const dayInfo = getDeliveryDayCount(item.deliveryDate);
                                                return (
                                                  <div className="flex items-center gap-1.5 text-[11px]">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="text-slate-500">Delivered:</span>
                                                    <span className="font-mono font-bold text-slate-800">{item.deliveryDate || 'N/A'}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                                                    <span className={`font-black ${dayInfo.daysRemaining <= 3 && dayInfo.isWithin15Days ? 'text-rose-600' : 'text-emerald-700'}`}>
                                                      {dayInfo.badgeLabel}
                                                    </span>
                                                    {dayInfo.isWithin15Days && (
                                                      <span className={`font-bold ${dayInfo.daysRemaining <= 3 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                        ({dayInfo.daysRemaining}d left)
                                                      </span>
                                                    )}
                                                    {!dayInfo.isWithin15Days && item.deliveryDate && (
                                                      <span className="font-bold text-slate-500">
                                                        ({dayInfo.dayNumber} days elapsed)
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          </div>
                                          
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const t = customerTimelines.find((x) => x.productId === item.productId);
                                              if (t) setSelectedTimeline(t);
                                            }}
                                            className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200 shrink-0 self-start mt-0.5"
                                          >
                                            <Clock className="w-3 h-3 text-cyan-600" />
                                            <span>Audit History</span>
                                          </button>
                                        </div>

                                        {/* Row of Inputs: Available, Missing, Damaged, Return, Replace, Pantry Pay */}
                                        {(() => {
                                          const matchingUsedItems = pantryItems.filter(
                                            (u) =>
                                              u.quantity === 0 &&
                                              u.barcode &&
                                              item.barcode &&
                                              u.barcode.trim().toLowerCase() === item.barcode.trim().toLowerCase()
                                          );
                                          const hasMatchingUsedBarcode = matchingUsedItems.length > 0;
                                          const selectedSwapId = current.selectedSwapUsedItemId || matchingUsedItems[0]?.id;
                                          const selectedUsedItem = matchingUsedItems.find((u) => u.id === selectedSwapId) || matchingUsedItems[0];

                                          return (
                                            <div className="space-y-2">
                                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-slate-50/80 p-2 rounded-lg border border-slate-200/50">
                                                <div className="space-y-0.5">
                                                  <label className="block text-[9px] font-black text-emerald-700 uppercase tracking-tighter">Available</label>
                                                  <input 
                                                    type="number"
                                                    readOnly
                                                    value={current.qtyAvailable}
                                                    className="w-full py-1 px-2 text-xs font-black border border-emerald-300 rounded-md bg-emerald-50 text-emerald-900 cursor-not-allowed shadow-inner"
                                                  />
                                                </div>
                                                <div className="space-y-0.5">
                                                  <label className="block text-[9px] font-black text-amber-700 uppercase tracking-tighter">Missing</label>
                                                  <input 
                                                    type="number"
                                                    value={current.qtyMissing}
                                                    onChange={(e) => handleQtyChange(item.id, 'qtyMissing', e.target.value)}
                                                    className="w-full py-1 px-2 text-xs font-bold border border-amber-300 rounded-md bg-white focus:ring-1 focus:ring-amber-500"
                                                  />
                                                </div>
                                                <div className="space-y-0.5">
                                                  <label className="block text-[9px] font-black text-rose-700 uppercase tracking-tighter">Damaged</label>
                                                  <input 
                                                    type="number"
                                                    value={current.qtyDamaged}
                                                    onChange={(e) => handleQtyChange(item.id, 'qtyDamaged', e.target.value)}
                                                    className="w-full py-1 px-2 text-xs font-bold border border-rose-300 rounded-md bg-white focus:ring-1 focus:ring-rose-500"
                                                  />
                                                </div>
                                                <div className="space-y-0.5">
                                                  <label className="block text-[9px] font-black text-orange-700 uppercase tracking-tighter">Return</label>
                                                  <input 
                                                    type="number"
                                                    value={current.qtyReturn}
                                                    onChange={(e) => handleQtyChange(item.id, 'qtyReturn', e.target.value)}
                                                    className="w-full py-1 px-2 text-xs font-bold border border-orange-300 rounded-md bg-white focus:ring-1 focus:ring-orange-500"
                                                  />
                                                </div>
                                                
                                                {/* Replace Box with strict Used History Barcode Matching & Green Indicator */}
                                                <div className="space-y-0.5">
                                                  <label className={`block text-[9px] font-black uppercase tracking-tighter flex items-center justify-between ${
                                                    hasMatchingUsedBarcode ? 'text-emerald-700 font-extrabold' : 'text-slate-400'
                                                  }`}>
                                                    <span>Replace</span>
                                                    {hasMatchingUsedBarcode ? (
                                                      <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-mono font-bold">MATCH</span>
                                                    ) : (
                                                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                                                    )}
                                                  </label>
                                                  {hasMatchingUsedBarcode ? (
                                                    <input 
                                                      type="number"
                                                      value={current.qtyReplacement}
                                                      onChange={(e) => handleQtyChange(item.id, 'qtyReplacement', e.target.value)}
                                                      className="w-full py-1 px-2 text-xs font-black border-2 border-emerald-500 rounded-md bg-emerald-50 text-emerald-950 focus:ring-2 focus:ring-emerald-500 shadow-xs"
                                                      placeholder="0"
                                                    />
                                                  ) : (
                                                    <input 
                                                      type="number"
                                                      disabled
                                                      readOnly
                                                      value={0}
                                                      title="Locked: Barcode must exist in Used History to enable replacement"
                                                      className="w-full py-1 px-2 text-xs font-bold border border-slate-200 rounded-md bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                                                    />
                                                  )}
                                                </div>

                                                <div className="space-y-0.5">
                                                  <label className="block text-[9px] font-black text-cyan-700 uppercase tracking-tighter">Pantry Pay</label>
                                                  <input 
                                                    type="number"
                                                    value={current.qtyPantryPay}
                                                    onChange={(e) => handleQtyChange(item.id, 'qtyPantryPay', e.target.value)}
                                                    className="w-full py-1 px-2 text-xs font-bold border border-cyan-300 rounded-md bg-white focus:ring-1 focus:ring-cyan-500"
                                                  />
                                                </div>
                                              </div>

                                              {/* Visual Feedback for Barcode Match & Batch Swap Preview */}
                                              {hasMatchingUsedBarcode && (
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs space-y-1.5">
                                                  <div className="flex items-center justify-between flex-wrap gap-1">
                                                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                      <span>Barcode matched in Used History ({matchingUsedItems.length} Used {matchingUsedItems.length === 1 ? 'Record' : 'Records'} available for Batch Swap)</span>
                                                    </div>
                                                    {current.qtyReplacement > 0 && (
                                                      <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full shadow-2xs uppercase tracking-wide">
                                                        ⚡ Ready to Replace {current.qtyReplacement} Qty
                                                      </span>
                                                    )}
                                                  </div>

                                                  {/* Multiple Used Batches Selection Dropdown */}
                                                  {matchingUsedItems.length > 1 ? (
                                                    <div className="space-y-1 pt-1 border-t border-emerald-200/60">
                                                      <label className="block text-[10px] font-bold text-emerald-900">
                                                        Select Used History Batch to swap with Active Stock:
                                                      </label>
                                                      <select
                                                        value={selectedSwapId}
                                                        onChange={(e) => handleSelectedSwapUsedItemChange(item.id, e.target.value)}
                                                        className="w-full py-1 px-2 text-[11px] font-mono font-bold border-2 border-emerald-400 rounded-lg bg-white text-emerald-950 focus:ring-1 focus:ring-emerald-600"
                                                      >
                                                        {matchingUsedItems.map((u, uIdx) => (
                                                          <option key={u.id} value={u.id}>
                                                            #{uIdx + 1} Batch: {u.batchNumber || 'N/A'} | Mfg: {u.manufacturingDate || 'N/A'} | Exp: {u.expiryDate || 'N/A'} (Delivered: {u.deliveryDate || 'N/A'})
                                                          </option>
                                                        ))}
                                                      </select>
                                                    </div>
                                                  ) : (
                                                    selectedUsedItem && (
                                                      <div className="flex items-center gap-2 text-[10px] text-emerald-900 font-mono bg-white/80 px-2 py-1 rounded border border-emerald-200">
                                                        <span className="font-sans font-bold text-emerald-700">Target Swap:</span>
                                                        <span>Batch: <strong>{selectedUsedItem.batchNumber || 'N/A'}</strong></span>
                                                        <span>•</span>
                                                        <span>Mfg: <strong>{selectedUsedItem.manufacturingDate || 'N/A'}</strong></span>
                                                        <span>•</span>
                                                        <span>Exp: <strong>{selectedUsedItem.expiryDate || 'N/A'}</strong></span>
                                                      </div>
                                                    )
                                                  )}

                                                  {current.qtyReplacement > 0 && selectedUsedItem && (
                                                    <div className="text-[10px] text-emerald-800 bg-emerald-100/70 p-1.5 rounded border border-emerald-300 font-medium">
                                                      🔄 <strong>On Bill Confirmation:</strong> Active Stock (Batch: <strong>{item.batchNumber}</strong>, Mfg: {item.manufacturingDate}, Exp: {item.expiryDate}) will move to Used History, and Used Batch (<strong>{selectedUsedItem.batchNumber}</strong>, Mfg: {selectedUsedItem.manufacturingDate}, Exp: {selectedUsedItem.expiryDate}) will become Active Stock.
                                                    </div>
                                                  )}
                                                </div>
                                              )}

                                              {!hasMatchingUsedBarcode && (
                                                <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                                                  <Lock className="w-3 h-3 text-slate-400" />
                                                  <span>Replace is locked because this item&apos;s barcode ({item.barcode || 'N/A'}) has no matching records in Used History.</span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}

                                        {mismatch && (
                                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded border border-rose-100">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            <span>Mismatch Warning: The breakdown total ({totalBreakdown}) must equal original stock quantity ({item.quantity}).</span>
                                          </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                          <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">
                                              Settlement Recommendation
                                            </label>
                                            <select
                                              value={current.action}
                                              onChange={(e) => handleActionChange(item.id, e.target.value as any)}
                                              className="w-full py-1.5 px-2.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:outline-none bg-white font-medium text-slate-800"
                                            >
                                              <option value="NONE">No Special Action</option>
                                              {current.qtyMissing > 0 && <option value="WALLET_DEDUCTION">Process Wallet Deduction for Missing</option>}
                                              {current.qtyReturn > 0 && <option value="RETURN_INITIATED">Initiate Return for Surplus / Return Qty</option>}
                                              {current.qtyDamaged > 0 && <option value="RETURN_INITIATED">Initiate Return for Damaged</option>}
                                              {current.qtyReplacement > 0 && <option value="REPLACEMENT_INITIATED">Fresh Replacement for Item</option>}
                                              {current.qtyPantryPay > 0 && <option value="PANTRY_PAY">Confirm Consumption (Pantry Pay)</option>}
                                              {(current.qtyMissing > 0 || current.qtyDamaged > 0 || current.qtyReturn > 0 || current.qtyReplacement > 0 || current.qtyPantryPay > 0) && <option value="MIXED">Mixed Settlement Logic</option>}
                                            </select>
                                          </div>

                                          <div>
                                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">
                                              Inspection Notes
                                            </label>
                                            <input
                                              type="text"
                                              placeholder="Batch matched, physical verified..."
                                              value={current.remarks}
                                              onChange={(e) => handleRemarksChange(item.id, e.target.value)}
                                              className="w-full py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-cyan-500 text-slate-800 bg-white"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Footer Helper for Product List */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
                            <span>↕ Scroll inside product box to review all items</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => scrollProductsToEdge('top')}
                                className="text-cyan-700 hover:text-cyan-900 font-bold"
                              >
                                ↑ Top
                              </button>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => scrollProductsToEdge('bottom')}
                                className="text-cyan-700 hover:text-cyan-900 font-bold"
                              >
                                ↓ Bottom
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* BOTTOM SECTION: Full-Width Remarks, Signatures & Sign-Off */}
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                            Overall Observations &amp; Audit Verification Sign-Off
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Observations column */}
                            <div className="md:col-span-6 space-y-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Overall Field Observations &amp; Summary
                              </label>
                              <textarea
                                rows={3}
                                placeholder="Physical verification conducted at doorstep. All batch items cross-verified with master pantry records."
                                value={overallRemarks}
                                onChange={(e) => setOverallRemarks(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                              />
                            </div>

                            {/* Signatures checklist column */}
                            <div className="md:col-span-3 space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs flex flex-col justify-center">
                              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={auditorSignature}
                                  onChange={(e) => setAuditorSignature(e.target.checked)}
                                  className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                                />
                                <span className="text-[11px] leading-tight">Auditor Signature ({auditor?.fullName || user?.name})</span>
                              </label>

                              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={customerSignature}
                                  onChange={(e) => setCustomerSignature(e.target.checked)}
                                  className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                                />
                                <span className="text-[11px] leading-tight">Customer Sign-off ({selectedCustomer?.fullName})</span>
                              </label>
                            </div>

                            {/* Billing & Submission column */}
                            <div className="md:col-span-3 flex flex-col justify-between pt-1 md:pt-0">
                              <div className="flex justify-between items-center text-xs pb-2 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">Wallet To Be Billed:</span>
                                <span className="font-extrabold text-rose-700 text-base font-black">₹{estimatedWalletDeduction}</span>
                              </div>

                              <div className="pt-2">
                                {(() => {
                                  const currentCustomerAudit = allAudits.find(
                                    (a) => a.customerId === selectedCustomerId && a.status !== 'COMPLETED'
                                  );
                                  const isPermissionGranted =
                                    !!revisingAudit ||
                                    (currentCustomerAudit
                                      ? currentCustomerAudit.isPermissionGranted ||
                                        currentCustomerAudit.status === 'CUSTOMER_CONFIRMED' ||
                                        currentCustomerAudit.status === 'CUSTOMER_REJECTED' ||
                                        currentCustomerAudit.status === 'DISPUTED' ||
                                        !!currentCustomerAudit.customerConfirmedAt
                                      : false);

                                  if (!isPermissionGranted) {
                                    return (
                                      <div className="p-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-[10px] font-bold flex items-center gap-1.5 leading-tight">
                                        <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                        <span>Awaiting Customer Confirmation to Generate Bill</span>
                                      </div>
                                    );
                                  }

                                  return (
                                    <button
                                      type="submit"
                                      disabled={submittingAudit || !auditorSignature || !customerSignature}
                                      className={`w-full py-2.5 px-3 ${
                                        revisingAudit
                                          ? 'bg-gradient-to-r from-amber-600 via-rose-600 to-purple-700 hover:from-amber-700 hover:to-purple-800'
                                          : 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800'
                                      } disabled:opacity-50 text-white rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer`}
                                    >
                                      {revisingAudit ? (
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      ) : (
                                        <FileText className="w-3.5 h-3.5" />
                                      )}
                                      {submittingAudit
                                        ? 'Submitting...'
                                        : revisingAudit
                                        ? `RE-SUBMIT REVISED BILL (v${(revisingAudit.billVersion || 1) + 1})`
                                        : 'GENERATE AUDIT BILL'}
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Empty state when no items */}
                </form>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: SCHEDULED AUDIT VISITS & REQUESTS */}
      {activeTab === 'scheduled' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Scheduled Field Audit Appointments</h3>
              <p className="text-xs text-slate-500">Upcoming customer household audit requests &amp; confirmations.</p>
            </div>

            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Book New Visit</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Audit ID &amp; Purpose</th>
                  <th className="py-3 px-3">Customer Info</th>
                  <th className="py-3 px-3">Scheduled Date/Time</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Auditor</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allAudits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No audit appointments scheduled.
                    </td>
                  </tr>
                ) : (
                  allAudits
                    .filter(a => !selectedCustomerId || a.customerId === selectedCustomerId)
                    .map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{a.id}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{a.purpose || 'Routine Audit'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{a.customerName}</div>
                        <div className="text-[10px] text-slate-400">
                          {a.customerMobile} • {a.customerAddress}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-cyan-600" />
                          <span>{a.visitDate || a.requestedDate || 'N/A'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{a.visitTime || (a.startedAt ? a.startedAt.split(' ')[1] : a.requestedTime) || '11:00 AM'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={a.status as any} />
                      </td>
                      <td className="py-3 px-3 text-slate-700">{a.auditorName}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {a.status === 'REQUESTED' || a.status === 'CUSTOMER_CONFIRMED' ? (
                            <button
                              onClick={() => handleStartAudit(a.id)}
                              className="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-800 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              Start Audit
                            </button>
                          ) : a.status === 'IN_PROGRESS' ? (
                            <button
                              onClick={() => handleStartAudit(a.id)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              Continue Audit
                            </button>
                          ) : null}
                          <button
                            onClick={() => setViewAuditModal(a)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-semibold text-slate-800 cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Printer className="w-3 h-3 text-slate-600" />
                            <span>{a.billId || a.billStatus ? 'View & Print Bill' : 'View Report'}</span>
                          </button>
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

      {/* TAB 3: AUDIT HISTORY & VERIFIED BILLS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">Past Field Audit Logs &amp; Verified Bills</h3>
            <p className="text-xs text-slate-500">
              Audit Settlement Bills generated by Auditors and locked upon customer confirmation.
            </p>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Bill / Audit ID</th>
                <th className="py-3 px-3">Customer Info</th>
                <th className="py-3 px-3">Bill Status &amp; Lock</th>
                <th className="py-3 px-3 text-center">Items Checked</th>
                <th className="py-3 px-3 text-center">Available</th>
                <th className="py-3 px-3 text-center">Missing</th>
                <th className="py-3 px-3 text-right">Wallet Deduction</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allAudits
                .filter(a => !selectedCustomerId || a.customerId === selectedCustomerId)
                .map((a) => {
                const isLocked = a.isBillLocked || a.billStatus === 'LOCKED' || a.status === 'LOCKED';
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <div>{a.billId || a.id}</div>
                      <div className="text-[10px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-cyan-600 shrink-0" />
                        <span>{a.visitDate || a.requestedDate || 'N/A'}</span>
                        <Clock className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
                        <span>{a.visitTime || (a.startedAt ? a.startedAt.split(' ')[1] : a.requestedTime) || '11:00 AM'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      <div>{a.customerName}</div>
                      <div className="text-[10px] text-slate-400">{a.customerAddress}</div>
                    </td>
                    <td className="py-3 px-3">
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Lock className="w-3 h-3 text-emerald-700" />
                          LOCKED (Confirmed)
                        </span>
                      ) : a.status === 'CUSTOMER_REJECTED' || a.status === 'DISPUTED' || a.billStatus === 'CUSTOMER_REJECTED' || a.billStatus === 'DISPUTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertTriangle className="w-3 h-3 text-rose-700" />
                          REJECTED BY CUSTOMER
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-700" />
                          PENDING CUSTOMER
                        </span>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Version {a.billVersion || 1}
                      </div>
                      {a.customerRejectionReason && (
                        <div className="text-[10px] text-rose-700 font-bold mt-1 bg-rose-50 p-1 rounded border border-rose-200 max-w-xs" title={a.customerRejectionReason}>
                          Reason: &ldquo;{a.customerRejectionReason}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">{a.totalItemsCount}</td>
                    <td className="py-3 px-3 text-center text-emerald-700 font-bold">{a.availableCount}</td>
                    <td className="py-3 px-3 text-center text-amber-700 font-bold">{a.notAvailableCount || 0}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                      ₹{a.totalWalletDeduction || 0}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {(a.status === 'CUSTOMER_REJECTED' || a.status === 'DISPUTED' || a.billStatus === 'CUSTOMER_REJECTED' || a.billStatus === 'DISPUTED') && (
                          <button
                            onClick={() => handleStartRevisingAudit(a)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-black cursor-pointer inline-flex items-center gap-1 shadow-xs transition"
                            title="Reopen audit with all previous input boxes restored"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reopen &amp; Revise</span>
                          </button>
                        )}
                        <button
                          onClick={() => setViewAuditModal(a)}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 transition"
                        >
                          <Eye className="w-3 h-3 text-purple-700" />
                          <span>View Bill</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: PANTRY PAY LEDGER & AUDITOR CONFIRMATION */}
      {activeTab === 'pantryPay' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-lg">Pantry Limit History</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Auditor Audit
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Verify and confirm direct UPI/Bank payments made by customers. Wallet and Credit Limit are untouched.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchPantryPayRecords}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh History</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={pantryPaySearch}
                onChange={(e) => setPantryPaySearch(e.target.value)}
                placeholder="Search by ID, barcode, product or customer..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 font-medium"
              />
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {pantryPayments.filter((p) => {
                const q = pantryPaySearch.toLowerCase();
                return !q || p.id.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q) || p.barcode.includes(q) || p.customerId.toLowerCase().includes(q);
              }).length} transaction records
            </div>
          </div>

          {pantryPayLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading Pantry Pay ledger...</div>
          ) : pantryPayments.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              No Pantry Pay transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-3">Txn ID &amp; Method</th>
                    <th className="py-3 px-3">Customer ID</th>
                    <th className="py-3 px-3">Product Details</th>
                    <th className="py-3 px-3 text-right">Amount Paid</th>
                    <th className="py-3 px-3">Txn Date/Time</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Auditor Confirmation</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pantryPayments
                    .filter((p) => {
                      const q = pantryPaySearch.toLowerCase();
                      const matchesSearch = !q || p.id.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q) || p.barcode.includes(q) || p.customerId.toLowerCase().includes(q);
                      const matchesCustomer = !selectedCustomerId || p.customerId === selectedCustomerId;
                      return matchesSearch && matchesCustomer;
                    })
                    .map((p) => {
                      const cust = customers.find((c) => c.id === p.customerId);
                      const isRecharge = p.isWalletRecharge === true || p.paymentType === 'WALLET_RECHARGE' || p.productId === 'WALLET-RECHARGE-1000' || p.barcode === 'WALLET-1000' || p.productId === 'WALLET-RECHARGE-100' || p.barcode === 'WALLET-100';
                      return (
                        <tr key={p.id} className={`transition ${isRecharge ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'hover:bg-slate-50/80'}`}>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            <div>{p.id}</div>
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-sans">
                              {p.paymentMethod} Direct
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{cust?.fullName || p.customerId}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.customerId}</div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{p.productName}</span>
                              {isRecharge && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white uppercase tracking-wider flex items-center gap-1">
                                  <Wallet className="w-2.5 h-2.5" />
                                  WALLET TOP-UP
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {isRecharge ? `Fixed ₹${p.amount.toLocaleString('en-IN')} Wallet Recharge` : `Barcode: ${p.barcode}`}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-emerald-700 font-mono text-sm">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                            {p.createdAt}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {p.paymentStatus}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            {p.auditorConfirmationStatus === 'CONFIRMED' ? (
                              <div className="space-y-0.5">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  CONFIRMED
                                </span>
                                {p.confirmedBy && (
                                  <div className="text-[10px] text-slate-400 font-mono">By {p.confirmedBy}</div>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                PENDING
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right">
                            {p.auditorConfirmationStatus === 'PENDING' ? (
                              <button
                                onClick={() => handleConfirmPantryPayment(p.id)}
                                className={`px-3 py-1.5 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer ${
                                  isRecharge 
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 ring-2 ring-emerald-300' 
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                              >
                                {isRecharge ? (
                                  <>
                                    <Wallet className="w-3.5 h-3.5" />
                                    <span>Confirm & Credit ₹{p.amount.toLocaleString('en-IN')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Confirm Payment</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">
                                {isRecharge ? 'Credited to Wallet ✓' : 'Verified ✓'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* WALLET TRANSACTION HISTORY SECTION */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-600" />
                  Customer Wallet History
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Real-time wallet deductions and recharges for {selectedCustomer?.fullName}
                </p>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                <span className="text-[10px] text-indigo-700 font-black uppercase">Current Balance: ₹{customerWallet?.walletBalance || 0}</span>
              </div>
            </div>

            {walletHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                No wallet transactions found for this customer.
              </div>
            ) : (
              <div className="overflow-hidden border border-slate-200 rounded-xl shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date &amp; ID</th>
                      <th className="py-2.5 px-3">Type &amp; Reason</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {walletHistory.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-mono">
                          <div className="text-slate-900 font-bold">{w.id}</div>
                          <div className="text-[9px] text-slate-400">{w.date} {w.time}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${w.amount > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            <span className="font-bold text-slate-800 uppercase text-[10px] tracking-tight">{w.transactionType}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{w.reason}</div>
                        </td>
                        <td className={`py-3 px-3 text-right font-black font-mono ${w.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {w.amount > 0 ? '+' : ''}₹{Math.abs(w.amount)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-700 font-mono">
                          ₹{w.newBalance}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                            w.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {w.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AUDITOR RETURN ORDERS */}
      {activeTab === 'returns' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                  Auditor Return Orders
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  {auditorReturns.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Return orders generated from your audit checks. Track admin acceptance, delivery partner pickup, and warehouse batch stock restoration.
              </p>
            </div>

            <button
              onClick={fetchCustomersAndPastAudits}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Orders</span>
            </button>
          </div>

          {auditorReturns.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <RotateCcw className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-600">No Auditor Return Orders Found</p>
              <p className="text-slate-400 text-[11px] mt-1">When you enter return quantities during physical audits, return orders will appear here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-3">Return Order ID</th>
                    <th className="py-3 px-3">Customer Details</th>
                    <th className="py-3 px-3">Product &amp; Batch</th>
                    <th className="py-3 px-3 text-center">Return Qty</th>
                    <th className="py-3 px-3">Bill Ref / Reason</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Stock Restored?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {auditorReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-purple-900">{ret.id}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ret.returnDate}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{ret.customerName}</div>
                        <div className="text-[10px] text-slate-500">{ret.customerMobile || ret.customerId}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{ret.productName}</div>
                        <div className="text-[10px] text-purple-700 font-mono">Batch #{ret.batchNumber}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {ret.returnQuantity} {ret.unit}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-[10px] text-slate-600">{ret.returnBillNumber}</div>
                        <div className="text-[10px] text-slate-500 italic max-w-xs truncate">{ret.returnReason}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={ret.status} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        {ret.stockRestored ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Batch Stock Restored
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Physical Pickup
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {isScheduleModalOpen && (
        <AppWindowModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          title="Schedule Field Audit Visit"
          subtitle="Book a physical doorstep inspection for a customer's pantry inventory."
          icon={<Calendar className="w-5 h-5 text-cyan-700" />}
          size="md"
        >
          <div className="p-6">
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Customer</label>
                <select
                  value={scheduleForm.customerId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, customerId: e.target.value })}
                  className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none bg-white font-medium"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.id}) - {c.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={scheduleForm.requestedDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, requestedDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Time Slot</label>
                <select
                  value={scheduleForm.requestedTime}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, requestedTime: e.target.value })}
                  className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none bg-white font-medium"
                >
                  <option value="09:00 AM - 11:00 AM">Morning Slot (09:00 AM - 11:00 AM)</option>
                  <option value="11:00 AM - 01:00 PM">Midday Slot (11:00 AM - 01:00 PM)</option>
                  <option value="02:00 PM - 04:00 PM">Afternoon Slot (02:00 PM - 04:00 PM)</option>
                  <option value="04:00 PM - 06:00 PM">Evening Slot (04:00 PM - 06:00 PM)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Purpose &amp; Scope</label>
                <textarea
                  rows={2}
                  value={scheduleForm.purpose}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, purpose: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduling}
                  className="px-5 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg shadow-xs cursor-pointer"
                >
                  {scheduling ? 'Booking...' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* VIEW AUDIT REPORT & SETTLEMENT BILL MODAL */}
      {viewAuditModal && (
        <AuditBillModal
          audit={viewAuditModal}
          onClose={() => setViewAuditModal(null)}
          isAuditorView={true}
        />
      )}

      {/* Product Timeline Modal */}
      {selectedTimeline && (
        <ProductTimelineModal
          timeline={selectedTimeline}
          onClose={() => setSelectedTimeline(null)}
          customerName={selectedCustomer?.fullName}
        />
      )}

      {/* Product Image Detail Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-all"
          onClick={() => setZoomedImage(null)}
        >
          <div 
            className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full shadow-2xl relative flex flex-col md:flex-row border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Column: Image with high quality */}
            <div
              style={{ backgroundColor: currentTheme.surfaceDark }}
              className="w-full md:w-1/2 flex items-center justify-center p-4 relative min-h-[300px]"
            >
              <ImageWithFallback 
                src={zoomedImage.src} 
                alt={zoomedImage.title} 
                className="max-h-[400px] object-contain rounded-lg shadow"
              />
              <button 
                type="button"
                onClick={() => setZoomedImage(null)}
                style={{
                  backgroundColor: currentTheme.menuBg,
                  borderColor: currentTheme.menuBorder,
                  color: currentTheme.menuItemText,
                }}
                className="absolute top-3 right-3 rounded-full p-1.5 transition border cursor-pointer hover:opacity-80 shadow"
                title="Close Image Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Right Column: Detailed product information */}
            <div className="w-full md:w-1/2 p-6 flex flex-col justify-between bg-slate-50">
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-black text-cyan-700 tracking-wider">Product Highlight View</span>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">{zoomedImage.title}</h3>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-3xs">
                      <span className="block text-[8px] uppercase text-slate-400 font-extrabold">Batch Number</span>
                      <span className="text-xs font-mono font-bold text-cyan-800">{zoomedImage.batchNumber || 'N/A'}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-3xs">
                      <span className="block text-[8px] uppercase text-slate-400 font-extrabold">Barcode ID</span>
                      <span className="text-xs font-mono font-bold text-slate-800">{zoomedImage.barcode || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-3xs">
                      <span className="block text-[8px] uppercase text-slate-400 font-extrabold">Mfg Date (Mfg)</span>
                      <span className="text-xs font-mono font-bold text-slate-700">{zoomedImage.mfgDate || 'N/A'}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-3xs">
                      <span className="block text-[8px] uppercase text-slate-400 font-extrabold">Expire Date (Exp)</span>
                      <span className="text-xs font-mono font-bold text-rose-600">{zoomedImage.expDate || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-cyan-50/50 p-3 rounded-lg border border-cyan-100/60 text-[11px] text-cyan-800 space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-cyan-900">
                    <ShieldCheck className="w-3.5 h-3.5" /> Physical Verification Note
                  </span>
                  <p className="leading-snug">Verify these batch numbers, manufacturing markings, and expiration dates physically against the actual item container during doorstep audit.</p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setZoomedImage(null)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs shadow transition cursor-pointer"
                >
                  Close Detailed View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Field Work PDF Report Modal */}
      {showPdfReportModal && (
        <AppWindowModal
          isOpen={showPdfReportModal}
          onClose={() => {
            setShowPdfReportModal(false);
            setPdfReportAudit(null);
          }}
          title="Auditor Field Work & Discrepancy PDF Report"
          subtitle="Printable and downloadable field inspection report for customer pantry audit"
          icon={<FileText className="w-5 h-5 text-cyan-600" />}
          size="2xl"
        >
          <div className="p-3 sm:p-5 bg-slate-100 max-h-[82vh] overflow-y-auto">
            <AuditorWorkPdfReport
              audit={
                pdfReportAudit ||
                (selectedCustomer
                  ? ({
                      id: revisingAudit?.id || 'DRAFT-AUDIT',
                      billId: revisingAudit?.billId || 'DRAFT-BILL',
                      billVersion: revisingAudit?.billVersion || 1,
                      customerId: selectedCustomer.id,
                      customerName: selectedCustomer.fullName,
                      customerMobile: selectedCustomer.mobile,
                      customerAddress: selectedCustomer.address,
                      auditorId: currentAuditorProfile?.id || auditor?.id || 'AUD-001',
                      auditorName: currentAuditorProfile?.fullName || auditor?.fullName || 'Field Officer',
                      auditorMobile: currentAuditorProfile?.mobile || auditor?.mobile || '',
                      visitDate: new Date().toISOString().split('T')[0],
                      visitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      status: revisingAudit?.status || 'PENDING_CUSTOMER_CONFIRMATION',
                      billStatus: revisingAudit?.billStatus || 'PENDING_CUSTOMER_CONFIRMATION',
                      totalItemsCount: pantryItems.length,
                      availableCount: pantryItems.reduce(
                        (acc, i) => acc + (itemStatuses[i.id]?.qtyAvailable || 0),
                        0
                      ),
                      notAvailableCount: missingCountTotal,
                      totalWalletDeduction: estimatedWalletDeduction,
                      overallRemarks: overallRemarks || revisingAudit?.overallRemarks || '',
                      itemsChecked: pantryItems.map((item) => {
                        const st = itemStatuses[item.id];
                        return {
                          pantryCardItemId: item.id,
                          productId: item.productId,
                          productName: item.productName,
                          barcode: item.barcode,
                          batchNumber: item.batchNumber,
                          expiryDate: item.expiryDate,
                          systemQuantity: item.quantity,
                          unitPrice: item.unitPrice || 0,
                          unit: (item as any).unit || 'Unit',
                          category: (item as any).category || 'General',
                          verificationStatus: st?.status || 'AVAILABLE',
                          actionTaken: st?.action || 'NONE',
                          qtyAvailable: st?.qtyAvailable ?? item.quantity,
                          qtyMissing: st?.qtyMissing || 0,
                          qtyDamaged: st?.qtyDamaged || 0,
                          qtyReturn: st?.qtyReturn || 0,
                          qtyReplacement: st?.qtyReplacement || 0,
                          qtyPantryPay: st?.qtyPantryPay || 0,
                          remarks: st?.remarks || '',
                          walletDeduction: (st?.qtyMissing || 0) * (item.unitPrice || 0),
                        };
                      }),
                      isBillLocked: false,
                      customerRejectionReason: revisingAudit?.customerRejectionReason,
                    } as any)
                  : null)
              }
              customer={selectedCustomer}
              pantryItems={pantryItems}
              itemStatuses={itemStatuses}
              onClose={() => {
                setShowPdfReportModal(false);
                setPdfReportAudit(null);
              }}
            />
          </div>
        </AppWindowModal>
      )}

      {/* Credit Limit / Home Stock Value Detail Drill-Down Modal */}
      {metricModalTab && selectedCustomer && (
        <CreditLimitDetailModal
          isOpen={true}
          onClose={() => setMetricModalTab(null)}
          initialTab={metricModalTab}
          customer={selectedCustomer}
          pantryItems={pantryItems}
          orders={customerOrders}
        />
      )}

      {/* Register New Household or Assign Existing to Route Modal */}
      {isAddHouseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-700 flex items-center justify-center text-white shadow-md shadow-cyan-100">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Manage Audit Route Households</h3>
                  <p className="text-xs text-slate-500 font-medium">Add new house or link registered households</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddHouseModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
              <button
                onClick={() => setAddHouseTab('NEW')}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                  addHouseTab === 'NEW'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Register New House
              </button>
              <button
                onClick={() => setAddHouseTab('EXISTING')}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                  addHouseTab === 'EXISTING'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Link Registered Houses ({allRegisteredCustomers.length})
              </button>
            </div>

            {addHouseTab === 'NEW' ? (
              <form onSubmit={handleCreateAndAssignHouse} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Head of Family / Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newHouseForm.fullName}
                    onChange={(e) => setNewHouseForm({ ...newHouseForm, fullName: e.target.value })}
                    placeholder="e.g. Rameshwar Sahay"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    10-Digit Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={newHouseForm.mobile}
                    onChange={(e) => setNewHouseForm({ ...newHouseForm, mobile: e.target.value.replace(/\D/g, '') })}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none font-mono font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Area / Colony
                    </label>
                    <input
                      type="text"
                      value={newHouseForm.area}
                      onChange={(e) => setNewHouseForm({ ...newHouseForm, area: e.target.value })}
                      placeholder="e.g. Lalpur / Morabadi"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Pantry Credit Limit (₹)
                    </label>
                    <input
                      type="number"
                      value={newHouseForm.pantryLimit}
                      onChange={(e) => setNewHouseForm({ ...newHouseForm, pantryLimit: Number(e.target.value) })}
                      placeholder="10000"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Complete House Address
                  </label>
                  <input
                    type="text"
                    value={newHouseForm.address}
                    onChange={(e) => setNewHouseForm({ ...newHouseForm, address: e.target.value })}
                    placeholder="e.g. Flat 301, Kailash Tower, Main Road"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none font-medium"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddHouseModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={newHouseSaving}
                    className="px-5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-black shadow-md shadow-cyan-100 transition cursor-pointer flex items-center gap-1.5"
                  >
                    {newHouseSaving ? 'Saving Household...' : 'Enroll Household to My Route'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by customer name, mobile or area..."
                    value={existingHouseSearch}
                    onChange={(e) => setExistingHouseSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {allRegisteredCustomers
                    .filter((c) => {
                      const q = existingHouseSearch.toLowerCase();
                      if (!q) return true;
                      return (
                        c.fullName.toLowerCase().includes(q) ||
                        c.mobile.includes(q) ||
                        (c.area && c.area.toLowerCase().includes(q)) ||
                        c.id.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => {
                      const isLinked = currentAuditorProfile?.assignedCustomerIds?.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleToggleLinkExistingHouse(c.id)}
                          className={`p-3 rounded-xl border-2 transition cursor-pointer flex items-center justify-between gap-3 ${
                            isLinked
                              ? 'bg-cyan-50/80 border-cyan-400 text-cyan-950'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">{c.fullName}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                                {c.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              📞 +91 {c.mobile} • {c.area || c.city}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase ${
                                isLinked
                                  ? 'bg-cyan-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isLinked ? '✓ Linked' : '+ Link'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Linked to Route: <strong>{currentAuditorProfile?.assignedCustomerIds?.length || 0}</strong> houses
                  </span>
                  <button
                    onClick={() => setIsAddHouseModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-black transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
