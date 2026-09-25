import React, { useState, useRef } from 'react';
import {
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Trash2,
  RefreshCw,
  Eye,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

export interface ProductFourImageUploaderProps {
  images: [string, string, string, string];
  onChange: (images: [string, string, string, string]) => void;
  required?: boolean;
}

interface ImageSlotMeta {
  slot: number;
  label: string;
  sublabel: string;
  tag: string;
  placeholder: string;
}

const IMAGE_SLOTS: ImageSlotMeta[] = [
  {
    slot: 1,
    label: 'Image 1: Front / Primary View',
    sublabel: 'Main grocery packaging facing the customer',
    tag: 'MANDATORY',
    placeholder: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=600&q=80',
  },
  {
    slot: 2,
    label: 'Image 2: Back / Nutrition & Ingredients',
    sublabel: 'Nutritional chart, ingredients list & certifications',
    tag: 'MANDATORY',
    placeholder: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
  },
  {
    slot: 3,
    label: 'Image 3: Side / Pack Angle',
    sublabel: 'Usage directions, storage conditions, net weight',
    tag: 'MANDATORY',
    placeholder: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
  },
  {
    slot: 4,
    label: 'Image 4: Barcode / Top / Seal Details',
    sublabel: 'Physical barcode, seal stamp & batch imprint area',
    tag: 'MANDATORY',
    placeholder: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80',
  },
];

// High quality curated 4-angle presets for common grocery categories
const GROCERY_4_IMAGE_PRESETS = [
  {
    category: 'Health Drinks & Malt',
    name: 'Horlicks / Nutrition Drink',
    images: [
      'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80',
    ] as [string, string, string, string],
  },
  {
    category: 'Atta & Flours',
    name: 'Aashirvaad Chakki Atta',
    images: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=600&q=80',
    ] as [string, string, string, string],
  },
  {
    category: 'Edible Oils & Ghee',
    name: 'Refined Sunflower Oil',
    images: [
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=600&q=80',
    ] as [string, string, string, string],
  },
  {
    category: 'Rice & Grains',
    name: 'India Gate Basmati Rice',
    images: [
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    ] as [string, string, string, string],
  },
  {
    category: 'Dals & Pulses',
    name: 'Tata Sampann Toor Dal',
    images: [
      'https://images.unsplash.com/photo-1585994276707-1b09b55589c3?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=600&q=80',
    ] as [string, string, string, string],
  },
  {
    category: 'Noodles & Snacks',
    name: 'Maggi 2-Minute Noodles',
    images: [
      'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
    ] as [string, string, string, string],
  },
];

export const ProductFourImageUploader: React.FC<ProductFourImageUploaderProps> = ({
  images,
  onChange,
  required = true,
}) => {
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [mode, setMode] = useState<'upload' | 'url'>('url');
  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleUpdateImage = (index: number, value: string) => {
    const updated: [string, string, string, string] = [...images];
    updated[index] = value;
    onChange(updated);
  };

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size too large. Please select an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleUpdateImage(index, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = (index: number) => {
    handleUpdateImage(index, '');
  };

  const handleApplyPreset = (presetImages: [string, string, string, string]) => {
    onChange([...presetImages]);
  };

  // Count filled images
  const filledCount = images.filter((img) => img && img.trim().length > 0).length;
  const isComplete = filledCount === 4;

  return (
    <div className="space-y-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
      {/* Top Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              4 Mandatory Product Images System
            </h4>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isComplete
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {filledCount} of 4 Images Provided {isComplete ? '✓ Ready' : '• Incomplete'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Every product SKU requires 4 mandatory visual angles (Front, Back/Nutrition, Side, Barcode/Seal) for seamless customer viewing &amp; auditor verification.
          </p>
        </div>

        {/* Quick Presets Dropdown */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span className="text-[11px] font-semibold text-slate-600">Sample 4-Angle Packs:</span>
          <select
            onChange={(e) => {
              const selected = GROCERY_4_IMAGE_PRESETS.find((p) => p.name === e.target.value);
              if (selected) handleApplyPreset(selected.images);
            }}
            defaultValue=""
            className="text-[11px] font-medium py-1 px-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="" disabled>
              -- Auto-Fill 4 Angles --
            </option>
            {GROCERY_4_IMAGE_PRESETS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} ({p.category})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 Image Slots Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {IMAGE_SLOTS.map((slotMeta, idx) => {
          const imgUrl = images[idx] || '';
          const hasImage = imgUrl.trim().length > 0;

          return (
            <div
              key={idx}
              className={`bg-white rounded-xl border-2 transition p-3 flex flex-col justify-between ${
                hasImage ? 'border-emerald-500/80 shadow-xs' : 'border-dashed border-slate-300 bg-slate-50/50'
              }`}
            >
              {/* Slot Header */}
              <div className="space-y-1 mb-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">
                      {slotMeta.slot}
                    </span>
                    <span>Angle {slotMeta.slot}</span>
                  </span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                    Mandatory
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-700">{slotMeta.label.split(': ')[1]}</div>
                <p className="text-[10px] text-slate-400 line-clamp-1">{slotMeta.sublabel}</p>
              </div>

              {/* Image Preview Box */}
              <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-200 mb-2 group">
                {hasImage ? (
                  <>
                    <ImageWithFallback src={imgUrl} alt={slotMeta.label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRefs[idx].current?.click()}
                        className="p-1.5 bg-white text-slate-800 rounded-md hover:bg-slate-100 text-[10px] font-bold shadow-xs cursor-pointer"
                        title="Replace Image File"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClearImage(idx)}
                        className="p-1.5 bg-rose-600 text-white rounded-md hover:bg-rose-700 text-[10px] font-bold shadow-xs cursor-pointer"
                        title="Remove Image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => fileInputRefs[idx].current?.click()}
                    className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 cursor-pointer hover:bg-slate-200/60 transition"
                  >
                    <Upload className="w-5 h-5 text-slate-400 mb-1" />
                    <span className="text-[10px] font-medium text-center">Click to upload file</span>
                    <span className="text-[9px] text-slate-400">or enter URL below</span>
                  </div>
                )}
              </div>

              {/* Input Options: Direct URL & File Trigger */}
              <div className="space-y-2">
                <div>
                  <input
                    type="url"
                    placeholder={`Enter URL for Image ${idx + 1}`}
                    value={imgUrl}
                    onChange={(e) => handleUpdateImage(idx, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                    required={required}
                  />
                </div>

                <div className="flex items-center justify-between gap-1">
                  <input
                    type="file"
                    ref={fileInputRefs[idx]}
                    onChange={(e) => handleFileUpload(idx, e)}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs[idx].current?.click()}
                    className="flex-1 py-1 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Upload className="w-3 h-3 text-slate-500" />
                    <span>Upload Device File</span>
                  </button>

                  {hasImage && (
                    <button
                      type="button"
                      onClick={() => handleClearImage(idx)}
                      className="py-1 px-2 rounded text-slate-400 hover:text-rose-600 text-[10px] transition cursor-pointer"
                      title="Clear"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mandatory Validation Warning */}
      {!isComplete && required && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Requirement Notice:</strong> All 4 images are mandatory. Please provide Front, Back, Side, and Packaging Detail angles before saving.
          </span>
        </div>
      )}
    </div>
  );
};
