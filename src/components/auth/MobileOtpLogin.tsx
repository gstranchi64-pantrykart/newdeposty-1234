import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ShoppingBag, ShieldCheck, Truck, ClipboardCheck, ArrowRight, Phone, KeyRound, AlertCircle, RefreshCw } from 'lucide-react';
import { UserRole } from '../../types';

export const MobileOtpLogin: React.FC<{ onLoginSuccess?: () => void }> = ({ onLoginSuccess }) => {
  const { loginWithOtp, quickLoginAsRole, isLoading } = useAuth();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'MOBILE' | 'OTP'>('MOBILE');
  const [error, setError] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matchedUserName, setMatchedUserName] = useState<string | null>(null);
  const [matchedRole, setMatchedRole] = useState<UserRole | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!mobile || mobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyMobile(mobile);
      setOtpHint(res.otpHint);
      setMatchedUserName(res.user.name);
      setMatchedRole(res.user.role);
      setStep('OTP');
      setOtp(res.otpHint || '123456'); // Pre-fill for ease or let user type
    } catch (err: any) {
      setError(err.message || 'This mobile number is not registered. Please contact administrator.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp) {
      setError('Please enter the OTP received.');
      return;
    }

    setLoading(true);
    try {
      await loginWithOtp(mobile, otp);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSelect = (demoMobile: string, demoRole: UserRole) => {
    setMobile(demoMobile);
    setError(null);
    setStep('MOBILE');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">PantryMart</h1>
            <p className="text-xs text-slate-400 font-medium">Grocery • Pantry Card • Logistics</p>
          </div>
        </div>
        <h2 className="mt-6 text-center text-xl font-semibold text-slate-200">
          Mobile Number + OTP Verification
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Authorized Role Based Portal Access
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-slate-800 py-8 px-6 shadow-xl rounded-2xl border border-slate-700 sm:px-10">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
              </div>
            </div>
          )}

          {step === 'MOBILE' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Enter Registered Mobile Number
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="text-xs font-semibold text-slate-400 mr-1">+91</span>
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="block w-full pl-16 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    required
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  System verifies registered roles: Admin, Customer, Delivery Boy, Auditor.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || isLoading || mobile.length < 10}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Send OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Mobile: <strong className="text-white">+91 {mobile}</strong></span>
                  <button
                    type="button"
                    onClick={() => setStep('MOBILE')}
                    className="text-emerald-400 hover:underline text-[11px]"
                  >
                    Change
                  </button>
                </div>
                {matchedUserName && (
                  <div className="mt-1 text-slate-400 flex items-center justify-between">
                    <span>User: <strong className="text-slate-200">{matchedUserName}</strong></span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                      {matchedRole}
                    </span>
                  </div>
                )}
                {otpHint && (
                  <div className="mt-2 text-emerald-400 text-[11px] font-mono bg-emerald-950/40 p-1.5 rounded border border-emerald-800/50">
                    Test Environment OTP: <strong>{otpHint}</strong>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Enter 6-Digit OTP
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isLoading || !otp}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Verify & Login
              </button>
            </form>
          )}

          {/* Quick Pre-configured Test Logins for easy evaluation */}
          <div className="mt-8 border-t border-slate-700/80 pt-5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">
              Quick Test Role Accounts (One-Click)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => quickLoginAsRole('ADMIN')}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 transition text-left"
              >
                <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">Admin Portal</div>
                  <div className="text-[10px] text-slate-400 font-mono">9876543210</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAsRole('CUSTOMER')}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 transition text-left"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">Customer (Parent)</div>
                  <div className="text-[10px] text-slate-400 font-mono">CUS-000001</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAsRole('DELIVERY_BOY')}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 transition text-left"
              >
                <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">Delivery Boy</div>
                  <div className="text-[10px] text-slate-400 font-mono">DEL-001 Rajesh</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAsRole('AUDITOR')}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 transition text-left"
              >
                <ClipboardCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">Field Auditor</div>
                  <div className="text-[10px] text-slate-400 font-mono">AUD-001 Suresh</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
