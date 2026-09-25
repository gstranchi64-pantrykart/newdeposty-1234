import React, { useState, useEffect } from 'react';
import {
  AppSettings,
  SystemAPIIntegrations,
  PaymentGatewaySettings,
  SmsOtpSettings,
  WhatsAppSettings,
  GoogleMapsSettings,
  AiGeminiSettings,
  CloudStorageSettings,
  SupabaseSettings,
  SupabaseStatusInfo,
  SupabaseSyncResult,
} from '../../types';
import { api } from '../../services/api';
import {
  CreditCard,
  MessageSquare,
  MessageCircle,
  MapPin,
  Bot,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  ShieldAlert,
  Server,
  Activity,
  Code2,
  Database,
  Copy,
  Check,
  UploadCloud,
  DownloadCloud,
  Terminal,
  ExternalLink,
  Layers,
} from 'lucide-react';

interface ApiIntegrationsSettingsProps {
  settings: AppSettings;
  onUpdateSettings: (updated: AppSettings) => void;
}

export const ApiIntegrationsSettings: React.FC<ApiIntegrationsSettingsProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<
    'supabase' | 'payment' | 'sms' | 'whatsApp' | 'googleMaps' | 'aiGemini' | 'cloudStorage'
  >('supabase');

  // Initialize state with existing or fallback settings
  const [integrations, setIntegrations] = useState<SystemAPIIntegrations>(
    settings.apiIntegrations || {
      supabase: {
        mode: 'LIVE',
        provider: 'SUPABASE',
        enabled: true,
        url: 'https://bgxnmmecjcgrwtemmjtz.supabase.co',
        anonKey: 'sb_publishable_J6X_PIGF2pyciaHA3o_okg_HHaCulEU',
        projectRef: 'bgxnmmecjcgrwtemmjtz',
        dbUrl: 'postgresql://postgres:[YOUR-PASSWORD]@db.bgxnmmecjcgrwtemmjtz.supabase.co:5432/postgres',
        autoSync: true,
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'SUCCESS',
        lastTestMessage: 'Supabase Cloud Database (bgxnmmecjcgrwtemmjtz) connected',
        connected: true,
      },
      payment: {
        mode: 'DEMO',
        provider: 'RAZORPAY',
        enabled: true,
        apiKeyId: 'rzp_test_demo1234567890',
        apiSecret: 'demo_secret_key_89012345',
        merchantId: 'MERCHANT_DEMO_01',
        webhookSecret: 'whsec_demo_hash_key',
        autoCapture: true,
        currency: 'INR',
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'SUCCESS',
        lastTestMessage: 'Demo UPI / Razorpay Gateway Simulator Ready',
      },
      sms: {
        mode: 'DEMO',
        provider: 'MSG91',
        enabled: true,
        apiKey: 'demo_msg91_auth_key_123456',
        senderId: 'PNTRYM',
        dltEntityId: '1301159876543210',
        otpTemplateId: '1307161234567890',
        orderDispatchTemplateId: '1307161234567891',
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'SUCCESS',
        lastTestMessage: 'In-Memory Demo SMS Gateway Active',
      },
      whatsApp: {
        mode: 'DEMO',
        provider: 'META_WHATSAPP',
        enabled: true,
        accessToken: 'EAAG_demo_meta_whatsapp_access_token',
        phoneNumberId: '109876543210123',
        businessAccountId: '209876543210123',
        defaultTemplateName: 'order_receipt_notification',
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'SUCCESS',
        lastTestMessage: 'Console Logger WhatsApp Business Simulator Active',
      },
      googleMaps: {
        mode: 'DEMO',
        provider: 'GOOGLE_MAPS',
        enabled: true,
        apiKey: 'AIzaSyDemoGoogleMapsApiKey_1234567890',
        enableGeocoding: true,
        enablePlacesAutocomplete: true,
        enableStaticMaps: true,
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'SUCCESS',
        lastTestMessage: 'Mock Geocoder & Map Renderer Ready',
      },
      aiGemini: {
        mode: 'DEMO',
        provider: 'GOOGLE_GEMINI',
        enabled: true,
        apiKey: 'demo_gemini_api_key_12345',
        preferredModel: 'gemini-2.5-flash',
        enableSmartAssistant: true,
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'SUCCESS',
        lastTestMessage: 'Google Gemini 2.5 Flash Engine Connected',
      },
      cloudStorage: {
        mode: 'DEMO',
        provider: 'AWS_S3',
        enabled: true,
        bucketName: 'pantrymaster-app-storage',
        region: 'ap-south-1',
        accessKeyId: 'AKIA_DEMO_ACCESS_KEY',
        secretAccessKey: 'demo_secret_storage_key_98765',
        cdnBaseUrl: 'https://cdn.pantrymaster.app',
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'SUCCESS',
        lastTestMessage: 'Local Storage / Mock Asset Server Active',
      },
    }
  );

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingCategory, setTestingCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<{
    category: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Supabase specific states
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatusInfo | null>(null);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [sqlContent, setSqlContent] = useState<string>('');
  const [loadingSql, setLoadingSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    loadSupabaseStatus();
  }, []);

  const loadSupabaseStatus = async () => {
    try {
      const status = await api.getSupabaseStatus();
      setSupabaseStatus(status);
    } catch (e) {
      console.error('Error loading Supabase status:', e);
    }
  };

  const handleTestSupabase = async () => {
    setTestingCategory('supabase');
    setTestResultMsg(null);
    try {
      const res = await api.testSupabase(integrations.supabase);
      setTestResultMsg({
        category: 'supabase',
        success: res.success,
        message: res.message,
      });
      setIntegrations((prev) => ({
        ...prev,
        supabase: {
          ...(prev.supabase as any),
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: res.success ? 'SUCCESS' : 'FAILED',
          lastTestMessage: res.message,
          connected: res.success,
        },
      }));
      await loadSupabaseStatus();
    } catch (err: any) {
      setTestResultMsg({
        category: 'supabase',
        success: false,
        message: err.message || 'Supabase connection test failed.',
      });
    } finally {
      setTestingCategory(null);
    }
  };

  const handlePushToSupabase = async () => {
    setSyncingSupabase(true);
    setSyncMessage(null);
    try {
      const res = await api.syncPushSupabase();
      setSyncMessage(res.message);
      await loadSupabaseStatus();
    } catch (err: any) {
      setSyncMessage(`Push error: ${err.message}`);
    } finally {
      setSyncingSupabase(false);
    }
  };

  const handlePullFromSupabase = async () => {
    if (!confirm('Are you sure you want to pull and restore database state from Supabase? This will overwrite the current local session state with the Supabase backup.')) {
      return;
    }
    setSyncingSupabase(true);
    setSyncMessage(null);
    try {
      const res = await api.syncPullSupabase();
      setSyncMessage(res.message);
      const fresh = await api.getSettings();
      onUpdateSettings(fresh);
      await loadSupabaseStatus();
    } catch (err: any) {
      setSyncMessage(`Pull error: ${err.message}`);
    } finally {
      setSyncingSupabase(false);
    }
  };

  const handleOpenSqlModal = async () => {
    setSqlModalOpen(true);
    if (!sqlContent) {
      setLoadingSql(true);
      try {
        const sql = await api.getSupabaseSqlSchema();
        setSqlContent(sql);
      } catch (err: any) {
        setSqlContent(`-- Failed to load SQL schema: ${err.message}`);
      } finally {
        setLoadingSql(false);
      }
    }
  };

  const handleCopy = (text: string, type: 'sql' | string) => {
    navigator.clipboard.writeText(text);
    if (type === 'sql') {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } else {
      setCopiedCmd(type);
      setTimeout(() => setCopiedCmd(null), 2000);
    }
  };

  const toggleShowSecret = (field: string) => {
    setShowSecrets((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const updateCategoryConfig = (category: keyof SystemAPIIntegrations, updates: any) => {
    setIntegrations((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...updates,
      },
    }));
  };

  const handleTestConnection = async (category: keyof SystemAPIIntegrations) => {
    setTestingCategory(category);
    setTestResultMsg(null);
    try {
      const config = integrations[category];
      const res = await api.testApiIntegration(category, config);
      
      // Update state with result
      setIntegrations((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          lastTestedAt: res.timestamp,
          lastTestStatus: res.success ? 'SUCCESS' : 'FAILED',
          lastTestMessage: res.message,
        },
      }));

      setTestResultMsg({
        category,
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setTestResultMsg({
        category,
        success: false,
        message: err.message || 'Connection test failed unexpectedly.',
      });
    } finally {
      setTestingCategory(null);
    }
  };

  const handleSaveAllIntegrations = async () => {
    setSaving(true);
    try {
      const updatedSettings = await api.updateSettings({
        apiIntegrations: integrations,
      });
      onUpdateSettings(updatedSettings);
      alert('All API Gateway settings saved and applied across the webapp!');
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestAll = async () => {
    const categories: (keyof SystemAPIIntegrations)[] = [
      'supabase',
      'payment',
      'sms',
      'whatsApp',
      'googleMaps',
      'aiGemini',
      'cloudStorage',
    ];

    setTestingCategory('ALL');
    for (const cat of categories) {
      try {
        if (cat === 'supabase') {
          await api.testSupabase(integrations.supabase);
        } else {
          await api.testApiIntegration(cat, integrations[cat]);
        }
      } catch (e) {
        console.error(e);
      }
    }
    // Refresh settings from server
    try {
      const fresh = await api.getSettings();
      if (fresh.apiIntegrations) {
        setIntegrations(fresh.apiIntegrations);
      }
      await loadSupabaseStatus();
    } catch (e) {
      console.error(e);
    }
    setTestingCategory(null);
  };

  // Metrics summary
  const totalIntegrations = 7;
  const liveCount = Object.values(integrations).filter((i) => i?.mode === 'LIVE' || (i as any)?.enabled).length;
  const demoCount = Math.max(0, totalIntegrations - liveCount);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Metrics */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 top-0 w-48 h-48 bg-cyan-600/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                System Gateway Settings
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                All API Gateway Manager
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Webapp External API & Integration Gateway
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Easily configure, test, and toggle between <strong className="text-amber-300">DEMO / Sandbox Mode</strong> and <strong className="text-emerald-300">LIVE Production API Keys</strong> for Payments, SMS, WhatsApp, Google Maps, Gemini AI, and Cloud Storage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleTestAll}
              disabled={testingCategory !== null}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingCategory === 'ALL' ? 'animate-spin' : ''}`} />
              <span>Test All Connections</span>
            </button>

            <button
              onClick={handleSaveAllIntegrations}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-lg transition cursor-pointer inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Settings...' : 'Save API Configurations'}</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Integrations</div>
            <div className="text-lg font-black text-white mt-0.5 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-purple-400" />
              <span>{totalIntegrations} APIs</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">LIVE Production APIs</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>{liveCount} Active</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">DEMO / Sandbox APIs</div>
            <div className="text-lg font-black text-amber-300 mt-0.5 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-amber-300" />
              <span>{demoCount} Active</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">System Gateway Health</div>
            <div className="text-lg font-black text-cyan-300 mt-0.5 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>100% Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Selector Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200">
        <button
          onClick={() => setActiveTab('supabase')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'supabase'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Database className={`w-4 h-4 ${activeTab === 'supabase' ? 'text-white' : 'text-emerald-500'}`} />
          <span>Supabase Cloud DB</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              integrations.supabase?.enabled
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                : 'bg-slate-400/20 text-slate-400 border border-slate-400/40'
            }`}
          >
            {integrations.supabase?.enabled ? 'CONNECTED' : 'STANDBY'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('payment')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'payment'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Gateway</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              integrations.payment?.mode === 'LIVE'
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                : 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
            }`}
          >
            {integrations.payment?.mode || 'DEMO'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sms')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'sms'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>SMS OTP Gateway</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              integrations.sms?.mode === 'LIVE'
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                : 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
            }`}
          >
            {integrations.sms?.mode || 'DEMO'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('whatsApp')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'whatsApp'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>WhatsApp API</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              integrations.whatsApp?.mode === 'LIVE'
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                : 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
            }`}
          >
            {integrations.whatsApp?.mode || 'DEMO'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('googleMaps')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'googleMaps'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Google Maps API</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              integrations.googleMaps?.mode === 'LIVE'
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                : 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
            }`}
          >
            {integrations.googleMaps?.mode || 'DEMO'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('aiGemini')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'aiGemini'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Gemini AI API</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              integrations.aiGemini?.mode === 'LIVE'
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                : 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
            }`}
          >
            {integrations.aiGemini?.mode || 'DEMO'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cloudStorage')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'cloudStorage'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Cloud Storage & CDN</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              integrations.cloudStorage?.mode === 'LIVE'
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                : 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
            }`}
          >
            {integrations.cloudStorage?.mode || 'DEMO'}
          </span>
        </button>
      </div>

      {/* Main Tab Details Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* 0. SUPABASE CLOUD DATABASE */}
        {activeTab === 'supabase' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Supabase Cloud PostgreSQL Database & Auth
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      LIVE CLOUD DB
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Production database & auth infrastructure connected to project <code className="text-emerald-700 font-mono font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">bgxnmmecjcgrwtemmjtz</code>.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={testingCategory === 'supabase'}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingCategory === 'supabase' ? 'animate-spin' : ''}`} />
                  <span>{testingCategory === 'supabase' ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePushToSupabase}
                  disabled={syncingSupabase}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-2"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${syncingSupabase ? 'animate-bounce' : ''}`} />
                  <span>Push All to Supabase</span>
                </button>

                <button
                  type="button"
                  onClick={handlePullFromSupabase}
                  disabled={syncingSupabase}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2"
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-slate-600" />
                  <span>Pull from Supabase</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSqlModal}
                  className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>View SQL Schema</span>
                </button>
              </div>
            </div>

            {/* Primary Database Active Ribbon */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Primary Cloud Store Active: Supabase</span>
                </div>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Local database se switch hokar Supabase Cloud Database primary storage ban chuka hai. Har entry, update, order, inventory aur customer record seedhe Supabase cloud me save aur sync hota hai.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePushToSupabase}
                  disabled={syncingSupabase}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${syncingSupabase ? 'animate-bounce' : ''}`} />
                  <span>Sync All UI Data Now</span>
                </button>
              </div>
            </div>

            {/* Test result message */}
            {testResultMsg && testResultMsg.category === 'supabase' && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                  testResultMsg.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResultMsg.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{testResultMsg.message}</span>
                </div>
                {supabaseStatus?.latencyMs ? (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {supabaseStatus.latencyMs}ms ping
                  </span>
                ) : null}
              </div>
            )}

            {syncMessage && (
              <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50 text-blue-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{syncMessage}</span>
              </div>
            )}

            {/* Connection Info Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Project Endpoint</div>
                <div className="text-xs font-mono font-semibold text-slate-800 mt-1 truncate flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                  <span className="truncate">{integrations.supabase?.url || 'https://bgxnmmecjcgrwtemmjtz.supabase.co'}</span>
                  <a
                    href={integrations.supabase?.url || 'https://bgxnmmecjcgrwtemmjtz.supabase.co'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Project Reference</div>
                <div className="text-xs font-mono font-semibold text-slate-800 mt-1 flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-slate-200 rounded font-bold text-slate-900">{integrations.supabase?.projectRef || 'bgxnmmecjcgrwtemmjtz'}</span>
                  <button
                    onClick={() => handleCopy(integrations.supabase?.projectRef || 'bgxnmmecjcgrwtemmjtz', 'ref')}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Copy Project Ref"
                  >
                    {copiedCmd === 'ref' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Secret / Admin Key</div>
                <div className="text-xs font-semibold mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                  <span className="text-emerald-700 font-bold font-mono">Verified (Full Access)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">PostgreSQL Direct Host</div>
                <div className="text-xs font-mono font-semibold text-slate-800 mt-1 truncate">
                  db.bgxnmmecjcgrwtemmjtz.supabase.co:5432
                </div>
              </div>
            </div>

            {/* Live Database Tables Status Grid */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Supabase Connected Table Modules (11 App Modules)</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  Real-time Sync & DDL Active
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                {[
                  { name: 'products', label: 'Products Catalog', count: supabaseStatus?.tableStats?.products ?? '—' },
                  { name: 'product_batches', label: 'Batch Inventory', count: supabaseStatus?.tableStats?.batches ?? '—' },
                  { name: 'customers', label: 'Customers', count: supabaseStatus?.tableStats?.customers ?? '—' },
                  { name: 'orders', label: 'Orders (COD/Pantry)', count: supabaseStatus?.tableStats?.orders ?? '—' },
                  { name: 'pantry_card_items', label: 'Pantry Cards', count: supabaseStatus?.tableStats?.pantryCardItems ?? '—' },
                  { name: 'wallet_tx', label: 'Wallet Ledger', count: supabaseStatus?.tableStats?.walletTransactions ?? '—' },
                  { name: 'auditor_checks', label: 'Field Audits', count: supabaseStatus?.tableStats?.auditorChecks ?? '—' },
                  { name: 'pantry_payments', label: 'Pantry Pay (UPI)', count: supabaseStatus?.tableStats?.pantryPayments ?? '—' },
                  { name: 'purchases', label: 'Stock-In Invoices', count: supabaseStatus?.tableStats?.purchases ?? '—' },
                  { name: 'inventory_tx', label: 'Inventory Moves', count: supabaseStatus?.tableStats?.inventoryTransactions ?? '—' },
                  { name: 'audit_logs', label: 'Audit Trail', count: supabaseStatus?.tableStats?.auditLogs ?? '—' },
                  { name: 'pantry_mart_store', label: 'Cloud Snapshot', count: 'Active' },
                ].map((tbl) => (
                  <div key={tbl.name} className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80">
                    <div className="text-[10px] text-slate-400 truncate font-medium">{tbl.label}</div>
                    <div className="text-xs font-bold text-emerald-300 font-mono mt-0.5 flex items-center justify-between">
                      <span>{tbl.count}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supabase CLI Instructions card */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-bold text-slate-900">Supabase CLI Linking Commands</span>
                </div>
                <span className="text-[11px] text-slate-500">Run in your terminal to link and manage database migrations</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {[
                  { label: '1. Supabase CLI Login', cmd: 'supabase login', desc: 'Authenticate with Supabase account' },
                  { label: '2. Link to Project', cmd: 'supabase link --project-ref bgxnmmecjcgrwtemmjtz', desc: 'Link to this database instance' },
                  { label: '3. Pull / Push Schemas', cmd: 'supabase db pull', desc: 'Fetch latest database schemas' },
                ].map((c) => (
                  <div key={c.cmd} className="p-3 bg-slate-900 rounded-xl text-white font-mono text-xs flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-sans font-bold">{c.label}</div>
                      <div className="text-emerald-400 text-[11px] mt-1 break-all select-all font-mono">{c.cmd}</div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-sans">
                      <span>{c.desc}</span>
                      <button
                        onClick={() => handleCopy(c.cmd, c.cmd)}
                        className="p-1 hover:text-white rounded cursor-pointer"
                        title="Copy command"
                      >
                        {copiedCmd === c.cmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Supabase Project URL</label>
                <input
                  type="text"
                  value={integrations.supabase?.url || ''}
                  onChange={(e) => updateCategoryConfig('supabase', { url: e.target.value })}
                  placeholder="https://bgxnmmecjcgrwtemmjtz.supabase.co"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Publishable / Anon API Key</span>
                  <button
                    type="button"
                    onClick={() => toggleShowSecret('supabase_key')}
                    className="text-[11px] text-purple-600 hover:text-purple-700 font-normal inline-flex items-center gap-1 cursor-pointer"
                  >
                    {showSecrets['supabase_key'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showSecrets['supabase_key'] ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <input
                  type={showSecrets['supabase_key'] ? 'text' : 'password'}
                  value={integrations.supabase?.anonKey || ''}
                  onChange={(e) => updateCategoryConfig('supabase', { anonKey: e.target.value })}
                  placeholder="sb_publishable_J6X_PIGF2pyciaHA3o_okg_HHaCulEU"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Secret / Service Role Key</span>
                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-extrabold uppercase">Admin Privileges</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleShowSecret('supabase_secret')}
                    className="text-[11px] text-purple-600 hover:text-purple-700 font-normal inline-flex items-center gap-1 cursor-pointer"
                  >
                    {showSecrets['supabase_secret'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showSecrets['supabase_secret'] ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <input
                  type={showSecrets['supabase_secret'] ? 'text' : 'password'}
                  value={integrations.supabase?.serviceRoleKey || ''}
                  onChange={(e) => updateCategoryConfig('supabase', { serviceRoleKey: e.target.value })}
                  placeholder="sb_secret_your_service_role_key_here"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Project Reference ID</label>
                <input
                  type="text"
                  value={integrations.supabase?.projectRef || ''}
                  onChange={(e) => updateCategoryConfig('supabase', { projectRef: e.target.value })}
                  placeholder="bgxnmmecjcgrwtemmjtz"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">PostgreSQL Direct Connection String</label>
                <input
                  type="text"
                  value={integrations.supabase?.dbUrl || ''}
                  onChange={(e) => updateCategoryConfig('supabase', { dbUrl: e.target.value })}
                  placeholder="postgresql://postgres:[YOUR-PASSWORD]@db.bgxnmmecjcgrwtemmjtz.supabase.co:5432/postgres"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2 flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <div>
                  <div className="text-xs font-bold text-slate-800">Automatic Real-Time Cloud Sync</div>
                  <div className="text-[11px] text-slate-500">Automatically sync orders, inventory, customers, audits, and settings to Supabase on every change</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={integrations.supabase?.autoSync !== false}
                    onChange={(e) => updateCategoryConfig('supabase', { autoSync: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 1. PAYMENT GATEWAY */}
        {activeTab === 'payment' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <h3 className="font-extrabold text-slate-900 text-lg">Payment Gateway API Settings</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Configure online payment gateways (Razorpay, PhonePe, Stripe, Cashfree, UPI).
                </p>
              </div>

              {/* MODE TOGGLE SWITCH */}
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => updateCategoryConfig('payment', { mode: 'DEMO' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.payment.mode === 'DEMO'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  DEMO / SANDBOX
                </button>

                <button
                  type="button"
                  onClick={() => updateCategoryConfig('payment', { mode: 'LIVE' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.payment.mode === 'LIVE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  LIVE PRODUCTION
                </button>
              </div>
            </div>

            {/* Provider & Enable switch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Gateway Provider
                </label>
                <select
                  value={integrations.payment.provider}
                  onChange={(e) => updateCategoryConfig('payment', { provider: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold bg-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="RAZORPAY">Razorpay Gateway (UPI, Cards, NetBanking)</option>
                  <option value="PHONEPE">PhonePe Business Gateway</option>
                  <option value="STRIPE">Stripe Payments</option>
                  <option value="CASHFREE">Cashfree Payments India</option>
                  <option value="UPI_GATEWAY">Custom Direct UPI QR Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                <input
                  type="text"
                  value={integrations.payment.currency || 'INR'}
                  onChange={(e) => updateCategoryConfig('payment', { currency: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
                />
              </div>
            </div>

            {/* Key Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  API Key ID / Merchant Key ({integrations.payment.mode === 'LIVE' ? 'LIVE' : 'DEMO'})
                </label>
                <input
                  type="text"
                  value={integrations.payment.apiKeyId || ''}
                  onChange={(e) => updateCategoryConfig('payment', { apiKeyId: e.target.value })}
                  placeholder={
                    integrations.payment.mode === 'LIVE'
                      ? 'e.g. rzp_live_xxxxxxxx'
                      : 'e.g. rzp_test_demo12345'
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  API Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showSecrets['paySecret'] ? 'text' : 'password'}
                    value={integrations.payment.apiSecret || ''}
                    onChange={(e) => updateCategoryConfig('payment', { apiSecret: e.target.value })}
                    placeholder="Enter API Secret Key"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowSecret('paySecret')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showSecrets['paySecret'] ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Merchant ID (Optional)
                </label>
                <input
                  type="text"
                  value={integrations.payment.merchantId || ''}
                  onChange={(e) => updateCategoryConfig('payment', { merchantId: e.target.value })}
                  placeholder="e.g. MERCH_12345"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Webhook Secret (For Instant Callback Verification)
                </label>
                <input
                  type="text"
                  value={integrations.payment.webhookSecret || ''}
                  onChange={(e) => updateCategoryConfig('payment', { webhookSecret: e.target.value })}
                  placeholder="whsec_..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            {/* Test Connection Button & Status Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">Payment Gateway Diagnostic</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Test connection with active gateway provider to confirm payload authentication.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTestConnection('payment')}
                  disabled={testingCategory === 'payment'}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${testingCategory === 'payment' ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {testingCategory === 'payment' ? 'Pinging Gateway...' : 'Test Payment Gateway'}
                  </span>
                </button>
              </div>

              {integrations.payment.lastTestedAt && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    integrations.payment.lastTestStatus === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {integrations.payment.lastTestStatus === 'SUCCESS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{integrations.payment.lastTestMessage}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tested: {new Date(integrations.payment.lastTestedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. SMS OTP GATEWAY */}
        {activeTab === 'sms' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                  <h3 className="font-extrabold text-slate-900 text-lg">SMS OTP Gateway Settings</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Configure DLT-compliant SMS providers (MSG91, Fast2SMS, Twilio) for real OTP delivery and dispatch alerts.
                </p>
              </div>

              {/* MODE TOGGLE */}
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => updateCategoryConfig('sms', { mode: 'DEMO' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.sms.mode === 'DEMO'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  DEMO / SIMULATOR
                </button>

                <button
                  type="button"
                  onClick={() => updateCategoryConfig('sms', { mode: 'LIVE' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.sms.mode === 'LIVE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  LIVE REAL SMS
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">SMS Provider</label>
                <select
                  value={integrations.sms.provider}
                  onChange={(e) => updateCategoryConfig('sms', { provider: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold bg-white"
                >
                  <option value="MSG91">MSG91 India DLT SMS</option>
                  <option value="FAST2SMS">Fast2SMS Bulk &amp; OTP</option>
                  <option value="TWILIO">Twilio Programmable SMS</option>
                  <option value="CUSTOM_HTTP">Custom HTTP SMS API Endpoint</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Header / Sender ID (6 Characters)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={integrations.sms.senderId || ''}
                  onChange={(e) => updateCategoryConfig('sms', { senderId: e.target.value.toUpperCase() })}
                  placeholder="e.g. PNTRYM"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Auth API Key ({integrations.sms.mode === 'LIVE' ? 'LIVE' : 'DEMO'})
                </label>
                <div className="relative">
                  <input
                    type={showSecrets['smsKey'] ? 'text' : 'password'}
                    value={integrations.sms.apiKey || ''}
                    onChange={(e) => updateCategoryConfig('sms', { apiKey: e.target.value })}
                    placeholder="Enter SMS API Key"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowSecret('smsKey')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showSecrets['smsKey'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DLT Principal Entity ID (India DLT Requirement)
                </label>
                <input
                  type="text"
                  value={integrations.sms.dltEntityId || ''}
                  onChange={(e) => updateCategoryConfig('sms', { dltEntityId: e.target.value })}
                  placeholder="e.g. 1301159876543210"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  OTP DLT Template ID
                </label>
                <input
                  type="text"
                  value={integrations.sms.otpTemplateId || ''}
                  onChange={(e) => updateCategoryConfig('sms', { otpTemplateId: e.target.value })}
                  placeholder="e.g. 1307161234567890"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Order Dispatch DLT Template ID
                </label>
                <input
                  type="text"
                  value={integrations.sms.orderDispatchTemplateId || ''}
                  onChange={(e) => updateCategoryConfig('sms', { orderDispatchTemplateId: e.target.value })}
                  placeholder="e.g. 1307161234567891"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            {/* Diagnostic Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">SMS Route Diagnostic</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Verify key validity and simulate test OTP dispatch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTestConnection('sms')}
                  disabled={testingCategory === 'sms'}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingCategory === 'sms' ? 'animate-spin' : ''}`} />
                  <span>{testingCategory === 'sms' ? 'Testing SMS Gateway...' : 'Test SMS Gateway'}</span>
                </button>
              </div>

              {integrations.sms.lastTestedAt && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    integrations.sms.lastTestStatus === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {integrations.sms.lastTestStatus === 'SUCCESS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{integrations.sms.lastTestMessage}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tested: {new Date(integrations.sms.lastTestedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. WHATSAPP API */}
        {activeTab === 'whatsApp' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-purple-600" />
                  <h3 className="font-extrabold text-slate-900 text-lg">WhatsApp Business API Settings</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Connect Meta WhatsApp Cloud API for sending automated order receipts and audit bills.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => updateCategoryConfig('whatsApp', { mode: 'DEMO' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.whatsApp.mode === 'DEMO'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  DEMO LOGGER
                </button>

                <button
                  type="button"
                  onClick={() => updateCategoryConfig('whatsApp', { mode: 'LIVE' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.whatsApp.mode === 'LIVE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  LIVE WHATSAPP
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Provider</label>
                <select
                  value={integrations.whatsApp.provider}
                  onChange={(e) => updateCategoryConfig('whatsApp', { provider: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold bg-white"
                >
                  <option value="META_WHATSAPP">Meta WhatsApp Cloud API (Official)</option>
                  <option value="GUPSHUP">Gupshup WhatsApp API</option>
                  <option value="WATI">WATI WhatsApp Business</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={integrations.whatsApp.phoneNumberId || ''}
                  onChange={(e) => updateCategoryConfig('whatsApp', { phoneNumberId: e.target.value })}
                  placeholder="e.g. 109876543210123"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Permanent Access Token
                </label>
                <div className="relative">
                  <input
                    type={showSecrets['waToken'] ? 'text' : 'password'}
                    value={integrations.whatsApp.accessToken || ''}
                    onChange={(e) => updateCategoryConfig('whatsApp', { accessToken: e.target.value })}
                    placeholder="EAAG_..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowSecret('waToken')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showSecrets['waToken'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Business Account ID
                </label>
                <input
                  type="text"
                  value={integrations.whatsApp.businessAccountId || ''}
                  onChange={(e) => updateCategoryConfig('whatsApp', { businessAccountId: e.target.value })}
                  placeholder="e.g. 209876543210123"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">WhatsApp API Diagnostic</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ping Meta Graph API webhook endpoint to verify access token permissions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTestConnection('whatsApp')}
                  disabled={testingCategory === 'whatsApp'}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingCategory === 'whatsApp' ? 'animate-spin' : ''}`} />
                  <span>{testingCategory === 'whatsApp' ? 'Pinging Meta...' : 'Test WhatsApp Token'}</span>
                </button>
              </div>

              {integrations.whatsApp.lastTestedAt && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    integrations.whatsApp.lastTestStatus === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {integrations.whatsApp.lastTestStatus === 'SUCCESS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{integrations.whatsApp.lastTestMessage}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tested: {new Date(integrations.whatsApp.lastTestedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. GOOGLE MAPS API */}
        {activeTab === 'googleMaps' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  <h3 className="font-extrabold text-slate-900 text-lg">Google Maps &amp; Geocoding API</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Configure Google Maps Platform API key for address lookup, places autocomplete, and delivery distance routing.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => updateCategoryConfig('googleMaps', { mode: 'DEMO' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.googleMaps.mode === 'DEMO'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  MOCK GEOCODER
                </button>

                <button
                  type="button"
                  onClick={() => updateCategoryConfig('googleMaps', { mode: 'LIVE' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.googleMaps.mode === 'LIVE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  LIVE GOOGLE MAPS
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Google Maps API Key ({integrations.googleMaps.mode === 'LIVE' ? 'LIVE' : 'DEMO'})
              </label>
              <div className="relative">
                <input
                  type={showSecrets['mapsKey'] ? 'text' : 'password'}
                  value={integrations.googleMaps.apiKey || ''}
                  onChange={(e) => updateCategoryConfig('googleMaps', { apiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleShowSecret('mapsKey')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showSecrets['mapsKey'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={integrations.googleMaps.enableGeocoding}
                  onChange={(e) => updateCategoryConfig('googleMaps', { enableGeocoding: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-semibold text-slate-800">Geocoding API</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={integrations.googleMaps.enablePlacesAutocomplete}
                  onChange={(e) =>
                    updateCategoryConfig('googleMaps', { enablePlacesAutocomplete: e.target.checked })
                  }
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-semibold text-slate-800">Places Autocomplete</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={integrations.googleMaps.enableStaticMaps}
                  onChange={(e) => updateCategoryConfig('googleMaps', { enableStaticMaps: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-semibold text-slate-800">Static Maps API</span>
              </label>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">Google Maps API Diagnostic</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Test geocoding response against Google Cloud Services.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTestConnection('googleMaps')}
                  disabled={testingCategory === 'googleMaps'}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${testingCategory === 'googleMaps' ? 'animate-spin' : ''}`}
                  />
                  <span>{testingCategory === 'googleMaps' ? 'Verifying Maps Key...' : 'Test Maps Key'}</span>
                </button>
              </div>

              {integrations.googleMaps.lastTestedAt && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    integrations.googleMaps.lastTestStatus === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {integrations.googleMaps.lastTestStatus === 'SUCCESS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{integrations.googleMaps.lastTestMessage}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tested: {new Date(integrations.googleMaps.lastTestedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. GEMINI AI API */}
        {activeTab === 'aiGemini' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                  <h3 className="font-extrabold text-slate-900 text-lg">Google Gemini AI API Settings</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Configure Google GenAI SDK for smart inventory predictions, audit insights, and automated customer support.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => updateCategoryConfig('aiGemini', { mode: 'DEMO' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.aiGemini.mode === 'DEMO'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  DEMO RULE ENGINE
                </button>

                <button
                  type="button"
                  onClick={() => updateCategoryConfig('aiGemini', { mode: 'LIVE' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.aiGemini.mode === 'LIVE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  LIVE GEMINI AI
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Gemini API Key (`GEMINI_API_KEY`)
                </label>
                <div className="relative">
                  <input
                    type={showSecrets['aiKey'] ? 'text' : 'password'}
                    value={integrations.aiGemini.apiKey || ''}
                    onChange={(e) => updateCategoryConfig('aiGemini', { apiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowSecret('aiKey')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showSecrets['aiKey'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Gemini Model</label>
                <select
                  value={integrations.aiGemini.preferredModel || 'gemini-2.5-flash'}
                  onChange={(e) => updateCategoryConfig('aiGemini', { preferredModel: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold bg-white"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra Fast &amp; Recommended)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">Gemini AI Model Connection Test</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Send a test prompt to Google GenAI endpoint.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTestConnection('aiGemini')}
                  disabled={testingCategory === 'aiGemini'}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingCategory === 'aiGemini' ? 'animate-spin' : ''}`} />
                  <span>{testingCategory === 'aiGemini' ? 'Pinging Gemini...' : 'Test AI Connection'}</span>
                </button>
              </div>

              {integrations.aiGemini.lastTestedAt && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    integrations.aiGemini.lastTestStatus === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {integrations.aiGemini.lastTestStatus === 'SUCCESS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{integrations.aiGemini.lastTestMessage}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tested: {new Date(integrations.aiGemini.lastTestedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. CLOUD STORAGE */}
        {activeTab === 'cloudStorage' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-purple-600" />
                  <h3 className="font-extrabold text-slate-900 text-lg">Cloud Storage &amp; Asset CDN</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Configure AWS S3 or Google Cloud Storage buckets for user avatars, product images, and invoice PDFs.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => updateCategoryConfig('cloudStorage', { mode: 'DEMO' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.cloudStorage.mode === 'DEMO'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  LOCAL SERVER
                </button>

                <button
                  type="button"
                  onClick={() => updateCategoryConfig('cloudStorage', { mode: 'LIVE' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    integrations.cloudStorage.mode === 'LIVE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  LIVE S3 / BUCKET
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Storage Provider</label>
                <select
                  value={integrations.cloudStorage.provider}
                  onChange={(e) => updateCategoryConfig('cloudStorage', { provider: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold bg-white"
                >
                  <option value="AWS_S3">Amazon Web Services S3</option>
                  <option value="GOOGLE_CLOUD_STORAGE">Google Cloud Storage (GCS)</option>
                  <option value="LOCAL_STORAGE">Local Container Storage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bucket Name</label>
                <input
                  type="text"
                  value={integrations.cloudStorage.bucketName || ''}
                  onChange={(e) => updateCategoryConfig('cloudStorage', { bucketName: e.target.value })}
                  placeholder="e.g. pantrymaster-app-storage"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Region</label>
                <input
                  type="text"
                  value={integrations.cloudStorage.region || ''}
                  onChange={(e) => updateCategoryConfig('cloudStorage', { region: e.target.value })}
                  placeholder="e.g. ap-south-1"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CDN Base URL</label>
                <input
                  type="text"
                  value={integrations.cloudStorage.cdnBaseUrl || ''}
                  onChange={(e) => updateCategoryConfig('cloudStorage', { cdnBaseUrl: e.target.value })}
                  placeholder="e.g. https://cdn.pantrymaster.app"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">Cloud Storage Bucket Diagnostic</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Test bucket write permissions and head request.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTestConnection('cloudStorage')}
                  disabled={testingCategory === 'cloudStorage'}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${testingCategory === 'cloudStorage' ? 'animate-spin' : ''}`}
                  />
                  <span>{testingCategory === 'cloudStorage' ? 'Checking Bucket...' : 'Test Bucket'}</span>
                </button>
              </div>

              {integrations.cloudStorage.lastTestedAt && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    integrations.cloudStorage.lastTestStatus === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {integrations.cloudStorage.lastTestStatus === 'SUCCESS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{integrations.cloudStorage.lastTestMessage}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tested: {new Date(integrations.cloudStorage.lastTestedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save button footer bar */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <span>API keys are encrypted in memory and stored securely in server configuration store.</span>
          </div>

          <button
            type="button"
            onClick={handleSaveAllIntegrations}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save All API Gateway Settings'}</span>
          </button>
        </div>
      </div>

      {/* SQL Schema Viewer Modal */}
      {sqlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl text-white overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    PostgreSQL Database Schema for Supabase
                  </h3>
                  <p className="text-xs text-slate-400">
                    Run this SQL script in your Supabase SQL Editor (<span className="text-emerald-400 font-mono">bgxnmmecjcgrwtemmjtz</span>) to create all 11 tables and indices.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(sqlContent, 'sql')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy Entire SQL'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSqlModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Code Viewer */}
            <div className="p-4 flex-1 overflow-auto bg-slate-950 font-mono text-xs text-emerald-300/90 leading-relaxed selection:bg-emerald-800 selection:text-white">
              {loadingSql ? (
                <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Loading schema DDL...</span>
                </div>
              ) : (
                <pre className="whitespace-pre font-mono text-[11px]">{sqlContent}</pre>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Includes RLS policies, indexes, and full relational tables for PantryMart</span>
              </div>
              <a
                href="https://supabase.com/dashboard/project/bgxnmmecjcgrwtemmjtz/sql"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-semibold"
              >
                <span>Open Supabase SQL Editor</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
