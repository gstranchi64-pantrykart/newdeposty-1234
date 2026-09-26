import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductBatch, Customer, hasPantryAccess, CustomerProductTimeline, PantryCardItem, Auditor } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ProductImageSlider } from '../common/ProductImageSlider';
import { ProductDetailModal } from '../common/ProductDetailModal';
import { ProductTimelineModal } from '../common/ProductTimelineModal';
import { PantryPayScannerUI } from './PantryPayScannerUI';
import {
  ShoppingBag,
  CreditCard,
  Search,
  Filter,
  Plus,
  Minus,
  Sparkles,
  Info,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Eye,
  Images,
  Check,
  CheckCircle2,
  QrCode,
  X,
  Phone,
  MapPin,
  RefreshCw,
} from 'lucide-react';

interface CustomerStorefrontProps {
  onAddToCart: (product: Product, batch: ProductBatch, orderType: 'PANTRY' | 'QUICK') => void;
  quickCartItemsCount: number;
  pantryCartItemsCount: number;
}

export const CustomerStorefront: React.FC<CustomerStorefrontProps> = ({
  onAddToCart,
  quickCartItemsCount,
  pantryCartItemsCount,
}) => {
  const { customer, refreshUserData, updateCustomerState } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile Completion form state
  const [profileName, setProfileName] = useState(customer?.fullName || '');
  const [profileAddress, setProfileAddress] = useState(customer?.address || '');
  const [profileArea, setProfileArea] = useState(customer?.area || '');
  const [profilePin, setProfilePin] = useState(customer?.pinCode || '');
  const [profileLandmark, setProfileLandmark] = useState(customer?.landmark || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Sync state if customer changes
  useEffect(() => {
    if (customer) {
      if (profileName === 'New Customer' || !profileName) setProfileName(customer.fullName || '');
      if (!profileAddress) setProfileAddress(customer.address || '');
      if (!profileArea) setProfileArea(customer.area || '');
      if (!profilePin) setProfilePin(customer.pinCode || '');
      if (!profileLandmark) setProfileLandmark(customer.landmark || '');
    }
  }, [customer]);

  const isProfileIncomplete = !customer || !customer.address || !customer.pinCode || customer.fullName === 'New Customer';

  const handleSaveProfileDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!profileName.trim() || profileName === 'New Customer') {
      alert('Please enter your actual Full Name.');
      return;
    }
    if (!profileAddress.trim()) {
      alert('Please enter your Complete Street Address.');
      return;
    }
    if (!profilePin.trim() || profilePin.length !== 6) {
      alert('Please enter a valid 6-digit Pin Code.');
      return;
    }

    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const updated = await api.updateCustomer(customer.id, {
        fullName: profileName.trim(),
        address: profileAddress.trim(),
        area: profileArea.trim(),
        pinCode: profilePin.trim(),
        landmark: profileLandmark.trim(),
      });
      updateCustomerState(updated);
      setProfileMsg('✓ Delivery Profile completed successfully! Enjoy your shopping.');
    } catch (err: any) {
      alert(err.message || 'Failed to update delivery profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeCatalogMode, setActiveCatalogMode] = useState<'ALL' | 'PANTRY' | 'QUICK'>('ALL');
  const [addedFeedback, setAddedFeedback] = useState<Record<string, string>>({});
  const [showPantryPayModal, setShowPantryPayModal] = useState(false);

  const handleAddWithFeedback = (product: Product, batch: ProductBatch, orderType: 'PANTRY' | 'QUICK') => {
    onAddToCart(product, batch, orderType);
    const key = `${product.id}-${orderType}`;
    setAddedFeedback((prev) => ({ ...prev, [key]: 'Added!' }));
    setTimeout(() => {
      setAddedFeedback((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }, 1200);
  };

  // Active Product Modal for detailed 4-angle inspection
  const [detailModalState, setDetailModalState] = useState<{
    product: Product;
    batch: ProductBatch | null;
  } | null>(null);

  // Customer Product History Timelines & In-Pantry Stock
  const [customerTimelines, setCustomerTimelines] = useState<CustomerProductTimeline[]>([]);
  const [selectedTimelineForView, setSelectedTimelineForView] = useState<CustomerProductTimeline | null>(null);
  const [customerPantryItems, setCustomerPantryItems] = useState<PantryCardItem[]>([]);
  const fetchData = async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const [prodList, batchList] = await Promise.all([
        api.getProducts(true), // published only
        api.getBatches(),
      ]);
      setProducts(prodList);
      setBatches(batchList);
      if (customer) {
        const [timelines, pItems] = await Promise.all([
          api.getCustomerProductTimeline(customer.id).catch(() => []),
          api.getPantryCard(customer.id).catch(() => []),
        ]);
        setCustomerTimelines(timelines || []);
        setCustomerPantryItems(pItems || []);
      }
      refreshUserData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Map of productId -> current quantity available in customer's home pantry
  const pantryStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of customerPantryItems) {
      if (item.productId && item.quantity > 0) {
        map[item.productId] = (map[item.productId] || 0) + item.quantity;
      }
    }
    return map;
  }, [customerPantryItems]);

  useEffect(() => {
    fetchData();
    const unsubscribe = api.subscribeRealtime(() => {
      fetchData(true);
    });
    return () => unsubscribe();
  }, []);

  const now = new Date().getTime();

  // Pick the best available FIFO batch for a product (earliest expiry with available quantity)
  const getBestBatchForProduct = (productId: string): ProductBatch | null => {
    const validBatches = batches
      .filter((b) => {
        if (b.productId !== productId) return false;
        if (b.availableQuantity <= 0) return false;
        const expTime = new Date(b.expiryDate).getTime();
        return expTime > now;
      })
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    return validBatches[0] || null;
  };

  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);

    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

    let matchesMode = true;
    const eligibility = p.orderEligibility || 'BOTH';
    if (activeCatalogMode === 'PANTRY') {
      matchesMode = eligibility === 'BOTH' || eligibility === 'PANTRY_ONLY';
    } else if (activeCatalogMode === 'QUICK') {
      matchesMode = eligibility === 'BOTH' || eligibility === 'QUICK_ONLY';
    }

    return matchesSearch && matchesCategory && matchesMode;
  });

  return (
    <div className="space-y-6">
      {isProfileIncomplete && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-5 rounded-2xl border border-amber-300 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-sm">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-900">Complete Your Delivery Profile</h3>
              <p className="text-xs text-amber-800 font-medium">
                Please provide your full name and delivery address details so our partners can deliver your orders accurately.
              </p>
            </div>
          </div>

          {profileMsg && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold">
              {profileMsg}
            </div>
          )}

          <form onSubmit={handleSaveProfileDirect} className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Full Name *</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Enter First & Last Name"
                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Pin Code *</label>
              <input
                type="text"
                maxLength={6}
                value={profilePin}
                onChange={(e) => setProfilePin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 834001"
                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Street Address *</label>
              <input
                type="text"
                value={profileAddress}
                onChange={(e) => setProfileAddress(e.target.value)}
                placeholder="House No., Building Name, Street / Road info"
                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Area / Ward No.</label>
              <input
                type="text"
                value={profileArea}
                onChange={(e) => setProfileArea(e.target.value)}
                placeholder="e.g. Lalpur / Kanke Road"
                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Landmark (Optional)</label>
              <input
                type="text"
                value={profileLandmark}
                onChange={(e) => setProfileLandmark(e.target.value)}
                placeholder="e.g. Near Kali Mandir"
                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="md:col-span-2 pt-2 flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {profileSaving ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Save & Continue Shopping
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Catalog Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Track Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveCatalogMode('ALL')}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCatalogMode === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shop All Groceries ({products.length})
            </button>
            {hasPantryAccess(customer) && (
              <button
                onClick={() => setActiveCatalogMode('PANTRY')}
                className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeCatalogMode === 'PANTRY'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-purple-700'
                }`}
              >
                <Layers className="w-4 h-4" />
                Pantry Mall (Pantry OK)
              </button>
            )}
            <button
              onClick={() => setActiveCatalogMode('QUICK')}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeCatalogMode === 'QUICK'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <Zap className="w-4 h-4" />
              Quick Mall (Quick Order)
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search staples, oils, snacks, dairy, brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === c
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c === 'ALL' ? 'All Aisles' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Product Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium">Fetching catalog stock &amp; fresh batches...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No products found</p>
          <p className="text-xs text-slate-400 mt-1">Try tweaking your search or selected aisle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredProducts.map((p) => {
            const bestBatch = getBestBatchForProduct(p.id);
            const inStock = !!bestBatch && bestBatch.availableQuantity > 0;
            const isPantryAllowedForCustomer = hasPantryAccess(customer);
            const inPantryQty = pantryStockMap[p.id] || 0;
            
            // Exclusive Button Logic: In a specific mall mode, only show that mall's button
            const canPantry =
              isPantryAllowedForCustomer &&
              (p.orderEligibility === 'BOTH' || p.orderEligibility === 'PANTRY_ONLY') &&
              (activeCatalogMode === 'ALL' || activeCatalogMode === 'PANTRY');
            
            const canQuick =
              (p.orderEligibility === 'BOTH' || p.orderEligibility === 'QUICK_ONLY') &&
              (activeCatalogMode === 'ALL' || activeCatalogMode === 'QUICK');

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* 4-Image Slider with interactive dots & zoom */}
                  <div className="relative">
                    <ProductImageSlider
                      images={p.images}
                      alt={p.name}
                      aspectRatio="aspect-square"
                      showDots={true}
                      showArrows={true}
                      showCounter={false}
                      allowZoom={true}
                      badges={
                        p.discount > 0 ? (
                          <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs">
                            {p.discount}% OFF
                          </span>
                        ) : undefined
                      }
                    />

                    {/* Eligibility Tag Top Right */}
                    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end pointer-events-none">
                      {isPantryAllowedForCustomer && (p.orderEligibility === 'BOTH' || p.orderEligibility === 'PANTRY_ONLY') && (
                        <span className="bg-purple-900/80 backdrop-blur-xs text-purple-100 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Pantry OK
                        </span>
                      )}
                      {(p.orderEligibility === 'BOTH' || p.orderEligibility === 'QUICK_ONLY') && (
                        <span className="bg-amber-900/80 backdrop-blur-xs text-amber-100 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Quick COD
                        </span>
                      )}
                    </div>

                    {/* Stock Status Badge */}
                    {!inStock && (
                      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-10">
                        <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {p.brand} • {p.weightSize}
                      </div>
                      {inPantryQty > 0 && (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>In Pantry: <strong className="font-extrabold text-emerald-700">{inPantryQty} {inPantryQty === 1 ? 'unit' : 'units'}</strong></span>
                        </span>
                      )}
                    </div>

                    <h3
                      onClick={() => setDetailModalState({ product: p, batch: bestBatch })}
                      className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug hover:text-emerald-700 cursor-pointer transition"
                    >
                      {p.name}
                    </h3>

                    {/* Price */}
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-lg font-extrabold text-slate-900">
                        ₹{p.sellingPrice}
                      </span>
                      {p.mrp > p.sellingPrice && (
                        <span className="text-xs text-slate-400 line-through">
                          MRP ₹{p.mrp}
                        </span>
                      )}
                    </div>

                    {/* Product Category Tag - Only Plain Text, No Box/Pills, Lowercase */}
                    <div className="text-xs text-slate-500 pt-0.5 lowercase">
                      {p.category} {p.subCategory ? `• ${p.subCategory}` : ''}
                    </div>
                  </div>
                </div>

                {/* Dual Add Buttons */}
                <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                  {canPantry && (
                    <button
                      onClick={() => bestBatch && handleAddWithFeedback(p, bestBatch, 'PANTRY')}
                      disabled={!inStock}
                      className={`w-full py-2 px-2 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer ${
                        addedFeedback[`${p.id}-PANTRY`]
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                      title="Add to Pantry Card Order (0 COD)"
                    >
                      {addedFeedback[`${p.id}-PANTRY`] ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added!</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>+ Pantry</span>
                        </>
                      )}
                    </button>
                  )}

                  {canQuick && (
                    <button
                      onClick={() => bestBatch && handleAddWithFeedback(p, bestBatch, 'QUICK')}
                      disabled={!inStock}
                      className={`w-full py-2 px-2 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer ${
                        addedFeedback[`${p.id}-QUICK`]
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      } ${!canPantry ? 'col-span-2' : ''}`}
                      title="Add to Quick COD Order"
                    >
                      {addedFeedback[`${p.id}-QUICK`] ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added!</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>+ Quick</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4-Image Detail Modal */}
      {detailModalState && (
        <ProductDetailModal
          product={detailModalState.product}
          batch={detailModalState.batch}
          inPantryQuantity={pantryStockMap[detailModalState.product.id] || 0}
          isOpen={!!detailModalState}
          onClose={() => setDetailModalState(null)}
          onAddToCart={onAddToCart}
        />
      )}

      {/* Pantry Pay Scanner Direct Modal */}
      {showPantryPayModal && hasPantryAccess(customer) && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden relative border border-slate-200 my-8">
            <button
              onClick={() => setShowPantryPayModal(false)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="p-6">
              {customer ? (
                <PantryPayScannerUI customer={customer} />
              ) : (
                <div className="text-center py-6 text-xs text-slate-500">Please log in as customer to use Pantry Pay.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Timeline History Modal */}
      {selectedTimelineForView && (
        <ProductTimelineModal
          timeline={selectedTimelineForView}
          onClose={() => setSelectedTimelineForView(null)}
          customerName={customer?.fullName}
        />
      )}
    </div>
  );
};
