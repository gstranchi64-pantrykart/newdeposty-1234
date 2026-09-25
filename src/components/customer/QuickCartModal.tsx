import React, { useState } from 'react';
import { Product, ProductBatch } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { CartItem } from './PantryCartModal';
import { AppWindowModal } from '../common/AppWindowModal';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  X,
  Banknote,
  Truck,
} from 'lucide-react';

interface QuickCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, batchId: string, delta: number) => void;
  onRemoveItem: (productId: string, batchId: string) => void;
  onClearCart: () => void;
  onOrderSuccess: () => void;
}

export const QuickCartModal: React.FC<QuickCartModalProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
}) => {
  const { customer, user } = useAuth();
  const [address, setAddress] = useState(
    customer?.address || 'Flat 402, Green Valley Apartments, Morabadi, Ranchi'
  );
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalAmount = items.reduce(
    (sum, item) => sum + item.product.sellingPrice * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (!customer || !user) {
      alert('Please login to place a quick order.');
      return;
    }

    if (items.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createOrder({
        customerId: customer.id,
        orderType: 'QUICK',
        deliveryAddress: address,
        items: items.map((i) => ({
          productId: i.product.id,
          batchId: i.batch.id,
          quantity: i.quantity,
        })),
      });

      alert(`Quick COD Order placed successfully! Please pay ₹${totalAmount} in cash on delivery.`);
      onClearCart();
      onOrderSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppWindowModal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Delivery Cart"
      subtitle="Cash on Delivery (COD) • Direct doorstep handover, no pantry credit deduction"
      icon={<ShoppingBag className="w-5 h-5 text-amber-600" />}
      size="xl"
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
          COD: ₹{totalAmount.toLocaleString()}
        </span>
      }
    >
      <div className="p-6 space-y-4">
        {/* COD Info Banner */}
        <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200/80 flex items-center gap-3">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="text-xs text-amber-900">
            <div className="font-bold">Pay ₹{totalAmount} via Cash on Delivery</div>
            <div className="text-[11px] text-amber-700">
              Delivery boy will collect cash and mark payment completed upon handover.
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1">
          {items.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Your Quick Cart is currently empty.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.product.id}-${item.batch.id}`}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                    <ImageWithFallback src={item.product.images[0]} alt={item.product.name} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 truncate">
                      {item.product.name}
                    </h4>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {item.product.weightSize || item.product.unit} • ₹{item.product.sellingPrice}/unit
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, item.batch.id, -1)}
                      className="p-1 hover:bg-slate-100 text-slate-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2 text-xs font-bold text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, item.batch.id, 1)}
                      disabled={item.quantity >= item.batch.availableQuantity}
                      className="p-1 hover:bg-slate-100 disabled:opacity-30 text-slate-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="font-bold text-xs text-slate-900 min-w-[50px] text-right">
                    ₹{item.product.sellingPrice * item.quantity}
                  </span>

                  <button
                    onClick={() => onRemoveItem(item.product.id, item.batch.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Delivery Address */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">Delivery Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            placeholder="Enter full delivery address"
            required
          />
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Cash to Collect</span>
            <div className="text-lg font-black text-slate-900">₹{totalAmount}</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleCheckout}
              disabled={items.length === 0 || submitting}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
            >
              <Truck className="w-4 h-4" />
              {submitting ? 'Placing Order...' : 'Place Quick COD Order'}
            </button>
          </div>
        </div>
      </div>
    </AppWindowModal>
  );
};
