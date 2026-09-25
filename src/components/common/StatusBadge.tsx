import React from 'react';

interface StatusBadgeProps {
  status?: string | null;
  type?: 'order' | 'inventory' | 'pantry' | 'auditor' | 'general';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'general', className = '' }) => {
  const getColors = () => {
    switch (status) {
      // Orders & General
      case 'DELIVERED':
      case 'COMPLETED':
      case 'AVAILABLE':
      case 'PUBLISHED':
      case 'ACTIVE':
      case 'APPROVED':
      case 'PAID':
      case 'COD_COLLECTED':
      case 'LOCKED':
      case 'BILL_CONFIRMED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold';

      case 'CONFIRMED':
      case 'ASSIGNED':
      case 'ACCEPTED':
      case 'OUT_FOR_DELIVERY':
      case 'RETURN_ELIGIBLE':
      case 'REPLACEMENT_APPROVED':
      case 'PANTRY_CREDIT_DEBITED':
      case 'COD_PENDING':
        return 'bg-blue-50 text-blue-700 border-blue-200';

      case 'PENDING':
      case 'PENDING_APPROVAL':
      case 'DRAFT':
      case 'NEAR_EXPIRY':
      case 'LOW_STOCK':
      case 'GENERATED':
      case 'BILL_GENERATED':
      case 'CUSTOMER_PENDING_CONFIRMATION':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';

      case 'RETURN_REQUESTED':
      case 'REPLACEMENT_REQUESTED':
      case 'DAMAGED':
      case 'DAMAGED_VERIFIED':
        return 'bg-purple-50 text-purple-700 border-purple-200';

      case 'CANCELLED':
      case 'DELIVERY_FAILED':
      case 'EXPIRED':
      case 'EXPIRED_ON_HOLD':
      case 'NOT_AVAILABLE':
      case 'INACTIVE':
      case 'UNPUBLISHED':
      case 'REJECTED':
      case 'CUSTOMER_REJECTED':
      case 'REVISION_REQUIRED':
      case 'DISPUTED':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-semibold';

      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const formatText = (text?: string | null) => {
    if (!text) return 'N/A';
    return String(text)
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getColors()} ${className}`}
    >
      {formatText(status)}
    </span>
  );
};
