import React, { useState, useEffect, useMemo } from 'react';
import { ProductBatch, Product } from '../../types';
import { api } from '../../services/api';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { StatusBadge } from '../common/StatusBadge';
import { ProductDetailModal } from '../common/ProductDetailModal';
import { AppWindowModal } from '../common/AppWindowModal';
import { BatchDetailHistoryModal } from './BatchDetailHistoryModal';
import { BarcodeDetailHistoryModal } from './BarcodeDetailHistoryModal';
import { CustomerPantryHoldingsModal } from './CustomerPantryHoldingsModal';
import { CustomerPantryLiveLedger } from './CustomerPantryLiveLedger';
import { AllCustomerPantryHoldingsList } from './AllCustomerPantryHoldingsList';
import {
  Boxes,
  Barcode,
  Search,
  Filter,
  PlusCircle,
  AlertTriangle,
  Clock,
  Ban,
  CheckCircle,
  Edit,
  RotateCcw,
  RefreshCw,
  Store,
  Eye,
  Images,
  FileText,
  Info,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Tag,
  ShoppingBag,
  CreditCard,
  Users,
  Phone,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';

export interface BarcodeGroupedRow {
  barcode: string;
  productId: string;
  productName: string;
  productImage: string;
  category: string;
  brand: string;
  totalAvailableQuantity: number;
  totalPurchaseQuantity: number;
  totalQuickSoldQuantity: number;
  totalPantrySoldQuantity: number;
  totalReturnedQuantity: number;
  batchCount: number;
  batches: ProductBatch[];
  sellingPrice: number;
  mrp: number;
  avgPurchaseRate: number;
  nearestExpiryDate: string;
  daysToNearestExpiry: number;
  isExpired: boolean;
  isNearExpiry: boolean;
  shopkeeperNames: string[];
}

interface BatchInventoryManagementProps {
  onOpenPurchase?: () => void;
  initialFilter?: string;
  onOpenOrder?: (orderId: string) => void;
}

export const BatchInventoryManagement: React.FC<BatchInventoryManagementProps> = ({
  onOpenPurchase,
  initialFilter,
  onOpenOrder,
}) => {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: Barcode Merged vs Batch Wise vs Live Customer Pantry Stock vs All Customer Hold in Pantry Items
  const [viewMode, setViewMode] = useState<
    'BARCODE_MERGED' | 'BATCH_WISE' | 'CUSTOMER_PANTRIES' | 'ALL_CUSTOMER_HOLDINGS'
  >('BARCODE_MERGED');

  // Customer Pantry Holdings Target Modal (Click on Pantry sales down quantity)
  const [selectedPantryHoldingTarget, setSelectedPantryHoldingTarget] = useState<{
    barcode?: string;
    batchNumber?: string;
    productName?: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'EXPIRED' | 'NEAR_EXPIRY' | 'SAFE'>(
    initialFilter === 'expired' ? 'EXPIRED' : initialFilter === 'near-expiry' ? 'NEAR_EXPIRY' : 'ALL'
  );
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW_STOCK' | 'AVAILABLE' | 'OUT_OF_STOCK'>(
    initialFilter === 'low-stock' ? 'LOW_STOCK' : 'ALL'
  );

  // Barcode Detail History Modal state
  const [selectedBarcodeHistory, setSelectedBarcodeHistory] = useState<string | null>(null);

  // Toggle state for constituent batches expansion under barcode merged view
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  const toggleExpandBatch = (barcode: string) => {
    setExpandedBatches((prev) => ({
      ...prev,
      [barcode]: !prev[barcode],
    }));
  };

  // Batch Detail History Modal state
  const [selectedBatchHistoryNumber, setSelectedBatchHistoryNumber] = useState<string | null>(null);

  // Stock Adjustment Modal state
  const [selectedBatchForAdjust, setSelectedBatchForAdjust] = useState<ProductBatch | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState<boolean>(false);

  // Inspect Modal state
  const [inspectModalState, setInspectModalState] = useState<{
    product: Product;
    batch: ProductBatch;
  } | null>(null);

  const fetchData = async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const [bData, pData] = await Promise.all([api.getBatches(), api.getProducts()]);
      setBatches(bData);
      setProducts(pData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = api.subscribeRealtime(() => {
      fetchData(true);
    });
    return () => unsubscribe();
  }, []);

  const getProductImage = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    return prod ? prod.images[0] : '';
  };

  const getProductCategory = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    return prod ? prod.category : 'General';
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForAdjust) return;
    if (!adjustReason.trim()) {
      alert('Please provide a mandatory reason for manual stock correction.');
      return;
    }

    setAdjusting(true);
    try {
      await api.adjustBatchStock(selectedBatchForAdjust.id, adjustQty, adjustReason);
      await fetchData();
      setSelectedBatchForAdjust(null);
      setAdjustReason('');
      alert('Stock correction recorded and logged to audit trail.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  // Filter batches
  const now = new Date().getTime();
  const filteredBatches = batches.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.productName.toLowerCase().includes(q) ||
      b.batchNumber.toLowerCase().includes(q) ||
      b.barcode.includes(q) ||
      b.shopkeeperName.toLowerCase().includes(q);

    const category = getProductCategory(b.productId);
    const matchesCategory = categoryFilter === 'ALL' || category === categoryFilter;

    const expTime = new Date(b.expiryDate).getTime();
    const isExpired = expTime < now;
    const daysToExpiry = Math.floor((expTime - now) / (1000 * 60 * 60 * 24));
    const isNearExpiry = !isExpired && daysToExpiry <= 30;
    const isSafe = !isExpired && !isNearExpiry;

    let matchesExpiry = true;
    if (expiryFilter === 'EXPIRED') matchesExpiry = isExpired;
    if (expiryFilter === 'NEAR_EXPIRY') matchesExpiry = isNearExpiry;
    if (expiryFilter === 'SAFE') matchesExpiry = isSafe;

    let matchesStock = true;
    if (stockFilter === 'LOW_STOCK') matchesStock = b.availableQuantity > 0 && b.availableQuantity <= 5;
    if (stockFilter === 'AVAILABLE') matchesStock = b.availableQuantity > 0;
    if (stockFilter === 'OUT_OF_STOCK') matchesStock = b.availableQuantity === 0;

    return matchesSearch && matchesCategory && matchesExpiry && matchesStock;
  });

  // ======================== BARCODE MERGED GROUPING ========================
  const barcodeGroupedRows = useMemo(() => {
    const groups: Record<string, BarcodeGroupedRow> = {};
    const nowMs = Date.now();

    // Group all batches by barcode
    batches.forEach((b) => {
      const barcodeKey = (b.barcode || '').trim();
      if (!barcodeKey) return;

      const prod = products.find((p) => p.id === b.productId);
      const expMs = new Date(b.expiryDate).getTime();
      const daysLeft = Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
      const bIsExpired = expMs < nowMs;
      const bIsNear = !bIsExpired && daysLeft <= 30;

      if (!groups[barcodeKey]) {
        groups[barcodeKey] = {
          barcode: barcodeKey,
          productId: b.productId,
          productName: b.productName || prod?.name || 'Product Item',
          productImage: prod?.images?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
          category: prod?.category || 'General',
          brand: prod?.brand || 'Standard',
          totalAvailableQuantity: 0,
          totalPurchaseQuantity: 0,
          totalQuickSoldQuantity: 0,
          totalPantrySoldQuantity: 0,
          totalReturnedQuantity: 0,
          batchCount: 0,
          batches: [],
          sellingPrice: b.sellingPrice,
          mrp: b.mrp,
          avgPurchaseRate: 0,
          nearestExpiryDate: b.expiryDate,
          daysToNearestExpiry: daysLeft,
          isExpired: bIsExpired,
          isNearExpiry: bIsNear,
          shopkeeperNames: [],
        };
      }

      const g = groups[barcodeKey];
      g.totalAvailableQuantity += b.availableQuantity;
      g.totalPurchaseQuantity += b.purchaseQuantity;
      g.totalQuickSoldQuantity += b.quickSoldQuantity || 0;
      const bPantry = Math.max(b.pantrySoldQuantity || 0, Math.max(0, b.purchaseQuantity - b.availableQuantity - (b.quickSoldQuantity || 0)));
      g.totalPantrySoldQuantity += bPantry;
      g.totalReturnedQuantity += b.returnedQuantity || 0;
      g.batchCount += 1;
      g.batches.push(b);

      if (b.shopkeeperName && !g.shopkeeperNames.includes(b.shopkeeperName)) {
        g.shopkeeperNames.push(b.shopkeeperName);
      }

      // Check nearest expiry among in-stock or active batches
      if (b.availableQuantity > 0) {
        if (!g.nearestExpiryDate || new Date(b.expiryDate).getTime() < new Date(g.nearestExpiryDate).getTime()) {
          g.nearestExpiryDate = b.expiryDate;
          g.daysToNearestExpiry = daysLeft;
          g.isExpired = bIsExpired;
          g.isNearExpiry = bIsNear;
        }
      }
    });

    // Also include catalog products that have a barcode even if no batches yet
    products.forEach((p) => {
      const bKey = (p.barcode || '').trim();
      if (bKey && !groups[bKey]) {
        groups[bKey] = {
          barcode: bKey,
          productId: p.id,
          productName: p.name,
          productImage: p.images?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
          category: p.category,
          brand: p.brand,
          totalAvailableQuantity: 0,
          totalPurchaseQuantity: 0,
          totalQuickSoldQuantity: 0,
          totalPantrySoldQuantity: 0,
          totalReturnedQuantity: 0,
          batchCount: 0,
          batches: [],
          sellingPrice: p.sellingPrice,
          mrp: p.mrp,
          avgPurchaseRate: 0,
          nearestExpiryDate: '',
          daysToNearestExpiry: 9999,
          isExpired: false,
          isNearExpiry: false,
          shopkeeperNames: [],
        };
      }
    });

    // Calculate averages & return list
    return Object.values(groups).map((g) => {
      const totalSpent = g.batches.reduce((sum, b) => sum + b.purchaseQuantity * b.purchaseRate, 0);
      const avgPurchaseRate =
        g.totalPurchaseQuantity > 0 ? Number((totalSpent / g.totalPurchaseQuantity).toFixed(2)) : (g.batches[0]?.purchaseRate || 0);
      return {
        ...g,
        avgPurchaseRate,
      };
    });
  }, [batches, products]);

  // Filter Barcode Merged Rows
  const filteredBarcodeRows = useMemo(() => {
    return barcodeGroupedRows.filter((g) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        g.productName.toLowerCase().includes(q) ||
        g.barcode.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.brand.toLowerCase().includes(q) ||
        g.batches.some((b) => b.batchNumber.toLowerCase().includes(q)) ||
        g.shopkeeperNames.some((s) => s.toLowerCase().includes(q));

      const matchesCategory = categoryFilter === 'ALL' || g.category === categoryFilter;

      let matchesExpiry = true;
      if (expiryFilter === 'EXPIRED') matchesExpiry = g.isExpired;
      if (expiryFilter === 'NEAR_EXPIRY') matchesExpiry = g.isNearExpiry;
      if (expiryFilter === 'SAFE') matchesExpiry = !g.isExpired && !g.isNearExpiry;

      let matchesStock = true;
      if (stockFilter === 'LOW_STOCK') matchesStock = g.totalAvailableQuantity > 0 && g.totalAvailableQuantity <= 5;
      if (stockFilter === 'AVAILABLE') matchesStock = g.totalAvailableQuantity > 0;
      if (stockFilter === 'OUT_OF_STOCK') matchesStock = g.totalAvailableQuantity === 0;

      return matchesSearch && matchesCategory && matchesExpiry && matchesStock;
    });
  }, [barcodeGroupedRows, searchQuery, categoryFilter, expiryFilter, stockFilter]);

  const categories = Array.from(new Set(products.map((p) => p.category)));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Barcode className="w-5 h-5 text-indigo-600" />
              <span>Barcode Product & Inventory Management</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregate stock by Barcode with unified quantity, purchase inward history, and customer sales audit.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData()}
              className="p-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 text-xs transition cursor-pointer"
              title="Refresh Inventory"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenPurchase}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Add Stock / Purchase Entry
            </button>
          </div>
        </div>

        {/* View Mode Switcher Pill */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
            <button
              onClick={() => setViewMode('BARCODE_MERGED')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'BARCODE_MERGED'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Barcode className="w-3.5 h-3.5 text-indigo-600" />
              <span>Same Barcode Merged ({filteredBarcodeRows.length})</span>
            </button>
            <button
              onClick={() => setViewMode('BATCH_WISE')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'BATCH_WISE'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-emerald-600" />
              <span>Individual Batches ({filteredBatches.length})</span>
            </button>
            <button
              onClick={() => setViewMode('CUSTOMER_PANTRIES')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'CUSTOMER_PANTRIES'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-purple-700 hover:bg-purple-100/60'
              }`}
              title="View master list of all products currently placed in customer pantries with Customer Name & Mobile"
            >
              <Users className="w-3.5 h-3.5 text-purple-300" />
              <span>🏠 Live Customer Pantry Stock</span>
            </button>
            <button
              onClick={() => setViewMode('ALL_CUSTOMER_HOLDINGS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'ALL_CUSTOMER_HOLDINGS'
                  ? 'bg-gradient-to-r from-purple-900 to-indigo-900 text-white shadow-xs border border-purple-500/50'
                  : 'text-purple-900 hover:bg-purple-100/80 font-extrabold'
              }`}
              title="All Customer Hold in Pantry Items: Customer Name, Product Name, MRP, Batch #, MFG, EXP, Lifespan Days, Delivery Date, Live Day Count & Excel Export"
            >
              <Package className="w-3.5 h-3.5 text-amber-300" />
              <span>📦 All Customer Hold in Pantry Items List</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>Click <strong>Pantry Sold (👥)</strong> to identify which customer holds the stock, or click <strong>Barcode</strong> to inspect lifecycle.</span>
          </div>
        </div>
      </div>

      {viewMode === 'ALL_CUSTOMER_HOLDINGS' ? (
        /* ======================== ALL CUSTOMER HOLD IN PANTRY ITEMS LIST ======================== */
        <AllCustomerPantryHoldingsList
          onOpenOrder={onOpenOrder}
          onOpenBatchHistory={(batchNo) => setSelectedBatchHistoryNumber(batchNo)}
          onOpenBarcodeHistory={(barcode) => setSelectedBarcodeHistory(barcode)}
        />
      ) : viewMode === 'CUSTOMER_PANTRIES' ? (
        /* ======================== LIVE CUSTOMER PANTRY STOCK LEDGER ======================== */
        <CustomerPantryLiveLedger
          onOpenOrder={onOpenOrder}
          onOpenBatchHistory={(batchNo) => setSelectedBatchHistoryNumber(batchNo)}
          onOpenBarcodeHistory={(barcode) => setSelectedBarcodeHistory(barcode)}
        />
      ) : (
        <>
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search Barcode, Batch #, Product, Shopkeeper..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Expiry Filter */}
          <div>
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value as any)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">All Expiry Statuses</option>
              <option value="SAFE">Safe / Fresh Stock</option>
              <option value="NEAR_EXPIRY">Near Expiry (≤ 30 Days)</option>
              <option value="EXPIRED">Expired (Blocked)</option>
            </select>
          </div>

          {/* Stock Level Filter */}
          <div>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="LOW_STOCK">Low Stock (≤ 5 units)</option>
              <option value="AVAILABLE">Available &gt; 0</option>
              <option value="OUT_OF_STOCK">Out of Stock (= 0)</option>
            </select>
          </div>
        </div>

        {/* Filter Quick Pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap text-xs">
          <span className="text-slate-400 text-[11px] font-medium">Quick Filters:</span>
          <button
            onClick={() => {
              setExpiryFilter('ALL');
              setStockFilter('ALL');
              setCategoryFilter('ALL');
              setSearchQuery('');
            }}
            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-[11px]"
          >
            Clear All
          </button>
          <button
            onClick={() => setStockFilter('LOW_STOCK')}
            className={`px-2 py-0.5 rounded text-[11px] border ${
              stockFilter === 'LOW_STOCK'
                ? 'bg-amber-100 border-amber-300 text-amber-800 font-semibold'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            ⚠️ Low Stock Batches
          </button>
          <button
            onClick={() => setExpiryFilter('NEAR_EXPIRY')}
            className={`px-2 py-0.5 rounded text-[11px] border ${
              expiryFilter === 'NEAR_EXPIRY'
                ? 'bg-orange-100 border-orange-300 text-orange-800 font-semibold'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            ⏳ Near Expiry (30d)
          </button>
          <button
            onClick={() => setExpiryFilter('EXPIRED')}
            className={`px-2 py-0.5 rounded text-[11px] border ${
              expiryFilter === 'EXPIRED'
                ? 'bg-rose-100 border-rose-300 text-rose-800 font-semibold'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            🚫 Expired Stock
          </button>
        </div>
      </div>

      {/* CONDITIONAL TABLE: BARCODE MERGED vs BATCH WISE */}
      {viewMode === 'BARCODE_MERGED' ? (
        /* ======================== BARCODE MERGED VIEW ======================== */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                <Barcode className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-slate-800">
                Merged Barcode Inventory Directory ({filteredBarcodeRows.length} unique barcodes)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              ⚡ Batches sharing identical barcodes are aggregated automatically
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Product & Category</th>
                  <th className="py-3 px-3">Barcode (Click to Inspect)</th>
                  <th className="py-3 px-3 text-center">Merged In-Stock</th>
                  <th className="py-3 px-3 text-center">Total Inward (CP)</th>
                  <th className="py-3 px-3 text-center">Sales Down (Quick / Pantry)</th>
                  <th className="py-3 px-3">Constituent Batches</th>
                  <th className="py-3 px-3">Pricing & Margin</th>
                  <th className="py-3 px-3">Earliest Expiry</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Aggregating barcode inventory records...
                    </td>
                  </tr>
                ) : filteredBarcodeRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No products found matching barcode search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredBarcodeRows.map((g) => {
                    const margin = g.sellingPrice - g.avgPurchaseRate;
                    const marginPercent = g.sellingPrice > 0 ? Math.round((margin / g.sellingPrice) * 100) : 0;
                    const totalSold = g.totalQuickSoldQuantity + g.totalPantrySoldQuantity;

                    return (
                      <tr key={g.barcode} className="hover:bg-slate-50/90 transition group">
                        {/* Product & Category */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => {
                                const prod = products.find((p) => p.id === g.productId);
                                if (prod && g.batches[0]) setInspectModalState({ product: prod, batch: g.batches[0] });
                              }}
                              className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 cursor-pointer relative group"
                              title="Click to preview product details"
                            >
                              <ImageWithFallback src={g.productImage} alt={g.productName} />
                              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-bold">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            <div>
                              <div
                                onClick={() => setSelectedBarcodeHistory(g.barcode)}
                                className="font-bold text-slate-900 line-clamp-1 max-w-[210px] hover:text-indigo-600 cursor-pointer"
                              >
                                {g.productName}
                              </div>
                              <div className="text-[11px] text-slate-400 font-medium">
                                {g.brand ? `${g.brand} • ` : ''}<span className="text-slate-600 font-semibold">{g.category}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Barcode - Clickable for Full Lifecycle Modal */}
                        <td className="py-3 px-3">
                          <button
                            onClick={() => setSelectedBarcodeHistory(g.barcode)}
                            className="group/btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-mono text-xs font-bold border border-indigo-200 transition cursor-pointer shadow-2xs hover:shadow-xs"
                            title="Click to view full purchase, sales, and return details for this barcode"
                          >
                            <Barcode className="w-4 h-4 text-indigo-600 group-hover/btn:scale-110 transition-transform shrink-0" />
                            <span>{g.barcode}</span>
                          </button>
                          <div className="text-[9px] text-indigo-600 font-sans mt-0.5 ml-0.5 flex items-center gap-0.5 font-medium">
                            <span>🔍 Click for Full History</span>
                          </div>
                        </td>

                        {/* Merged In-Stock Available */}
                        <td className="py-3 px-3 text-center">
                          <div className="text-sm font-black text-slate-900">
                            {g.totalAvailableQuantity} <span className="text-[10px] font-normal text-slate-500">units</span>
                          </div>
                          <div>
                            {g.totalAvailableQuantity === 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Out of Stock
                              </span>
                            ) : g.totalAvailableQuantity <= 5 ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Low Stock ({g.totalAvailableQuantity})
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Available
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total Inward Purchased */}
                        <td className="py-3 px-3 text-center">
                          <div className="font-bold text-slate-800 text-xs">
                            +{g.totalPurchaseQuantity} units
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Avg CP: ₹{g.avgPurchaseRate}
                          </div>
                          <div className="text-[9px] text-slate-400 font-medium">
                            ₹{(g.totalPurchaseQuantity * g.avgPurchaseRate).toLocaleString('en-IN')} total
                          </div>
                        </td>

                        {/* Sales Deductions */}
                        <td className="py-3 px-3 text-center">
                          <div className="font-bold text-rose-700 text-xs">
                            -{totalSold} units
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold">
                              ⚡ Quick: {g.totalQuickSoldQuantity}
                            </span>
                            {g.totalPantrySoldQuantity > 0 ? (
                              <button
                                onClick={() =>
                                  setSelectedPantryHoldingTarget({
                                    barcode: g.barcode,
                                    productName: g.productName,
                                  })
                                }
                                className="px-1.5 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 text-[9px] font-bold inline-flex items-center gap-1 cursor-pointer transition shadow-2xs hover:shadow-xs"
                                title="Click to view which customers have this stock in pantry (Name, Mobile & Address)"
                              >
                                <span>💳 Pantry: {g.totalPantrySoldQuantity}</span>
                                <Users className="w-2.5 h-2.5 text-purple-700" />
                              </button>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[9px] font-semibold">
                                💳 Pantry: 0
                              </span>
                            )}
                          </div>
                          {g.totalReturnedQuantity > 0 && (
                            <div className="text-[9px] text-sky-600 font-semibold mt-0.5">
                              +{g.totalReturnedQuantity} returned
                            </div>
                          )}
                        </td>

                        {/* Constituent Batches (Hidden by default, click to view breakdown) */}
                        <td className="py-3 px-3">
                          {expandedBatches[g.barcode] ? (
                            <div className="bg-indigo-50/80 p-2 rounded-xl border border-indigo-200/60 transition-all">
                              <div className="flex items-center justify-between gap-1.5 text-[11px] font-bold text-indigo-950 mb-1.5">
                                <span className="flex items-center gap-1">
                                  <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>{g.batchCount} Batches Merged:</span>
                                </span>
                                <button
                                  onClick={() => toggleExpandBatch(g.barcode)}
                                  className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                                  title="Collapse batch list"
                                >
                                  <span>Hide</span>
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1 max-w-[190px]">
                                {g.batches.map((b) => (
                                  <button
                                    key={b.id}
                                    onClick={() => setSelectedBatchHistoryNumber(b.batchNumber)}
                                    className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-slate-800 hover:text-indigo-900 rounded-md font-mono text-[10px] font-bold border border-slate-200 transition cursor-pointer shadow-2xs"
                                    title={`Batch #${b.batchNumber} - ${b.availableQuantity} available`}
                                  >
                                    #{b.batchNumber} ({b.availableQuantity})
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleExpandBatch(g.barcode)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs border border-indigo-200 transition cursor-pointer shadow-2xs hover:shadow-xs"
                              title="Click to expand & view constituent batch details"
                            >
                              <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{g.batchCount} Batches Merged</span>
                              <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                            </button>
                          )}
                        </td>

                        {/* Pricing & Margin */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 text-xs">
                            SP: ₹{g.sellingPrice} <span className="text-[10px] text-slate-400 font-normal">MRP ₹{g.mrp}</span>
                          </div>
                          <div className="text-[10px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            <span>Margin: +₹{margin.toFixed(1)} ({marginPercent}%)</span>
                          </div>
                        </td>

                        {/* Earliest Expiry */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {g.nearestExpiryDate ? (
                            <>
                              <div className="text-[11px] font-medium text-slate-800">{g.nearestExpiryDate}</div>
                              {g.isExpired ? (
                                <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                                  <Ban className="w-2.5 h-2.5" /> Expired
                                </span>
                              ) : g.isNearExpiry ? (
                                <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" /> {g.daysToNearestExpiry}d left
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                                  <CheckCircle className="w-2.5 h-2.5" /> Safe
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400 text-[10px]">No expiry recorded</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedBarcodeHistory(g.barcode)}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Inspect full Purchase inward, Sales deductions, and Timeline for this barcode"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Full Barcode Detail</span>
                            </button>
                            <button
                              onClick={onOpenPurchase}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium transition cursor-pointer"
                              title="Add new inward stock for this item"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ======================== BATCH WISE VIEW ======================== */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Product & Image</th>
                  <th className="py-3 px-3">Barcode (Click to Inspect)</th>
                  <th className="py-3 px-3">Batch Number</th>
                  <th className="py-3 px-3">MFG Date</th>
                  <th className="py-3 px-3">Expiry Date</th>
                  <th className="py-3 px-3 text-center">Purchased</th>
                  <th className="py-3 px-3 text-center">Available</th>
                  <th className="py-3 px-3 text-center">Quick Sold</th>
                  <th className="py-3 px-3 text-center">Pantry Sold</th>
                  <th className="py-3 px-3 text-center">Returned</th>
                  <th className="py-3 px-3">Shopkeeper Source</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading batch inventory records...
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-slate-400">
                      No batches found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => {
                    const img = getProductImage(b.productId);
                    const expTime = new Date(b.expiryDate).getTime();
                    const isExpired = expTime < now;
                    const daysToExpiry = Math.floor((expTime - now) / (1000 * 60 * 60 * 24));
                    const isNearExpiry = !isExpired && daysToExpiry <= 30;

                    return (
                      <tr
                        key={b.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isExpired ? 'bg-rose-50/30' : isNearExpiry ? 'bg-orange-50/20' : ''
                        }`}
                      >
                        {/* Product & Image */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => {
                                const prod = products.find((p) => p.id === b.productId);
                                if (prod) setInspectModalState({ product: prod, batch: b });
                              }}
                              className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 cursor-pointer relative group"
                              title="Click to view 4 product images & batch info"
                            >
                              <ImageWithFallback src={img} alt={b.productName} />
                              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-bold">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            <div>
                              <div
                                onClick={() => {
                                  const prod = products.find((p) => p.id === b.productId);
                                  if (prod) setInspectModalState({ product: prod, batch: b });
                                }}
                                className="font-semibold text-slate-900 line-clamp-1 max-w-[200px] hover:text-emerald-700 cursor-pointer"
                              >
                                {b.productName}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">{b.productId}</div>
                            </div>
                          </div>
                        </td>

                        {/* Barcode - Clickable for Barcode Lifecycle */}
                        <td className="py-3 px-3">
                          <button
                            onClick={() => setSelectedBarcodeHistory(b.barcode)}
                            className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-mono text-[11px] font-bold border border-indigo-200 transition cursor-pointer"
                            title="Click to view full Barcode Inward & Sales history with timestamps"
                          >
                            <Barcode className="w-3 h-3 text-indigo-600 group-hover:scale-110 transition-transform shrink-0" />
                            <span>{b.barcode}</span>
                          </button>
                        </td>

                        {/* Batch Number - Clickable for Full History */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          <button
                            onClick={() => setSelectedBatchHistoryNumber(b.batchNumber)}
                            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold transition cursor-pointer shadow-2xs hover:shadow-xs text-left"
                            title="Click to view full Purchase & Sales Lifecycle with Timestamps"
                          >
                            <Boxes className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                            <span>#{b.batchNumber}</span>
                          </button>
                          <div className="text-[9px] text-emerald-700 font-sans mt-0.5 ml-0.5 flex items-center gap-0.5 font-medium">
                            <span>🔍 View Inward/Outward</span>
                          </div>
                        </td>

                        {/* MFG Date */}
                        <td className="py-3 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                          {b.manufacturingDate}
                        </td>

                        {/* Expiry Date */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="text-[11px] font-medium text-slate-800">{b.expiryDate}</div>
                          {isExpired ? (
                            <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                              <Ban className="w-2.5 h-2.5" /> Expired
                            </span>
                          ) : isNearExpiry ? (
                            <span className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" /> {daysToExpiry}d left
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                              <CheckCircle className="w-2.5 h-2.5" /> Safe
                            </span>
                          )}
                        </td>

                        {/* Purchased Qty */}
                        <td className="py-3 px-3 text-center font-semibold text-slate-800">
                          {b.purchaseQuantity}
                        </td>

                        {/* Available Qty */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-bold ${
                              b.availableQuantity === 0
                                ? 'bg-rose-100 text-rose-800'
                                : b.availableQuantity <= 5
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {b.availableQuantity}
                          </span>
                        </td>

                        {/* Quick Sold */}
                        <td className="py-3 px-3 text-center text-slate-600">
                          {b.quickSoldQuantity || 0}
                        </td>

                        {/* Pantry Sold */}
                        <td className="py-3 px-3 text-center">
                          {(b.pantrySoldQuantity || 0) > 0 ? (
                            <button
                              onClick={() =>
                                setSelectedPantryHoldingTarget({
                                  batchNumber: b.batchNumber,
                                  barcode: b.barcode,
                                  productName: b.productName,
                                })
                              }
                              className="px-2 py-0.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition shadow-2xs hover:shadow-xs"
                              title="Click to see which customer has this batch quantity (Name & Mobile Number)"
                            >
                              <span>{b.pantrySoldQuantity}</span>
                              <Users className="w-3 h-3 text-purple-600" />
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">0</span>
                          )}
                        </td>

                        {/* Returned */}
                        <td className="py-3 px-3 text-center text-slate-600">
                          {b.returnedQuantity || 0}
                        </td>

                        {/* Shopkeeper Name (Admin Report Only - Never visible to customer) */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-800">
                            <Store className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="line-clamp-1 max-w-[140px]">{b.shopkeeperName}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          {isExpired ? (
                            <StatusBadge status="EXPIRED" />
                          ) : isNearExpiry ? (
                            <StatusBadge status="NEAR_EXPIRY" />
                          ) : b.availableQuantity <= 5 ? (
                            <StatusBadge status="LOW_STOCK" />
                          ) : (
                            <StatusBadge status="AVAILABLE" />
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedBatchHistoryNumber(b.batchNumber)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Inspect complete Purchase inward and Order deductions ledger"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Details</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBatchForAdjust(b);
                                setAdjustQty(b.availableQuantity);
                                setAdjustReason('');
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition cursor-pointer"
                              title="Stock count correction"
                            >
                              Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* Customer Pantry Holdings Distribution Modal (Triggered by clicking Pantry Sold) */}
      {selectedPantryHoldingTarget && (
        <CustomerPantryHoldingsModal
          isOpen={!!selectedPantryHoldingTarget}
          onClose={() => setSelectedPantryHoldingTarget(null)}
          barcode={selectedPantryHoldingTarget.barcode}
          batchNumber={selectedPantryHoldingTarget.batchNumber}
          productName={selectedPantryHoldingTarget.productName}
          onOpenOrder={onOpenOrder}
        />
      )}

      {/* Barcode Lifecycle Detail & Audit History Modal */}
      {selectedBarcodeHistory && (
        <BarcodeDetailHistoryModal
          barcode={selectedBarcodeHistory}
          isOpen={!!selectedBarcodeHistory}
          onClose={() => setSelectedBarcodeHistory(null)}
          onOpenOrder={onOpenOrder}
          onOpenBatchHistory={(batchNo) => {
            setSelectedBarcodeHistory(null);
            setSelectedBatchHistoryNumber(batchNo);
          }}
          onOpenPurchaseInward={onOpenPurchase}
        />
      )}

      {/* Batch Lifecycle Detail & Audit History Modal */}
      {selectedBatchHistoryNumber && (
        <BatchDetailHistoryModal
          batchIdentifier={selectedBatchHistoryNumber}
          isOpen={!!selectedBatchHistoryNumber}
          onClose={() => setSelectedBatchHistoryNumber(null)}
          onOpenOrder={onOpenOrder}
          onOpenBarcodeHistory={(barcode) => {
            setSelectedBatchHistoryNumber(null);
            setSelectedBarcodeHistory(barcode);
          }}
          onOpenStockAdjust={(batchId, currentQty) => {
            const b = batches.find((item) => item.id === batchId || item.batchNumber === batchId);
            if (b) {
              setSelectedBatchForAdjust(b);
              setAdjustQty(currentQty);
              setAdjustReason('');
            }
          }}
        />
      )}

      {/* Stock Correction Modal */}
      {selectedBatchForAdjust && (
        <AppWindowModal
          isOpen={!!selectedBatchForAdjust}
          onClose={() => setSelectedBatchForAdjust(null)}
          title={`Controlled Stock Correction: ${selectedBatchForAdjust.productName}`}
          subtitle={`Batch Number: ${selectedBatchForAdjust.batchNumber} • Current In-Stock: ${selectedBatchForAdjust.availableQuantity} units`}
          icon={<Boxes className="w-5 h-5 text-emerald-600" />}
          size="lg"
        >
          <div className="p-6">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs space-y-1">
              <div><strong>Product:</strong> {selectedBatchForAdjust.productName}</div>
              <div><strong>Batch Number:</strong> {selectedBatchForAdjust.batchNumber}</div>
              <div><strong>Current Stock:</strong> {selectedBatchForAdjust.availableQuantity} units</div>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Available Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Correction Reason
                </label>
                <textarea
                  rows={3}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g., Physical count discrepancy verified / damaged unit discarded"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedBatchForAdjust(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition cursor-pointer"
                >
                  {adjusting ? 'Saving...' : 'Confirm Correction'}
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* 4-Image Inspection Modal */}
      {inspectModalState && (
        <ProductDetailModal
          product={inspectModalState.product}
          batch={inspectModalState.batch}
          isOpen={!!inspectModalState}
          onClose={() => setInspectModalState(null)}
          userRole="ADMIN"
        />
      )}
    </div>
  );
};
