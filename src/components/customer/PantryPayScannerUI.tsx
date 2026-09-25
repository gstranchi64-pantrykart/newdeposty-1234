import React, { useState, useEffect } from 'react';
import { Customer, Product, PantryPayment, PantryCardItem, hasPantryAccess } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  QrCode,
  Search,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  ShieldCheck,
  Smartphone,
  Building,
  RefreshCw,
  Camera,
  Lock,
  ArrowRight,
  PackageCheck,
  Zap,
  Wallet,
  Sparkles,
} from 'lucide-react';

interface PantryPayScannerUIProps {
  customer: Customer;
  onClose?: () => void;
  onPaymentComplete?: () => void;
}

export const PantryPayScannerUI: React.FC<PantryPayScannerUIProps> = ({
  customer,
  onClose,
  onPaymentComplete,
}) => {
  const { refreshUserData } = useAuth();
  const [activeTab, setActiveTab] = useState<'pay' | 'history'>('pay');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryCardItem[]>([]);
  const [scannedItems, setScannedItems] = useState<{
    productId: string;
    productName: string;
    barcode: string;
    price: number;
    image?: string;
    quantity: number;
    isWalletRecharge?: boolean;
  }[]>([]);

  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK'>('UPI');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccessRecords, setPaymentSuccessRecords] = useState<PantryPayment[]>([]);
  const [history, setHistory] = useState<PantryPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Scanner camera simulation state
  const [isScanningCamera, setIsScanningCamera] = useState(false);

  if (!hasPantryAccess(customer)) {
    return (
      <div className="p-8 text-center bg-amber-50 border border-amber-200 rounded-3xl space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-extrabold text-amber-950 text-base">Pantry Pay Access Restricted</h3>
          <p className="text-xs text-amber-800 mt-1 max-w-sm mx-auto">
            Pantry Pay feature is strictly reserved for customers with an allowed Pantry Card. Please use Quick COD Order for standard grocery shopping.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Back to Quick Order Store
          </button>
        )}
      </div>
    );
  }

  useEffect(() => {
    fetchCatalogAndItems();
    fetchPantryPayHistory();
  }, [customer.id]);

  const fetchCatalogAndItems = async () => {
    setLoadingProducts(true);
    try {
      const [prods, items] = await Promise.all([
        api.getProducts(),
        api.getPantryCard(customer.id).catch(() => []),
      ]);
      setProducts(prods);
      setPantryItems(items || []);
    } catch (err) {
      console.error('Failed to load products for Pantry Pay:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchPantryPayHistory = async () => {
    setHistoryLoading(true);
    try {
      const records = await api.getCustomerPantryPayments(customer.id);
      setHistory(records);
    } catch (err) {
      console.error('Failed to load Pantry Pay history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const isItemInPantryStock = (p: PantryCardItem) => {
    const qty = p.quantity || 0;
    return qty > 0 && 
           p.status !== 'CONSUMED_AND_PAID' && 
           p.status !== 'RETURNED' && 
           p.status !== 'EXPIRED_ON_HOLD' && 
           p.status !== 'DAMAGED_VERIFIED';
  };

  const handleAddWalletRechargeItem = () => {
    setErrorMsg(null);
    setPaymentSuccessRecords([]);
    addItemToScanned({
      productId: 'WALLET-RECHARGE-100',
      productName: 'Customer Wallet Recharge (Fixed ₹100)',
      barcode: 'WALLET-100',
      price: 100,
      isWalletRecharge: true,
      image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=300&q=80',
    });
    setBarcodeInput('');
  };

  const handleBarcodeSearch = (query: string) => {
    setErrorMsg(null);
    setPaymentSuccessRecords([]);
    const clean = query.trim().toLowerCase();
    if (!clean) return;

    // Check if user entered wallet recharge keyword
    if (
      clean === 'wallet' ||
      clean === '100' ||
      clean === '1000' ||
      clean === 'recharge' ||
      clean === 'wallet-100' ||
      clean === 'wallet100' ||
      clean === 'wallet-1000' ||
      clean === 'wallet1000'
    ) {
      handleAddWalletRechargeItem();
      return;
    }

    let found: {
      productId: string;
      productName: string;
      barcode: string;
      price: number;
      image?: string;
      isWalletRecharge?: boolean;
    } | null = null;

    // First check if the item is in the user's pantry at all, regardless of quantity
    const pciAnyMatch = pantryItems.find(
      (pci) =>
        pci.barcode?.toLowerCase() === clean ||
        pci.productId?.toLowerCase() === clean ||
        pci.productName?.toLowerCase().includes(clean)
    );

    if (pciAnyMatch) {
      if (!isItemInPantryStock(pciAnyMatch)) {
        setErrorMsg(`"${pciAnyMatch.productName}" is consumed/used (0 quantity available in pantry stock) and cannot be searched, picked, or selected.`);
        return;
      }

      found = {
        productId: pciAnyMatch.productId,
        productName: pciAnyMatch.productName,
        barcode: pciAnyMatch.barcode || '8901234567890',
        price: pciAnyMatch.unitPrice,
        image: pciAnyMatch.image,
      };
    }

    if (found) {
      // Check if existing quantity in scanned items already reached max limit
      const existing = scannedItems.find(i => i.productId === found!.productId && i.barcode === found!.barcode);
      const maxQty = pciAnyMatch ? pciAnyMatch.quantity : 1;
      if (existing && existing.quantity >= maxQty) {
        setErrorMsg(`Cannot select more than available pantry quantity of ${maxQty} for ${found.productName}.`);
        return;
      }

      addItemToScanned(found);
      setBarcodeInput('');
    } else {
      // Find if it exists in standard catalog to give context
      const catalogMatch = products.find(
        (p) =>
          p.barcode?.toLowerCase() === clean ||
          p.id?.toLowerCase() === clean ||
          p.name?.toLowerCase().includes(clean)
      );
      if (catalogMatch) {
        setErrorMsg(`"${catalogMatch.name}" is not available in your home pantry stock.`);
      } else {
        setErrorMsg(`No item found for barcode/query "${query}". Only items from your home pantry stock can be scanned.`);
      }
    }
  };

  const addItemToScanned = (item: {
    productId: string;
    productName: string;
    barcode: string;
    price: number;
    image?: string;
    isWalletRecharge?: boolean;
  }) => {
    setScannedItems(prev => {
      const existing = prev.find(i => i.productId === item.productId && i.barcode === item.barcode);
      if (existing) {
        const pci = pantryItems.find(p => p.productId === item.productId && p.barcode === item.barcode);
        const maxQty = pci ? pci.quantity : 1;
        if (existing.quantity >= maxQty) {
          setErrorMsg(`Maximum available quantity (${maxQty}) already selected for ${item.productName}.`);
          return prev;
        }
        return prev.map(i => i.productId === item.productId && i.barcode === item.barcode ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItemFromScanned = (productId: string, barcode: string) => {
    setScannedItems(prev => prev.filter(i => !(i.productId === productId && i.barcode === barcode)));
  };

  const updateItemQuantity = (productId: string, barcode: string, delta: number) => {
    setScannedItems(prev => prev.map(i => {
      if (i.productId === productId && i.barcode === barcode) {
        const pci = pantryItems.find(p => p.productId === productId && p.barcode === barcode);
        const maxQty = pci ? pci.quantity : 1;
        const newQty = Math.max(1, Math.min(maxQty, i.quantity + delta));
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const handleSelectPantryItem = (pci: PantryCardItem) => {
    setErrorMsg(null);
    setPaymentSuccessRecords([]);

    if (!isItemInPantryStock(pci)) {
      setErrorMsg(`"${pci.productName}" is consumed/used (0 quantity available in pantry stock) and cannot be searched, picked, or selected.`);
      return;
    }

    // Check if max available reached
    const existing = scannedItems.find(i => i.productId === pci.productId && i.barcode === pci.barcode);
    if (existing && existing.quantity >= pci.quantity) {
      setErrorMsg(`Maximum available quantity (${pci.quantity}) already selected for ${pci.productName}.`);
      return;
    }

    addItemToScanned({
      productId: pci.productId,
      productName: pci.productName,
      barcode: pci.barcode || 'N/A',
      price: pci.unitPrice,
      image: pci.image,
    });
    setBarcodeInput('');
  };

  const handleSimulateCameraCapture = () => {
    setIsScanningCamera(true);
    setTimeout(() => {
      setIsScanningCamera(false);
      // Pick a random product from customer's available pantry stock
      const pool = pantryItems.filter(isItemInPantryStock);
      if (pool.length > 0) {
        const randomPci = pool[Math.floor(Math.random() * pool.length)];
        handleSelectPantryItem(randomPci);
      } else {
        setErrorMsg("No items available in your home pantry stock to simulate scanning.");
      }
    }, 1200);
  };

  const handleExecutePayment = async () => {
    if (scannedItems.length === 0) return;
    setProcessingPayment(true);
    setErrorMsg(null);

    try {
      // Simulate real smooth UPI transaction delay
      await new Promise((resolve) => setTimeout(resolve, 1400));

      // Grouped transaction reference for all items
      const groupTxRef = `UPI-GR-${Date.now().toString().slice(-6)}`;
      const results: PantryPayment[] = [];

      for (const item of scannedItems) {
        const isRecharge = item.isWalletRecharge || item.productId === 'WALLET-RECHARGE-1000' || item.barcode === 'WALLET-1000' || item.productId === 'WALLET-RECHARGE-100' || item.barcode === 'WALLET-100';
        const record = await api.createPantryPayment({
          customerId: customer.id,
          productId: item.productId,
          productName: item.productName,
          barcode: item.barcode,
          productImage: item.image,
          amount: item.price * item.quantity,
          paymentMethod: paymentMethod,
          transactionRef: groupTxRef,
          paymentType: isRecharge ? 'WALLET_RECHARGE' : 'PRODUCT_PAYMENT',
          isWalletRecharge: isRecharge,
          quantity: isRecharge ? 1 : item.quantity,
        });
        results.push(record);
      }

      setPaymentSuccessRecords(results);
      setScannedItems([]);
      fetchPantryPayHistory();
      
      try {
        await refreshUserData();
      } catch (err) {
        console.warn('Failed to refresh user wallet balance:', err);
      }

      if (onPaymentComplete) onPaymentComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Pantry Pay transaction failed. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const totalAmount = scannedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden max-w-3xl w-full mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Pantry Pay</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  Direct UPI / Bank
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan barcode or enter item code to pay directly against product
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Isolation Banner Notice */}
        <div className="mt-4 bg-emerald-950/80 border border-emerald-500/30 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">Independent Ledger Protection: </span>
            Pantry Pay transactions are processed via direct UPI/Bank. <span className="font-semibold text-emerald-200">Customer Wallet & Credit Limit are NOT deducted.</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-100 border-b border-slate-200 px-6 pt-3 flex items-center gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('pay')}
          className={`px-5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'pay'
              ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <QrCode className="w-4 h-4 text-emerald-600" />
          <span>Pay via Barcode</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            fetchPantryPayHistory();
          }}
          className={`px-5 py-2.5 rounded-t-xl border-t border-x transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white border-slate-200 text-slate-900 font-bold shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Clock className="w-4 h-4 text-purple-600" />
          <span>Payment History ({history.length})</span>
        </button>
      </div>

      <div className="p-6 space-y-6">
        {activeTab === 'pay' && (
          <div className="space-y-6">
            {/* Payment Success Card */}
            {paymentSuccessRecords.length > 0 ? (
              <div className="p-6 bg-emerald-50 border-2 border-emerald-300 rounded-3xl text-center space-y-4 animate-fadeIn">
                <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl ring-4 ring-emerald-200 animate-bounce">
                  <Check className="w-10 h-10 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-emerald-950">Pantry Pay Successful!</h3>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">
                    Total Payment of <span className="font-extrabold text-emerald-900 text-sm">₹{paymentSuccessRecords.reduce((a, r) => a + r.amount, 0)}</span> recorded for {paymentSuccessRecords.length} items.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-200 max-w-md mx-auto text-left text-xs space-y-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Items Paid:</div>
                  {paymentSuccessRecords.map((rec) => (
                    <div key={rec.id} className="flex justify-between items-start gap-4 font-mono">
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 font-sans">{rec.productName}</div>
                        <div className="text-[10px] text-slate-400">{rec.barcode} | {rec.id}</div>
                      </div>
                      <div className="font-bold text-emerald-700">₹{rec.amount}</div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-bold">
                    <span className="text-slate-500 uppercase text-[10px]">Total Amount Paid:</span>
                    <span className="text-emerald-800 text-sm">₹{paymentSuccessRecords.reduce((a, r) => a + r.amount, 0)}</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setPaymentSuccessRecords([]);
                      setScannedItems([]);
                      setBarcodeInput('');
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Pay for More Items</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>View History</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Barcode Search Box */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Enter or Scan Product Barcode / Select Items
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <QrCode className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => {
                          setBarcodeInput(e.target.value);
                          handleBarcodeSearch(e.target.value);
                        }}
                        placeholder="Scan barcode or type '100' / 'WALLET' for recharge"
                        className="w-full text-xs font-mono font-bold pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-slate-50 shadow-2xs"
                      />
                    </div>

                    <button
                      onClick={handleSimulateCameraCapture}
                      disabled={isScanningCamera}
                      className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0"
                    >
                      <Camera className={`w-4 h-4 ${isScanningCamera ? 'animate-spin text-emerald-400' : ''}`} />
                      <span>{isScanningCamera ? 'Scanning QR...' : 'Capture / Scan'}</span>
                    </button>
                  </div>

                  {/* Sample Quick Barcodes & Quick Select */}
                  {scannedItems.length === 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                        <span>Quick Select From Available Items & Options:</span>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                        {/* 1. Wallet Recharge Quick Pill */}
                        <button
                          type="button"
                          onClick={handleAddWalletRechargeItem}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                        >
                          <Wallet className="w-3 h-3 text-emerald-200" />
                          <span>Fixed ₹100 Recharge</span>
                        </button>

                        {/* 2. Products from available pantry stock */}
                        {pantryItems.filter(isItemInPantryStock).map((pci) => (
                          <button
                            key={pci.id}
                            type="button"
                            onClick={() => handleSelectPantryItem(pci)}
                            className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 text-slate-800 hover:text-emerald-900 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          >
                            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{pci.productName}</span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border">
                              Qty: {pci.quantity}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                              ₹{pci.unitPrice}
                            </span>
                          </button>
                        ))}

                        {pantryItems.filter(isItemInPantryStock).length === 0 && (
                          <div className="text-xs text-slate-400 p-2 italic w-full">
                            No items available in your home pantry stock.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Scanned Items List */}
                {scannedItems.length > 0 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Selected Items for Pantry Pay ({scannedItems.length})
                      </h3>
                      <button 
                        onClick={() => setScannedItems([])}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {scannedItems.map((item) => {
                        const isRecharge = item.isWalletRecharge || item.productId === 'WALLET-RECHARGE-1000' || item.barcode === 'WALLET-1000' || item.productId === 'WALLET-RECHARGE-100' || item.barcode === 'WALLET-100';
                        return (
                          <div
                            key={`${item.productId}-${item.barcode}`}
                            className={`p-3 rounded-2xl flex items-center gap-3 shadow-2xs border transition ${
                              isRecharge
                                ? 'bg-emerald-50/70 border-emerald-300'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center p-1 shrink-0 ${
                              isRecharge
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-50 border border-slate-100'
                            }`}>
                              {isRecharge ? (
                                <Wallet className="w-6 h-6 text-emerald-600" />
                              ) : item.image ? (
                                <img src={item.image} alt={item.productName} className="w-full h-full object-contain" />
                              ) : (
                                <PackageCheck className="w-6 h-6 text-emerald-600" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 truncate">{item.productName}</span>
                                {isRecharge && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                                    WALLET TOP-UP
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {isRecharge 
                                  ? `Fixed ₹${item.price.toLocaleString('en-IN')} Recharge | Approves via Auditor/Admin` 
                                  : `₹${item.price} | ${item.barcode}`}
                              </div>
                            </div>

                             <div className="flex items-center gap-2">
                              <div className="flex flex-col items-center gap-1">
                                {!isRecharge ? (
                                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                    <button
                                      onClick={() => updateItemQuantity(item.productId, item.barcode, -1)}
                                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white rounded-md transition cursor-pointer font-bold"
                                    >
                                      -
                                    </button>
                                    <span className="w-6 text-center text-[11px] font-bold">{item.quantity}</span>
                                    <button
                                      onClick={() => updateItemQuantity(item.productId, item.barcode, 1)}
                                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white rounded-md transition cursor-pointer font-bold"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                    Qty: 1 (Fixed)
                                  </span>
                                )}
                                {!isRecharge && (
                                  <span className="text-[9px] text-slate-400 font-bold">
                                    Max: {pantryItems.find(p => p.productId === item.productId && p.barcode === item.barcode)?.quantity || 1}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-black text-emerald-700 w-16 text-right font-mono">
                                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                              </div>
                              <button
                                onClick={() => removeItemFromScanned(item.productId, item.barcode)}
                                className="p-1.5 text-slate-300 hover:text-rose-600 transition cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total & Payment Summary */}
                    <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl text-white shadow-xl space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Payable Amount</div>
                        <div className="text-2xl font-black text-emerald-400">₹{totalAmount.toLocaleString()}</div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Select Payment Method:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setPaymentMethod('UPI')}
                            className={`py-2 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                              paymentMethod === 'UPI'
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                            }`}
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Direct UPI</span>
                          </button>
                          <button
                            onClick={() => setPaymentMethod('BANK')}
                            className={`py-2 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                              paymentMethod === 'BANK'
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                            }`}
                          >
                            <Building className="w-3.5 h-3.5" />
                            <span>Direct Bank</span>
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleExecutePayment}
                        disabled={processingPayment}
                        className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {processingPayment ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing Payment ₹{totalAmount}...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 fill-slate-950" />
                            <span>PAY NOW ₹{totalAmount.toLocaleString()}</span>
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-center text-slate-400 font-medium">
                        Payment will be recorded directly. Any Wallet Recharge items will be credited once verified by Auditor / Admin.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 py-2">
                      <div className="h-px bg-slate-200 flex-1"></div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Want to add more?</span>
                      <div className="h-px bg-slate-200 flex-1"></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-purple-950">Pantry Pay Direct Payment & Recharge History</h4>
                <p className="text-[11px] text-purple-700">
                  Transactions paid directly via UPI/Bank. Wallet recharges are credited upon Auditor/Admin approval.
                </p>
              </div>
              <button
                onClick={fetchPantryPayHistory}
                className="p-2 bg-white border border-purple-200 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading Pantry Pay history...</div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                No Pantry Pay transactions recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((rec) => {
                  const isRecharge = rec.isWalletRecharge || rec.paymentType === 'WALLET_RECHARGE' || rec.productId === 'WALLET-RECHARGE-1000' || rec.barcode === 'WALLET-1000' || rec.productId === 'WALLET-RECHARGE-100' || rec.barcode === 'WALLET-100';
                  return (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-2xl border bg-white shadow-2xs hover:shadow-xs transition space-y-3 ${
                        isRecharge ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {rec.paymentStatus}
                          </span>
                          {isRecharge && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-600 text-white uppercase tracking-wider flex items-center gap-1">
                              <Wallet className="w-3 h-3" />
                              WALLET RECHARGE
                            </span>
                          )}
                          <span className="font-mono text-xs font-bold text-slate-900">{rec.id}</span>
                          <span className="text-[11px] text-slate-400 font-mono">({rec.paymentMethod})</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 text-[11px] font-mono">{rec.createdAt}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              rec.auditorConfirmationStatus === 'CONFIRMED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            Auditor: {rec.auditorConfirmationStatus}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            {rec.productName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            Barcode: {rec.barcode} | Ref: {rec.transactionRef}
                          </div>
                          {rec.confirmedBy ? (
                            <div className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>
                                {isRecharge 
                                  ? `Confirmed & Credited to Wallet by ${rec.confirmedBy} on ${rec.confirmedAt}`
                                  : `Confirmed by Auditor: ${rec.confirmedBy} on ${rec.confirmedAt}`}
                              </span>
                            </div>
                          ) : isRecharge ? (
                            <div className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              <span>Pending Auditor / Admin verification (Will credit +₹{rec.amount} upon confirmation)</span>
                            </div>
                          ) : null}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs text-slate-400 font-bold uppercase">Amount Paid</div>
                          <div className="text-lg font-black text-emerald-700">₹{rec.amount.toLocaleString('en-IN')}</div>
                        </div>
                      </div>

                      {/* Quantity & Wallet Indicator */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {isRecharge ? `Fixed ₹${rec.amount.toLocaleString('en-IN')} Wallet Top-up Voucher` : 'Product quantity (+/-) locked post-payment'}
                          </span>
                        </div>
                        <span className={`font-bold ${isRecharge ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {isRecharge
                            ? rec.auditorConfirmationStatus === 'CONFIRMED'
                              ? `✓ Wallet Credited: +₹${rec.amount.toLocaleString('en-IN')}`
                              : `⏳ Pending Wallet Credit: +₹${rec.amount.toLocaleString('en-IN')}`
                            : 'Wallet/Limit: ₹0 Deducted'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
