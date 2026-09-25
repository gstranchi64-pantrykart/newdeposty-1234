import React from 'react';
import { Product, ProductBatch } from '../../types';
import { ProductImageSlider } from './ProductImageSlider';
import { AppWindowModal } from './AppWindowModal';
import {
  X,
  CreditCard,
  ShoppingBag,
  Clock,
  ShieldCheck,
  Tag,
  Barcode,
  Package,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

export interface ProductDetailModalProps {
  product: Product | null;
  batch?: ProductBatch | null;
  inPantryQuantity?: number;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: Product, batch: ProductBatch, orderType: 'PANTRY' | 'QUICK') => void;
  userRole?: string;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  batch,
  inPantryQuantity = 0,
  isOpen,
  onClose,
  onAddToCart,
  userRole = 'CUSTOMER',
}) => {
  if (!isOpen || !product) return null;

  const canPantry = product.orderEligibility === 'BOTH' || product.orderEligibility === 'PANTRY_ONLY';
  const canQuick = product.orderEligibility === 'BOTH' || product.orderEligibility === 'QUICK_ONLY';
  const inStock = !!batch && batch.availableQuantity > 0;

  return (
    <AppWindowModal
      isOpen={isOpen}
      onClose={onClose}
      title={product.name}
      subtitle={product.brand ? `${product.brand} • SKU: ${product.id}` : `SKU: ${product.id}`}
      icon={<Package className="w-5 h-5 text-emerald-600" />}
      size="xl"
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
          {product.category}
        </span>
      }
    >
      <div className="p-6">
        {/* Modal Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: 4-Image Slider Gallery */}
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-2xl p-2 border border-slate-100">
              <ProductImageSlider
                images={product.images}
                alt={product.name}
                aspectRatio="aspect-square"
                showThumbnails={true}
                showDots={true}
                showArrows={true}
                showCounter={false}
                showAngleLabels={true}
                allowZoom={true}
                badges={
                  product.discount > 0 ? (
                    <span className="bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded-md shadow-sm">
                      {product.discount}% OFF
                    </span>
                  ) : undefined
                }
              />
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Tip: Click image to zoom. 4 angles provided: Front, Nutrition/Back, Side, Barcode/Seal.
            </p>
          </div>

          {/* Right Column: SKU Details, Live Batch Stock & Dual-Track Purchasing */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {product.brand}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 leading-snug mt-0.5">
                  {product.name}
                </h3>
                <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-3 flex-wrap">
                  <span>Unit / Net Wt: <strong>{product.weightSize}</strong></span>
                  <span className="flex items-center gap-1 font-mono">
                    <Barcode className="w-3.5 h-3.5 text-slate-400" /> {product.barcode}
                  </span>
                </div>
              </div>

              {/* In-Pantry Stock Alert Banner */}
              {inPantryQuantity > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-extrabold text-emerald-950">
                      Already in Your Pantry Stock ({inPantryQuantity} {inPantryQuantity === 1 ? 'unit' : 'units'})
                    </div>
                    <div className="text-[11px] text-emerald-700">
                      You currently have {inPantryQuantity} unit(s) of this item at home.
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Section */}
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] text-emerald-800 font-semibold">Special Offer Price</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-950">₹{product.sellingPrice}</span>
                    {product.mrp > product.sellingPrice && (
                      <span className="text-sm text-slate-400 line-through">MRP ₹{product.mrp}</span>
                    )}
                  </div>
                </div>
                {product.discount > 0 && (
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-xs">
                      Save ₹{product.mrp - product.sellingPrice} ({product.discount}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-700">Product Description</div>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Live Batch & Expiry Info */}
              {batch ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-800 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      Live Inventory Batch
                    </span>
                    <span className="font-mono text-emerald-700 font-extrabold">
                      #{batch.batchNumber}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                    <div>
                      MFG: <strong className="text-slate-800">{batch.manufacturingDate}</strong>
                    </div>
                    <div>
                      EXP: <strong className="text-emerald-700">{batch.expiryDate}</strong>
                    </div>
                    <div>
                      Stock: <strong className="text-slate-900">{batch.availableQuantity} units</strong>
                    </div>
                    <div>
                      Warranty: <strong className="text-purple-700">Pantry Doorstep Replaceable</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No active stock batch currently assigned to this SKU.</span>
                </div>
              )}
            </div>

            {/* Actions for Customer */}
            {onAddToCart && batch && inStock && (
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Select Order Track
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {canPantry && (
                    <button
                      onClick={() => {
                        onAddToCart(product, batch, 'PANTRY');
                        onClose();
                      }}
                      className="w-full py-3 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Order via Pantry Card (0 COD)</span>
                    </button>
                  )}

                  {canQuick && (
                    <button
                      onClick={() => {
                        onAddToCart(product, batch, 'QUICK');
                        onClose();
                      }}
                      className={`w-full py-3 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                        !canPantry ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Quick COD Delivery</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppWindowModal>
  );
};
