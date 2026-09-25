import React, { useState, useEffect } from 'react';
import { Product, ProductBatch } from '../../types';
import { api } from '../../services/api';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ProductImageSlider } from '../common/ProductImageSlider';
import { ProductFourImageUploader } from '../common/ProductFourImageUploader';
import { AppWindowModal } from '../common/AppWindowModal';
import {
  PlusCircle,
  Barcode,
  Store,
  Calendar,
  AlertCircle,
  CheckCircle,
  Boxes,
  ArrowLeft,
  Search,
  Package,
  Plus,
  X,
  Sparkles,
  Layers,
  Images,
} from 'lucide-react';

interface PurchaseStockInProps {
  onBack?: () => void;
  onSuccess?: () => void;
  onStockInSuccess?: () => void;
}

export const PurchaseStockIn: React.FC<PurchaseStockInProps> = ({
  onBack,
  onSuccess,
  onStockInSuccess,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);

  // Form Fields
  const [batchNumber, setBatchNumber] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState<number>(10);
  const [purchaseRate, setPurchaseRate] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [shopkeeperName, setShopkeeperName] = useState('Ranchi Wholesale FMCG Mart');
  const [shopkeeperContact, setShopkeeperContact] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [notes, setNotes] = useState('');

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [existingBatchMatch, setExistingBatchMatch] = useState<ProductBatch | null>(null);
  const [dateConflictWarning, setDateConflictWarning] = useState<string | null>(null);

  // Create SKU Modal State
  const [isCreateSkuModalOpen, setIsCreateSkuModalOpen] = useState(false);
  const [newSkuData, setNewSkuData] = useState({
    name: '',
    brand: '',
    category: 'General Grocery',
    subCategory: '',
    barcode: '',
    weightSize: '1 unit',
    mrp: 100,
    sellingPrice: 90,
    discount: 10,
    orderEligibility: 'BOTH' as 'BOTH' | 'PANTRY_ONLY' | 'QUICK_ONLY',
    status: 'PUBLISHED' as Product['status'],
    description: '',
    images: [
      'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80',
    ] as [string, string, string, string],
  });

  const loadMaster = async () => {
    try {
      const [pList, bList] = await Promise.all([api.getProducts(), api.getBatches()]);
      setProducts(pList);
      setBatches(bList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMaster();
  }, []);

  // Handle Barcode Lookup
  const handleBarcodeChange = (code: string) => {
    setBarcodeInput(code);
    const clean = code.trim();
    if (!clean) {
      setMatchedProduct(null);
      return;
    }

    const found = products.find((p) => p.barcode === clean || p.id === clean);
    if (found) {
      setMatchedProduct(found);
      setMrp(found.mrp);
      setSellingPrice(found.sellingPrice);
      setPurchaseRate(Math.round(found.sellingPrice * 0.8));
    } else {
      setMatchedProduct(null);
    }
  };

  // Check if Same Batch Number already exists for this product
  useEffect(() => {
    if (matchedProduct && batchNumber.trim()) {
      const cleanBatch = batchNumber.trim().toLowerCase();
      const existing = batches.find(
        (b) => b.productId === matchedProduct.id && b.batchNumber.toLowerCase() === cleanBatch
      );

      if (existing) {
        setExistingBatchMatch(existing);
        if (!manufacturingDate) setManufacturingDate(existing.manufacturingDate);
        if (!expiryDate) setExpiryDate(existing.expiryDate);

        if (
          (manufacturingDate && manufacturingDate !== existing.manufacturingDate) ||
          (expiryDate && expiryDate !== existing.expiryDate)
        ) {
          setDateConflictWarning(
            `Warning: Existing batch ${existing.batchNumber} has MFG: ${existing.manufacturingDate} & EXP: ${existing.expiryDate}. Modifying dates will update the master batch record.`
          );
        } else {
          setDateConflictWarning(null);
        }
      } else {
        setExistingBatchMatch(null);
        setDateConflictWarning(null);
      }
    } else {
      setExistingBatchMatch(null);
      setDateConflictWarning(null);
    }
  }, [matchedProduct, batchNumber, manufacturingDate, expiryDate, batches]);

  const openCreateSkuModal = (prefillBarcode?: string) => {
    const code = prefillBarcode || barcodeInput.trim() || String(Math.floor(100000000000 + Math.random() * 900000000000));
    setNewSkuData({
      name: '',
      brand: '',
      category: 'General Grocery',
      subCategory: '',
      barcode: code,
      weightSize: '1 unit',
      mrp: 100,
      sellingPrice: 90,
      discount: 10,
      orderEligibility: 'BOTH',
      status: 'PUBLISHED',
      description: '',
      images: [
        'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80',
      ],
    });
    setIsCreateSkuModalOpen(true);
  };

  const handlePriceChange = (mrpVal: number, sellVal: number) => {
    const disc = mrpVal > 0 && mrpVal > sellVal ? Math.round(((mrpVal - sellVal) / mrpVal) * 100) : 0;
    setNewSkuData((prev) => ({
      ...prev,
      mrp: mrpVal,
      sellingPrice: sellVal,
      discount: disc,
    }));
  };

  const handleCreateSkuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate 4 images
    const emptyImages = newSkuData.images.some((img) => !img || !img.trim());
    if (emptyImages) {
      alert('All 4 product images are mandatory! Please provide Front, Back, Side, and Packaging details.');
      return;
    }

    try {
      const created = await api.createProduct({
        ...newSkuData,
        unit: newSkuData.weightSize,
      });

      alert(`Product SKU "${created.name}" created successfully with 4 product images!`);
      setIsCreateSkuModalOpen(false);

      // Reload products and select the newly created product
      await loadMaster();
      setBarcodeInput(created.barcode);
      setMatchedProduct(created);
      setMrp(created.mrp);
      setSellingPrice(created.sellingPrice);
      setPurchaseRate(Math.round(created.sellingPrice * 0.8));
    } catch (err: any) {
      alert(err.message || 'Failed to create product SKU.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedProduct) {
      alert('Please select or scan a valid product master using Barcode.');
      return;
    }
    if (!batchNumber.trim()) {
      alert('Batch Number is MANDATORY for all inventory stock.');
      return;
    }
    if (!manufacturingDate || !expiryDate) {
      alert('Manufacturing Date and Expiry Date are mandatory.');
      return;
    }
    if (!shopkeeperName.trim()) {
      alert('Shopkeeper / Supplier Name is MANDATORY for purchase entries.');
      return;
    }
    if (quantity <= 0) {
      alert('Quantity must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.purchaseStock({
        productId: matchedProduct.id,
        productName: matchedProduct.name,
        barcode: matchedProduct.barcode,
        batchNumber: batchNumber.trim(),
        manufacturingDate,
        expiryDate,
        quantity: Number(quantity),
        purchaseRate: Number(purchaseRate) || Math.round(sellingPrice * 0.8),
        mrp: Number(mrp) || matchedProduct.mrp,
        sellingPrice: Number(sellingPrice) || matchedProduct.sellingPrice,
        shopkeeperName: shopkeeperName.trim(),
        shopkeeperContact: shopkeeperContact.trim(),
        invoiceReference: invoiceReference.trim(),
        notes: notes.trim(),
      });

      alert(
        res.isNewBatch
          ? `Stock Inward successful! Created NEW Batch #${res.batch.batchNumber} with ${res.batch.availableQuantity} units.`
          : `Stock Inward successful! Added +${quantity} units to EXISTING Batch #${res.batch.batchNumber}. Total available: ${res.batch.availableQuantity} units.`
      );

      // Reset form fields
      setBatchNumber('');
      setManufacturingDate('');
      setExpiryDate('');
      setQuantity(10);
      setInvoiceReference('');
      setNotes('');
      setMatchedProduct(null);
      setBarcodeInput('');

      await loadMaster();
      if (onStockInSuccess) onStockInSuccess();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to record purchase stock in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-600" />
              <span>Purchase Entry &amp; Inward Stocking</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict Rules: Barcode identifies Product SKU. Stock is tracked strictly by Product + Batch Number.
            </p>
          </div>
        </div>

        {/* Create SKU Button */}
        <button
          type="button"
          onClick={() => openCreateSkuModal()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Purchase → Create New Product SKU</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* STEP 1: Barcode Scan & Product Master */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Barcode className="w-4 h-4 text-emerald-600" />
              <span>1. Scan or Search Product Barcode</span>
            </h3>

            <button
              type="button"
              onClick={() => openCreateSkuModal()}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New SKU Creation</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enter Barcode / Product ID <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. 123456789 or scan packaging..."
                  value={barcodeInput}
                  onChange={(e) => handleBarcodeChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Sample Barcodes: <strong>123456789</strong> (Horlicks) • <strong>8901030382910</strong> (Atta)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quick Product Master Selector
              </label>
              <select
                value={matchedProduct ? matchedProduct.barcode : ''}
                onChange={(e) => handleBarcodeChange(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="">-- Choose from Master Catalog --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.barcode}>
                    {p.name} ({p.weightSize}) - Barcode: {p.barcode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Barcode Not Found Notice */}
          {!matchedProduct && barcodeInput.trim().length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  No product master registered with Barcode: <strong>{barcodeInput.trim()}</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => openCreateSkuModal(barcodeInput.trim())}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create SKU with this Barcode</span>
              </button>
            </div>
          )}

          {/* Product Auto-fill Preview with 4 Product Images Gallery */}
          {matchedProduct && (
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* 4-Image Slider / Thumbnail in matched card */}
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-emerald-300 shrink-0 bg-white shadow-xs">
                    <ProductImageSlider
                      images={matchedProduct.images}
                      alt={matchedProduct.name}
                      aspectRatio="aspect-square"
                      showDots={true}
                      showArrows={true}
                      showCounter={true}
                      allowZoom={true}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-200 text-emerald-800 font-semibold uppercase">
                        {matchedProduct.category}
                      </span>
                      <span className="text-xs font-mono text-slate-500">ID: {matchedProduct.id}</span>
                      <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">
                        4 Verified Images ✓
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{matchedProduct.name}</h4>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                      <span>Brand: <strong>{matchedProduct.brand}</strong></span>
                      <span>Unit: <strong>{matchedProduct.weightSize}</strong></span>
                      <span>MRP: <strong>₹{matchedProduct.mrp}</strong></span>
                      <span>Sell Price: <strong>₹{matchedProduct.sellingPrice}</strong></span>
                    </div>
                  </div>
                </div>

                {/* 4 Image Thumbnails Bar */}
                <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-emerald-200">
                  <div className="text-[10px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                    <Images className="w-3.5 h-3.5 text-emerald-600" />
                    <span>4 Angles:</span>
                  </div>
                  {matchedProduct.images.slice(0, 4).map((img, idx) => (
                    <div
                      key={idx}
                      className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 relative group"
                      title={`Angle ${idx + 1}`}
                    >
                      <ImageWithFallback src={img} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[8px] px-1 rounded-tl font-bold">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 2: Batch Information & Mandatory Rules */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-emerald-600" />
            <span>2. Batch Number &amp; Manufacturing / Expiry Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batch Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 124001 or B-2026-09"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono font-semibold"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Stock is tracked STRICTLY by this Batch #
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Manufacturing Date (MFG) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expiry Date (EXP) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Same Batch Addition Notification */}
          {existingBatchMatch && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Existing Batch Detected (Rule 3 Compliance)</p>
                <p className="mt-0.5 text-blue-800">
                  Batch <strong>#{existingBatchMatch.batchNumber}</strong> currently has{' '}
                  <strong>{existingBatchMatch.availableQuantity} units</strong> in stock. Entering{' '}
                  <strong>+{quantity} units</strong> will directly increase this existing batch quantity to{' '}
                  <strong>{existingBatchMatch.availableQuantity + Number(quantity || 0)} units</strong> without creating duplicate batch records.
                </p>
              </div>
            </div>
          )}

          {dateConflictWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Date Conflict Notice</p>
                <p className="mt-0.5 text-amber-800">{dateConflictWarning}</p>
              </div>
            </div>
          )}
        </div>

        {/* STEP 3: Quantity, Pricing & Mandatory Shopkeeper Supplier */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600" />
            <span>3. Quantity, Rates &amp; Shopkeeper / Supplier Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Inward Quantity (Units) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purchase Rate / Unit (₹)
              </label>
              <input
                type="number"
                min="0"
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Internal cost (hidden from customer)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selling Price / Unit (₹)
              </label>
              <input
                type="number"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shopkeeper / Supplier Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ranchi Wholesale FMCG Mart"
                value={shopkeeperName}
                onChange={(e) => setShopkeeperName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-900"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Mandatory for purchase audit reports (Rule 5)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shopkeeper Contact No.
              </label>
              <input
                type="text"
                placeholder="e.g. 9835001122"
                value={shopkeeperContact}
                onChange={(e) => setShopkeeperContact(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice / Challan Reference
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-902"
                value={invoiceReference}
                onChange={(e) => setInvoiceReference(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Stock Inward Remarks / Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Verified packaging seal & intact condition upon delivery"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={submitting || !matchedProduct}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{submitting ? 'Recording Inward...' : 'Confirm Inward Stock & Update Batch'}</span>
          </button>
        </div>
      </form>

      {/* ---------------- CREATE NEW PRODUCT SKU MODAL ---------------- */}
      {isCreateSkuModalOpen && (
        <AppWindowModal
          isOpen={isCreateSkuModalOpen}
          onClose={() => setIsCreateSkuModalOpen(false)}
          title="Purchase → Create New Product Master SKU"
          subtitle="Define product metadata and provide all 4 mandatory packaging angles (Front, Nutrition, Side, Barcode)."
          icon={<Package className="w-5 h-5 text-emerald-600" />}
          size="xl"
        >
          <div className="p-6">
            {/* Modal Form */}
            <form onSubmit={handleCreateSkuSubmit} className="space-y-5">
              {/* Product Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Full Name / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fortune Sunlite Refined Sunflower Oil 1L Pouch"
                    value={newSkuData.name}
                    onChange={(e) => setNewSkuData({ ...newSkuData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fortune"
                    value={newSkuData.brand}
                    onChange={(e) => setNewSkuData({ ...newSkuData, brand: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Edible Oils & Ghee"
                    value={newSkuData.category}
                    onChange={(e) => setNewSkuData({ ...newSkuData, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Barcode (UPC / EAN-13) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newSkuData.barcode}
                    onChange={(e) => setNewSkuData({ ...newSkuData, barcode: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pack Size / Net Unit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 L or 500g"
                    value={newSkuData.weightSize}
                    onChange={(e) => setNewSkuData({ ...newSkuData, weightSize: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    MRP (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newSkuData.mrp}
                    onChange={(e) => handlePriceChange(Number(e.target.value), newSkuData.sellingPrice)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selling Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newSkuData.sellingPrice}
                    onChange={(e) => handlePriceChange(newSkuData.mrp, Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-emerald-800"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Key features, certifications, and nutritional benefits..."
                    value={newSkuData.description}
                    onChange={(e) => setNewSkuData({ ...newSkuData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* ---------------- 4 MANDATORY IMAGES UPLOADER ---------------- */}
              <div className="space-y-1">
                <ProductFourImageUploader
                  images={newSkuData.images}
                  onChange={(imgs) => setNewSkuData({ ...newSkuData, images: imgs })}
                  required={true}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateSkuModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Save SKU &amp; Proceed to Stock In</span>
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}
    </div>
  );
};
