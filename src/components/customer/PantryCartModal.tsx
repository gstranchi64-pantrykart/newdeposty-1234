import React, { useState } from 'react';
import { Product, ProductBatch, Customer } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { AppWindowModal } from '../common/AppWindowModal';
import {
  CreditCard,
  Trash2,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
  X,
  Truck,
  ShieldCheck,
} from 'lucide-react';

export interface CartItem {
  product: Product;
  batch: ProductBatch;
  quantity: number;
}

interface PantryCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, batchId: string, delta: number) => void;
  onRemoveItem: (productId: string, batchId: string) => void;
  onClearCart: () => void;
  onOrderSuccess: () => void;
}

export const PantryCartModal: React.FC<PantryCartModalProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
}) => {
  const { customer, user, refreshUserData } = useAuth();
  const [address, setAddress] = useState(customer?.address || 'Flat 402, Green Valley Apartments, Morabadi, Ranchi');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalAmount = items.reduce(
    (sum, item) => sum + item.product.sellingPrice * item.quantity,
    0
  );

  const availableLimit = customer?.availablePantryLimit || 0;
  const isLimitExceeded = totalAmount > availableLimit;
  const remainingLimitAfterOrder = availableLimit - totalAmount;

  const handleCheckout = async () => {
    if (!customer || !user) {
      alert('Please login as a customer to checkout.');
      return;
    }

    if (items.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    if (isLimitExceeded) {
      alert(
        `Insufficient Pantry Credit Limit! Your available limit is ₹${availableLimit}, but cart total is ₹${totalAmount}. Please reduce items.`
      );
      return;
    }

    setSubmitting(true);
    try {
      await api.createOrder({
        customerId: customer.id,
        orderType: 'PANTRY',
        deliveryAddress: address,
        items: items.map((i) => ({
          productId: i.product.id,
          batchId: i.batch.id,
          quantity: i.quantity,
        })),
      });

      alert('Pantry Card Order placed successfully! 0 Cash required on delivery.');
      onClearCart();
      await refreshUserData();
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
      title="Pantry Card Order Cart"
      subtitle="0 COD Delivery • Auto-debited against your Household Credit Limit"
      icon={<CreditCard className="w-5 h-5 text-emerald-600" />}
      size="xl"
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
          Available: ₹{availableLimit.toLocaleString()}
        </span>
      }
    >
      <div className="p-6 space-y-4">
        {/* Limit Tracker Bar */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Available Limit:</span>
            <span className="font-bold text-slate-900">₹{availableLimit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Cart Total:</span>
            <span className="font-bold text-purple-700">₹{totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
            <span className="text-slate-700 font-semibold">Remaining After Checkout:</span>
            <span
              className={`font-black ${
                isLimitExceeded ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              ₹{remainingLimitAfterOrder.toLocaleString()}
            </span>
          </div>

          {isLimitExceeded && (
            <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 p-2 rounded-lg font-medium border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Credit limit exceeded by ₹{Math.abs(remainingLimitAfterOrder)}. Reduce items.</span>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1">
          {items.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Your Pantry Cart is currently empty.
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
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="Enter full delivery address"
            required
          />
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Payable</span>
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
              disabled={items.length === 0 || isLimitExceeded || submitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? 'Placing Order...' : 'Confirm 0 COD Order'}
            </button>
          </div>
        </div>
      </div>
    </AppWindowModal>
  );
};
