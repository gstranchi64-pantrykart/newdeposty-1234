import React from 'react';
import { ShoppingBag, CreditCard, ShoppingCart, Package, User } from 'lucide-react';
import { Customer, hasPantryAccess } from '../../types';
import { useTheme } from '../../context/ThemeContext';

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
  const { currentTheme } = useTheme();

  return (
    <div
      style={{ borderTop: '2.5px solid var(--theme-primary)' }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md px-2 py-1.5 shadow-2xl"
    >
      <div className="flex items-center justify-around">
        {/* 1. Shop Groceries */}
        <button
          onClick={() => onNavigate('customer-store')}
          style={{
            color: activeView === 'customer-store' ? currentTheme.primary : undefined,
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
            activeView === 'customer-store'
              ? 'font-bold'
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
            style={{
              color: activeView === 'customer-pantry' ? currentTheme.primary : undefined,
            }}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
              activeView === 'customer-pantry'
                ? 'font-bold'
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
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl relative cursor-pointer"
          style={{ color: currentTheme.primary }}
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5 mb-0.5" />
            {quickCartCount > 0 && (
              <span
                style={{
                  backgroundColor: currentTheme.primary,
                  color: currentTheme.textOnPrimary,
                }}
                className="absolute -top-1.5 -right-2 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs"
              >
                {quickCartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold">COD Cart</span>
        </button>

        {/* 4. Orders History */}
        <button
          onClick={() => onNavigate('customer-orders')}
          style={{
            color: activeView === 'customer-orders' ? currentTheme.primary : undefined,
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer ${
            activeView === 'customer-orders'
              ? 'font-bold'
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
          <User className="w-5 h-5 mb-0.5" style={{ color: currentTheme.primary }} />
          <span className="text-[10px]">Profile</span>
        </button>
      </div>
    </div>
  );
};
