import React from 'react';
import { CustomerProductTimeline, ProductTimelineEvent } from '../../types';
import { ImageWithFallback } from './ImageWithFallback';
import { AppWindowModal } from './AppWindowModal';
import {
  X,
  Package,
  CreditCard,
  RotateCcw,
  RefreshCw,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  TrendingDown,
  ShoppingBag,
  ShieldCheck,
  Tag,
  AlertCircle,
} from 'lucide-react';

interface ProductTimelineModalProps {
  timeline: CustomerProductTimeline;
  onClose: () => void;
  customerName?: string;
}

export const ProductTimelineModal: React.FC<ProductTimelineModalProps> = ({
  timeline,
  onClose,
  customerName,
}) => {
  const getEventIcon = (type: ProductTimelineEvent['type']) => {
    switch (type) {
      case 'ORDER_DELIVERED':
      case 'ORDER_PLACED':
        return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
      case 'PANTRY_PAYMENT':
        return <CreditCard className="w-4 h-4 text-purple-600" />;
      case 'RETURN_REQUEST':
        return <RotateCcw className="w-4 h-4 text-amber-600" />;
      case 'REPLACEMENT_REQUEST':
        return <RefreshCw className="w-4 h-4 text-blue-600" />;
      case 'FIELD_AUDIT':
        return <ClipboardCheck className="w-4 h-4 text-cyan-600" />;
      case 'ZERO_QTY_CONSUMED':
        return <TrendingDown className="w-4 h-4 text-rose-600" />;
      default:
        return <Package className="w-4 h-4 text-slate-600" />;
    }
  };

  const getEventBadgeClass = (type: ProductTimelineEvent['type']) => {
    switch (type) {
      case 'ORDER_DELIVERED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'PANTRY_PAYMENT':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'RETURN_REQUEST':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'REPLACEMENT_REQUEST':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'FIELD_AUDIT':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'ZERO_QTY_CONSUMED':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <AppWindowModal
      isOpen={true}
      onClose={onClose}
      title={timeline.productName}
      subtitle={customerName ? `Customer History: ${customerName} • Brand: ${timeline.brand}` : `Brand: ${timeline.brand}`}
      icon={
        <div className="w-10 h-10 rounded-xl bg-purple-100 p-0.5 shrink-0 overflow-hidden border border-purple-200">
          <ImageWithFallback src={timeline.image} alt={timeline.productName} />
        </div>
      }
      size="xl"
      badge={
        <div className="flex items-center gap-1.5">
          {timeline.barcode && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
              #{timeline.barcode}
            </span>
          )}
          {timeline.isUsedUp ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
              0 Qty • Used Up
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              {timeline.currentStock} Units Active
            </span>
          )}
        </div>
      }
      footer={
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
            <span>Ordered: <strong className="text-purple-700">{timeline.totalQuantityOrdered}</strong></span>
            <span>•</span>
            <span>Consumed/Returned: <strong className="text-rose-600">{timeline.totalQuantityConsumed}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close History
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Current Stock Banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Current Stock Status:</span>
            {timeline.isUsedUp ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                0 Qty • Moved to Used History Box
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Active Stock: {timeline.currentStock} Units Available
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-slate-700">
            <div>
              Ordered: <span className="font-bold text-purple-700">{timeline.totalQuantityOrdered}</span>
            </div>
            <span className="text-slate-300">•</span>
            <div>
              Used: <span className="font-bold text-rose-600">{timeline.totalQuantityConsumed}</span>
            </div>
          </div>
        </div>

        {/* Timeline Events Scroll Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-600" />
              Complete Work History &amp; Timestamp Log
            </h4>
            <span className="text-[11px] text-slate-500">
              Started: <strong>{timeline.firstOrderedAt}</strong>
            </span>
          </div>

          {timeline.events.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No historical activity logged for this product.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {timeline.events.map((evt) => (
                <div key={evt.id} className="relative group">
                  {/* Circle dot on timeline */}
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-purple-600 flex items-center justify-center shadow-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-purple-300 transition space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1 ${getEventBadgeClass(evt.type)}`}>
                          {getEventIcon(evt.type)}
                          {evt.title}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 font-semibold">
                        {evt.timestamp}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {evt.description}
                    </p>

                    {(evt.amount || evt.quantityChange || evt.status) && (
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        {evt.quantityChange !== undefined && evt.quantityChange !== 0 && (
                          <div>
                            Qty Impact:{' '}
                            <span className={`font-bold ${evt.quantityChange > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {evt.quantityChange > 0 ? `+${evt.quantityChange}` : evt.quantityChange}
                            </span>
                          </div>
                        )}
                        {evt.amount !== undefined && evt.amount > 0 && (
                          <div>
                            Amount: <span className="font-bold text-slate-900">₹{evt.amount}</span>
                          </div>
                        )}
                        {evt.status && (
                          <div>
                            Status: <span className="font-semibold text-purple-700">{evt.status}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppWindowModal>
  );
};
