import React from 'react';
import { ShoppingBag, CreditCard, ShoppingCart, Package, User } from 'lucide-react';
import { Customer, hasPantryAccess } from '../../types';

interface CustomerBottomNavProps {
  activeView: string;
  onNavigate: (view: string) => void;
  pantryCartCount: number;
  quickCartCount: number;
  onOpenPantryCart: () => void;
  onOpenQuickCart: () => void;
  onOpenProfile: () => void;
  customer: Customer | null;
}

export const CustomerBottomNav: React.FC<CustomerBottomNavProps> = ({
  activeView,
  onNavigate,
  pantryCartCount,
  quickCartCount,
  onOpenPantryCart,
  onOpenQuickCart,
  onOpenProfile,
  customer,
}) => {
  const isPantryAllowed = hasPantryAccess(customer);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 shadow-2xl">
      <div className="flex items-center justify-around">
        
        {/* 1. Shop Groceries */}
        <button
          onClick={() => onNavigate('customer-store')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
            activeView === 'customer-store'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Shop</span>
        </button>

        {/* 2. Pantry Card (If eligible) */}
        {isPantryAllowed && (
          <button
            onClick={() => onNavigate('customer-pantry')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
              activeView === 'customer-pantry'
                ? 'text-purple-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Pantry</span>
          </button>
        )}

        {/* 3. Quick Cart Trigger */}
        <button
          onClick={onOpenQuickCart}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-amber-400 relative cursor-pointer"
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5 mb-0.5" />
            {quickCartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-amber-500 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {quickCartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] text-amber-300 font-semibold">COD Cart</span>
        </button>

        {/* 4. Orders History */}
        <button
          onClick={() => onNavigate('customer-orders')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
            activeView === 'customer-orders'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Orders</span>
        </button>

        {/* 5. Profile & Passbook */}
        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <User className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">Profile</span>
        </button>

      </div>
    </div>
  );
};
