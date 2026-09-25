import React, { useState } from 'react';
import { Order, DeliveryBoy, OrderStatus } from '../../types';
import { api } from '../../services/api';
import {
  Lock,
  CheckCircle2,
  Truck,
  Package,
  Bike,
  MapPin,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  UserCheck,
  Phone,
  Check,
  RefreshCw,
  X,
  FileText,
  Navigation,
} from 'lucide-react';

interface OrderStepLockStepperProps {
  order: Order;
  deliveryBoys: DeliveryBoy[];
  onOrderUpdated: (updatedOrder: Order) => void;
  compact?: boolean;
}

interface StepMeta {
  key: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  label: string;
  hindiLabel: string;
  icon: React.ElementType;
  rank: number;
}

const ORDER_STEPS: StepMeta[] = [
  {
    key: 'PENDING',
    label: 'Order Placed',
    hindiLabel: 'Order Receive Hua',
    icon: Package,
    rank: 1,
  },
  {
    key: 'CONFIRMED',
    label: 'Warehouse Picked & Packed',
    hindiLabel: 'Product Pickup & Pack Hua',
    icon: ShieldCheck,
    rank: 2,
  },
  {
    key: 'SHIPPED',
    label: 'Shipped & Dispatched',
    hindiLabel: 'Hub Se Shipped / Nikla',
    icon: Truck,
    rank: 3,
  },
  {
    key: 'OUT_FOR_DELIVERY',
    label: 'Out For Delivery',
    hindiLabel: 'Delivery Boy Le Kar Nikla',
    icon: Bike,
    rank: 4,
  },
  {
    key: 'DELIVERED',
    label: 'Delivered & Handover',
    hindiLabel: 'Customer Ko Pahucha & Verified',
    icon: CheckCircle2,
    rank: 5,
  },
];

const getStatusRank = (status: OrderStatus | string): number => {
  switch (status) {
    case 'PENDING':
      return 1;
    case 'CONFIRMED':
    case 'READY_TO_SHIP':
      return 2;
    case 'SHIPPED':
    case 'ASSIGNED':
    case 'ACCEPTED':
      return 3;
    case 'OUT_FOR_DELIVERY':
      return 4;
    case 'DELIVERED':
    case 'COMPLETED':
      return 5;
    default:
      return 1;
  }
};

