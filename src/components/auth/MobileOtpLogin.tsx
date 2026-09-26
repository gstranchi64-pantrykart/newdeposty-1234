import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ShoppingBag, ShieldCheck, Truck, ClipboardCheck, ArrowRight, Phone, KeyRound, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { UserRole } from '../../types';

// Helper to normalize primary & secondary mobile numbers
function clientNormalizeMobile(mobile: string | undefined | null): string {
  if (!mobile) return '';
  const digits = mobile.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export const MobileOtpLogin: React.FC<{ onLoginSuccess?: () => void }> = ({ onLoginSuccess }) => {
  const { loginWithOtp, quickLoginAsRole, isLoading } = useAuth();
  
  // Login flow states
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'MOBILE' | 'OTP'>('MOBILE');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matchedUserName, setMatchedUserName] = useState<string | null>(null);
  const [matchedRole, setMatchedRole] = useState<UserRole | null>(null);

  // Triggered when sending OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    const cleanMobile = clientNormalizeMobile(mobile);

    if (!cleanMobile || cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyMobile(cleanMobile);
      setOtpHint(res.otpHint);
      setMatchedUserName(res.user.name);
      setMatchedRole(res.user.role);
      
      if (res.user.name === 'New Customer') {
        setSuccessMsg('New Mobile Number detected! We have instantly registered your account. Please enter the demo OTP below to continue.');
      } else {
        setSuccessMsg('Account verified successfully. Please enter the demo OTP below to login.');
      }
      
      setStep('OTP');
      setOtp(res.otpHint || '123456'); // Prefilled default for ease of testing
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your mobile number.');
    } finally {
      setLoading(false);
    }
  };

  // Login Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    const cleanMobile = clientNormalizeMobile(mobile);

    if (!otp) {
      setError('Please enter the OTP received.');
      return;
    }

    setLoading(true);
    try {
      setSuccessMsg('LOGIN SUCCESSFUL! Welcome back! Redirecting to your dashboard...');
      await loginWithOtp(cleanMobile, otp);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">PantryMaster</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Dual-Track Fleet ERP</p>
          </div>
        </div>

        {/* PROMINENT COMPULSORY SCAN BANNER */}
        <div className="mt-6 text-center">
          <div className="inline-block bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold text-lg sm:text-xl uppercase px-5 py-2.5 rounded-xl tracking-wider shadow-sm animate-pulse">
            CONSUMER TO SCAN PANTRYKART
          </div>
          <p className="mt-2 text-xs text-slate-400 font-medium">
            New Users: Just enter your mobile number. It will be registered instantly!
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800 py-8 px-6 shadow-2xl rounded-2xl border border-slate-700 sm:px-10">
          
          {/* Notification Messages */}
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs animate-fade-in">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{successMsg}</p>
              </div>
            </div>
          )}

          {/* STEP 1: ENTER MOBILE */}
          {step === 'MOBILE' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="mobile-number-input" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Mobile Number
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="text-xs font-bold text-slate-400 mr-1">+91</span>
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="mobile-number-input"
                    name="mobile"
                    aria-label="10-Digit Mobile Number"
                    type="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-Digit Mobile"
                    className="block w-full pl-16 pr-3 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-semibold tracking-wide"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isLoading || mobile.length < 10}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Continue & Verify
              </button>
            </form>
          )}

          {/* STEP 2: VERIFY OTP */}
          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Mobile: <strong className="text-white font-mono">+91 {mobile}</strong></span>
                  <button
                    type="button"
                    onClick={() => setStep('MOBILE')}
                    className="text-emerald-400 hover:text-emerald-300 underline font-bold"
                  >
                    Change
                  </button>
                </div>
                {matchedUserName && (
                  <div className="mt-1.5 text-slate-400 flex items-center justify-between">
                    <span>User: <strong className="text-slate-200">{matchedUserName}</strong></span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase">
                      {matchedRole}
                    </span>
                  </div>
                )}
                {otpHint && (
                  <div className="mt-2 text-emerald-400 text-xs font-mono bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/50 flex justify-between items-center">
                    <span>Demo OTP (Development Mode):</span>
                    <strong className="text-white text-sm tracking-wider">{otpHint}</strong>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="otp-input" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Enter OTP
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="otp-input"
                    name="otp"
                    aria-label="6-Digit OTP Verification Code"
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-Digit OTP"
                    className="block w-full pl-10 pr-3 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-bold"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isLoading || !otp}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Verify & Login
              </button>
            </form>
          )}

          {/* Quick Pre-configured Test Logins for easy evaluation */}
          <div className="mt-8 border-t border-slate-700/80 pt-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 text-center">
              Quick Test Role Accounts (One-Click)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => quickLoginAsRole('ADMIN')}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 transition text-left cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="font-extrabold text-white text-[11px]">Admin Portal</div>
                  <div className="text-[10px] text-slate-400 font-mono">9876543210</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAsRole('CUSTOMER')}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 transition text-left cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-extrabold text-white text-[11px]">Customer Ramesh</div>
                  <div className="text-[10px] text-slate-400 font-mono">9123456780</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAsRole('DELIVERY_BOY')}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 transition text-left cursor-pointer"
              >
                <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-extrabold text-white text-[11px]">Delivery Partner</div>
                  <div className="text-[10px] text-slate-400 font-mono">9988776655</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLoginAsRole('AUDITOR')}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 transition text-left cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-extrabold text-white text-[11px]">Field Auditor</div>
                  <div className="text-[10px] text-slate-400 font-mono">9876500001</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
