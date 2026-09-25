import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Package, X } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

export interface ProductImageSliderProps {
  images: string[] | [string, string, string, string];
  alt: string;
  aspectRatio?: string; // e.g. 'aspect-square', 'h-48', 'h-64'
  className?: string;
  showThumbnails?: boolean;
  showDots?: boolean;
  showArrows?: boolean;
  showCounter?: boolean;
  showAngleLabels?: boolean;
  allowZoom?: boolean;
  badges?: React.ReactNode;
  onImageClick?: (index: number) => void;
}

const DEFAULT_ANGLE_LABELS = [
  '1. Front / Primary View',
  '2. Back / Nutrition & Ingredients',
  '3. Side / Usage Angle',
  '4. Barcode / Packaging Details',
];

export const ProductImageSlider: React.FC<ProductImageSliderProps> = ({
  images,
  alt,
  aspectRatio = 'aspect-square',
  className = '',
  showThumbnails = false,
  showDots = true,
  showArrows = true,
  showCounter = false,
  showAngleLabels = false,
  allowZoom = false,
  badges,
  onImageClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // Normalize image list (ensure at least 1 image exists, fallback to placeholder)
  const validImages: string[] =
    Array.isArray(images) && images.length > 0
      ? images.filter(Boolean)
      : ['https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'];

  const total = Math.max(validImages.length, 1);
  const safeIndex = Math.min(currentIndex, total - 1);
  const currentImage = validImages[safeIndex] || validImages[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev <= 0 ? total - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev >= total - 1 ? 0 : prev + 1));
  };

  const handleSelect = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(idx);
    if (onImageClick) onImageClick(idx);
  };

  const handleContainerClick = () => {
    if (allowZoom) {
      setIsZoomOpen(true);
    } else if (onImageClick) {
      onImageClick(safeIndex);
    }
  };

  return (
    <div className={`flex flex-col select-none ${className}`}>
      {/* Main Slide Stage */}
      <div
        onClick={handleContainerClick}
        className={`relative w-full ${aspectRatio} bg-slate-50 overflow-hidden group/slider rounded-xl border border-slate-100 ${
          allowZoom ? 'cursor-zoom-in' : ''
        }`}
      >
        {/* Active Image */}
        <ImageWithFallback
          src={currentImage}
          alt={`${alt} - Image ${safeIndex + 1}`}
          className="w-full h-full object-cover transition-all duration-300 group-hover/slider:scale-105"
        />

        {/* Custom Badges (e.g. Discount, Track Eligibility) */}
        {badges && <div className="absolute top-2 left-2 z-10 pointer-events-none">{badges}</div>}

        {/* Counter Badge (e.g. 1/4) */}
        {showCounter && total > 1 && (
          <div className="absolute bottom-2 right-2 z-10 bg-slate-900/75 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
            {safeIndex + 1} / {total}
          </div>
        )}

        {/* Angle Label (e.g. Front View) */}
        {showAngleLabels && (
          <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-xs border border-slate-200 text-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded shadow-xs">
            {DEFAULT_ANGLE_LABELS[safeIndex] || `Angle ${safeIndex + 1}`}
          </div>
        )}

        {/* Left / Prev Arrow */}
        {showArrows && total > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous image"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-opacity cursor-pointer border border-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Right / Next Arrow */}
        {showArrows && total > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next image"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-opacity cursor-pointer border border-slate-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Zoom Hint Icon on hover */}
        {allowZoom && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomOpen(true);
            }}
            title="Click to zoom images"
            className="absolute bottom-2 left-2 z-10 w-6 h-6 rounded bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover/slider:opacity-100 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dot Indicators */}
        {showDots && total > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900/40 backdrop-blur-xs">
            {validImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => handleSelect(idx, e)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`transition-all rounded-full cursor-pointer ${
                  safeIndex === idx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Optional Thumbnail Strip */}
      {showThumbnails && total > 1 && (
        <div className="grid grid-cols-4 gap-2 mt-2">
          {validImages.slice(0, 4).map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => handleSelect(idx, e)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition cursor-pointer bg-slate-50 ${
                safeIndex === idx ? 'border-emerald-600 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <ImageWithFallback src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              <span className="absolute bottom-0.5 right-0.5 bg-slate-900/80 text-white text-[8px] px-1 rounded font-bold">
                #{idx + 1}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {isZoomOpen && (
        <div
          onClick={() => setIsZoomOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl p-4 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-white">
              <div>
                <h4 className="font-bold text-sm">{alt}</h4>
                <p className="text-xs text-slate-400">
                  {DEFAULT_ANGLE_LABELS[safeIndex] || `Image ${safeIndex + 1}`} • ({safeIndex + 1} of {total})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Image View */}
            <div className="relative aspect-4/3 sm:aspect-16/10 w-full bg-black/40 rounded-xl overflow-hidden my-3 flex items-center justify-center">
              <img
                src={currentImage}
                alt={`${alt} - Full View`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />

              {/* Prev / Next Modal Arrows */}
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg cursor-pointer"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {/* Modal 4 Thumbnails */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
              {validImages.slice(0, 4).map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => handleSelect(idx, e)}
                  className={`relative h-16 rounded-lg overflow-hidden border-2 transition cursor-pointer bg-slate-800 ${
                    safeIndex === idx ? 'border-emerald-400 ring-2 ring-emerald-400/30' : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <span className="absolute bottom-1 left-1 bg-slate-950/80 text-white text-[9px] px-1 rounded font-bold">
                    {idx + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