export const OrderStepLockStepper: React.FC<OrderStepLockStepperProps> = ({
  order,
  deliveryBoys,
  onOrderUpdated,
  compact = false,
}) => {
  const currentRank = getStatusRank(order.orderStatus);
  const isDelivered = currentRank >= 5;

  // Next step calculation
  type AdvanceTarget = 'CONFIRMED' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  let nextStep: (Omit<StepMeta, 'key'> & { key: AdvanceTarget }) | null = null;
  if (currentRank === 1) nextStep = ORDER_STEPS[1] as (Omit<StepMeta, 'key'> & { key: AdvanceTarget }); // CONFIRMED
  else if (currentRank === 2) nextStep = ORDER_STEPS[2] as (Omit<StepMeta, 'key'> & { key: AdvanceTarget }); // SHIPPED
  else if (currentRank === 3) nextStep = ORDER_STEPS[3] as (Omit<StepMeta, 'key'> & { key: AdvanceTarget }); // OUT_FOR_DELIVERY
  else if (currentRank === 4) nextStep = ORDER_STEPS[4] as (Omit<StepMeta, 'key'> & { key: AdvanceTarget }); // DELIVERED

  // Modal State for Irreversible Advancement Confirmation
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedDBoyId, setSelectedDBoyId] = useState(order.assignedDeliveryBoyId || '');
  const [stepLocation, setStepLocation] = useState('');
  const [stepNotes, setStepNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Open modal with prefilled data
  const handleOpenAdvanceModal = () => {
    setErrorMsg('');
    setSelectedDBoyId(order.assignedDeliveryBoyId || (deliveryBoys[0]?.id ?? ''));
    if (nextStep?.key === 'CONFIRMED') {
      setStepLocation('Central Fulfillment Warehouse, Ranchi');
      setStepNotes('Items picked from stock bins, physical barcodes scanned and safely packed in sealed tote.');
    } else if (nextStep?.key === 'SHIPPED') {
      setStepLocation('Ranchi Logistics Hub - Dispatch Dock 2');
      setStepNotes('Package verified, dispatch invoice attached, manifested for local delivery route.');
    } else if (nextStep?.key === 'OUT_FOR_DELIVERY') {
      const activeDBoy = deliveryBoys.find((d) => d.id === (order.assignedDeliveryBoyId || selectedDBoyId));
      setStepLocation(`In Transit - Route ${order.deliveryAddress.substring(0, 30)}...`);
      setStepNotes(`Package handed over to ${activeDBoy?.fullName || 'Delivery Boy'}. Contact: ${activeDBoy?.mobile || 'N/A'}`);
    } else if (nextStep?.key === 'DELIVERED') {
      setStepLocation(`Delivered at Doorstep: ${order.deliveryAddress}`);
      setStepNotes(
        order.orderType === 'QUICK'
          ? `Cash collected ₹${order.totalAmount}. Order verified & successfully handed over to ${order.customerName}.`
          : `Pantry replenishment delivered. Items moved to customer active pantry card.`
      );
    }
    setIsConfirmModalOpen(true);
  };

  const handleConfirmAdvance = async () => {
    if (!nextStep) return;
    setErrorMsg('');

    // If moving to OUT_FOR_DELIVERY, delivery boy is mandatory
    if (nextStep.key === 'OUT_FOR_DELIVERY' && !selectedDBoyId) {
      setErrorMsg('Please select a Delivery Boy before advancing to Out For Delivery.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await api.advanceOrderStep(order.id, {
        targetStep: nextStep.key,
        deliveryBoyId: selectedDBoyId || order.assignedDeliveryBoyId || undefined,
        location: stepLocation.trim() || undefined,
        notes: stepNotes.trim() || undefined,
      });

      onOrderUpdated(updated);
      setIsConfirmModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to advance order step.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Banner: Kahan Pahucha Live Indicator */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {isDelivered ? 'Permanently Locked & Delivered' : 'One-Way Workflow Locked'}
            </span>
            <span className="text-[11px] font-bold text-slate-400">Order ID: <strong className="text-white font-mono">{order.id}</strong></span>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm font-black text-slate-100">
              Kahan Pahucha: <span className="text-emerald-300">{order.currentLocation || (isDelivered ? 'Delivered at Doorstep' : currentRank >= 3 ? 'Shipped from Hub' : 'Warehouse Fulfillment')}</span>
            </span>
          </div>

          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 pt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Current Status: <strong className="text-white uppercase font-bold">{order.orderStatus}</strong></span>
            </span>
            {order.assignedDeliveryBoyName && (
              <span className="flex items-center gap-1 text-amber-300 font-semibold">
                <Bike className="w-3.5 h-3.5" />
                <span>Partner: {order.assignedDeliveryBoyName} {order.assignedDeliveryBoyMobile ? `(${order.assignedDeliveryBoyMobile})` : ''}</span>
              </span>
            )}
          </div>
        </div>

        {/* Lock & Advance Button */}
        <div className="shrink-0 flex items-center gap-2">
          {isDelivered ? (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 font-black text-xs flex items-center gap-2 shadow-xs">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Order Delivered &amp; Permanently Locked</span>
            </div>
          ) : nextStep ? (
            <button
              type="button"
              onClick={handleOpenAdvanceModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition transform active:scale-95 cursor-pointer"
            >
              <Lock className="w-4 h-4 text-slate-950" />
              <span>Advance &amp; Lock: {nextStep.label}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* 5-Stage Visual Stepper */}
      <div className="p-4 sm:p-6 bg-slate-50/60 border-b border-slate-200/80">
        <div className="relative">
          {/* Connector Line */}
          <div className="hidden md:block absolute top-1/2 left-8 right-8 h-1 bg-slate-200 -translate-y-1/2 z-0" />
          <div
            className="hidden md:block absolute top-1/2 left-8 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, ((currentRank - 1) / (ORDER_STEPS.length - 1)) * 100))}%` }}
          />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 sm:gap-2 relative z-10">
            {ORDER_STEPS.map((step) => {
              const isPassed = step.rank < currentRank;
              const isCurrent = step.rank === currentRank;
              const isFuture = step.rank > currentRank;
              const Icon = step.icon;

              // Extract timestamp for this step if available
              let stepTime = '';
              if (step.key === 'PENDING') stepTime = order.createdAt;
              else if (step.key === 'CONFIRMED') stepTime = order.confirmedAt || (isPassed ? 'Confirmed' : '');
              else if (step.key === 'SHIPPED') stepTime = order.shippedAt || (isPassed ? 'Shipped' : '');
              else if (step.key === 'OUT_FOR_DELIVERY') stepTime = order.outForDeliveryAt || (isPassed ? 'Out' : '');
              else if (step.key === 'DELIVERED') stepTime = order.deliveredAt || (isPassed ? 'Delivered' : '');

              return (
                <div
                  key={step.key}
                  className={`p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                      : isPassed
                      ? 'bg-emerald-50/80 border-emerald-200'
                      : 'bg-white border-slate-200/80 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-xs ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-md'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isPassed ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-black truncate ${
                            isCurrent ? 'text-indigo-950 font-black' : isPassed ? 'text-emerald-950' : 'text-slate-600'
                          }`}
                        >
                          {step.label}
                        </span>
                        {isPassed && <Lock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{step.hindiLabel}</div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                    <span
                      className={`font-black uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded ${
                        isCurrent
                          ? 'bg-indigo-100 text-indigo-700 font-bold'
                          : isPassed
                          ? 'bg-emerald-100 text-emerald-700 font-bold'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isCurrent ? 'Active Now' : isPassed ? 'Locked ✓' : 'Upcoming'}
                    </span>
                    {stepTime && (
                      <span className="font-mono text-slate-500 text-[9px] truncate max-w-[120px]" title={stepTime}>
                        {stepTime.includes(' ') ? stepTime.split(' ')[1] + ' ' + (stepTime.split(' ')[2] || '') : stepTime}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Irreversible Audit Tracking Timeline (Timestamped & Locked) */}
      {!compact && (
        <div className="p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Timestamped Tracking Audit Log (Kaha Pahucha History)</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-semibold">One-Way Irreversible Audit Trail</span>
          </div>

          <div className="space-y-2">
            {(order.trackingTimeline && order.trackingTimeline.length > 0
              ? order.trackingTimeline
              : [
                  {
                    step: order.orderStatus,
                    title: `Order Registered as ${order.orderStatus}`,
                    description: `Order in process for customer ${order.customerName}. Value: ₹${order.totalAmount}`,
                    location: order.currentLocation || 'Central Store System',
                    timestamp: order.createdAt || 'Initial Registration',
                    performedBy: 'System / Customer',
                    locked: true,
                  },
                ]
            ).map((event, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200 text-xs"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-black text-slate-900">{event.title}</span>
                    <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {event.timestamp}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">{event.description}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-medium">
                    {event.location && (
                      <span className="flex items-center gap-1 text-slate-700 font-semibold">
                        <MapPin className="w-3 h-3 text-rose-500" /> {event.location}
                      </span>
                    )}
                    {event.performedBy && (
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-indigo-500" /> By: {event.performedBy}
                      </span>
                    )}
                    {event.deliveryBoyName && (
                      <span className="flex items-center gap-1 text-amber-700 font-semibold">
                        <Bike className="w-3 h-3" /> Delivery Boy: {event.deliveryBoyName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation & Lock Modal Dialog */}
      {isConfirmModalOpen && nextStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header with Strong Lock Warning */}
            <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 text-white p-4 sm:p-5 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-200" />
                  <h3 className="text-base font-black">Confirm Irreversible Step Lock</h3>
                </div>
                <p className="text-xs text-amber-100 font-medium leading-snug">
                  Warning: Ek baar is step ko lock karne ke baad aap wapas pichle step par nahi jaa sakte!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-black/20 hover:bg-black/40 text-white flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
              {/* Step Transition Visual */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Stage</span>
                  <span className="text-sm font-black text-slate-800">{order.orderStatus}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">Next Locked Stage</span>
                  <span className="text-sm font-black text-emerald-600">{nextStep.label}</span>
                </div>
              </div>

              {/* Delivery Boy Selection (Mandatory for OUT_FOR_DELIVERY or helpful for SHIPPED) */}
              {(nextStep.key === 'OUT_FOR_DELIVERY' || nextStep.key === 'SHIPPED') && (
                <div className="space-y-1.5 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <label className="font-black text-amber-950 flex items-center gap-1.5">
                    <Bike className="w-4 h-4 text-amber-600" />
                    <span>Assign Delivery Boy {nextStep.key === 'OUT_FOR_DELIVERY' ? '(Mandatory)' : '(Optional)'}</span>
                  </label>
                  <p className="text-[11px] text-amber-800">
                    Product ko customer ke ghar le jane ke liye delivery partner select karein:
                  </p>
                  <select
                    value={selectedDBoyId}
                    onChange={(e) => setSelectedDBoyId(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Choose Delivery Boy --</option>
                    {deliveryBoys.map((db) => (
                      <option key={db.id} value={db.id}>
                        {db.fullName} • Phone: {db.mobile} • {db.vehicleNumber || 'Bike'} ({db.assignedArea})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Location Input (Kahan Pahucha Product) */}
              <div className="space-y-1.5">
                <label className="font-black text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Kahan Pahucha Product (Location / Hub Landmark)</span>
                </label>
                <input
                  type="text"
                  value={stepLocation}
                  onChange={(e) => setStepLocation(e.target.value)}
                  placeholder="e.g. Central Warehouse, Ranchi / Bariatu Hub"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notes / Verification Remarks */}
              <div className="space-y-1.5">
                <label className="font-black text-slate-700 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Audit Remarks / Verification Notes</span>
                </label>
                <textarea
                  value={stepNotes}
                  onChange={(e) => setStepNotes(e.target.value)}
                  rows={2}
                  placeholder="Items verified, barcode scanned, packet handed over..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Irreversible Lock Warning Box */}
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-black block text-[11px]">Strict One-Way Security Lock Policy</span>
                  <p className="text-[10px] text-rose-700 leading-relaxed">
                    Aap jaise hi "Confirm &amp; Lock" dabayenge, yeh order permanently agle stage par lock ho jayega. Back jana strictly disabled hai.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-100 text-red-800 border border-red-200 font-bold text-xs">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAdvance}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Locking Step...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Yes, Confirm &amp; Lock Next Step</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
