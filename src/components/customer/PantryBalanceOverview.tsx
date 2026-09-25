import React from 'react';
import { Customer, hasPantryAccess } from '../../types';
import { CreditCard, Wallet, ShieldCheck, PieChart, ArrowUpRight } from 'lucide-react';

interface PantryBalanceOverviewProps {
  customer: Customer;
  onOpenPantryPay?: () => void;
}

export const PantryBalanceOverview: React.FC<PantryBalanceOverviewProps> = ({
  customer,
  onOpenPantryPay,
}) => {
  const totalLimit = customer.pantryLimit || 10000;
  const usedLimit = customer.usedPantryLimit || 0;
  const availableLimit = customer.availablePantryLimit ?? (totalLimit - usedLimit);

  const usedPercentage = Math.min(100, Math.max(0, Math.round((usedLimit / totalLimit) * 100)));

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-slate-700/80 relative overflow-hidden space-y-5">
      {/* Background Decorative Graphic */}
      <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
      <div className="absolute -left-10 -top-10 w-44 h-44 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-wide text-white">Digital Pantry Credit Overview</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Revolving Credit Line
              </span>
            </div>
            <p className="text-xs text-slate-400">Admin-approved revolving credit cap &amp; live available balance</p>
          </div>
        </div>

        {onOpenPantryPay && hasPantryAccess(customer) && (
          <button
            onClick={onOpenPantryPay}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>Pantry Pay</span>
            <ArrowUpRight className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </div>

      {/* Progress Bar Card */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3 relative z-10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Credit Limit Usage</span>
          <span className="font-extrabold text-emerald-400">{usedPercentage}% Used</span>
        </div>

        {/* Bar */}
        <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/60 flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${usedPercentage}%` }}
          />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Limit</div>
            <div className="text-sm font-extrabold text-slate-200 mt-0.5">
              ₹{totalLimit.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
            <div className="text-[10px] uppercase font-bold text-slate-400">Used Credit</div>
            <div className="text-sm font-extrabold text-amber-400 mt-0.5">
              ₹{usedLimit.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
            <div className="text-[10px] uppercase font-bold text-slate-400">Available</div>
            <div className="text-sm font-extrabold text-emerald-400 mt-0.5">
              ₹{availableLimit.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Balance Badge */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 relative z-10">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-medium">Customer Wallet Balance:</span>
          <span className="font-bold text-emerald-300">₹{(customer.walletBalance ?? 1000).toLocaleString('en-IN')}</span>
        </div>
        <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>Auditor Wallet Deductions Only</span>
        </div>
      </div>
    </div>
  );
};
