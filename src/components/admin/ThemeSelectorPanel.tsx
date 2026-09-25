import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ThemePalette } from '../../theme/themeConfig';
import { Palette, Check, Sparkles, CheckCircle2, ShieldCheck, ShoppingBag, ClipboardCheck, ArrowRight } from 'lucide-react';

interface ThemeSelectorPanelProps {
  compact?: boolean;
  onThemeSelected?: (theme: ThemePalette) => void;
}

export const ThemeSelectorPanel: React.FC<ThemeSelectorPanelProps> = ({
  compact = false,
  onThemeSelected,
}) => {
  const { currentTheme, themes, changeTheme, isApplying } = useTheme();
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleSelect = async (theme: ThemePalette) => {
    await changeTheme(theme.id);
    setSuccessToast(`Theme changed to "${theme.name}"! Applied instantly across Admin, Customer & Auditor portals.`);
    if (onThemeSelected) onThemeSelected(theme);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Group themes by category
  const categories = [
    { key: 'YELLOW', label: 'Yellow Themes (2 Readymade Types)', color: 'text-amber-600', icon: '🟡' },
    { key: 'BLUE', label: 'Blue Themes (2 Readymade Types)', color: 'text-blue-600', icon: '🔵' },
    { key: 'GREEN', label: 'Green Themes (2 Readymade Types)', color: 'text-emerald-600', icon: '🟢' },
    { key: 'PARROT', label: 'Parrot Color Themes (2 Readymade Types)', color: 'text-lime-600', icon: '🦜' },
    { key: 'ACCENT', label: 'Special Accent Themes (2 Readymade Types)', color: 'text-purple-600', icon: '✨' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md transition-all"
              style={{ background: currentTheme.gradient, color: currentTheme.textOnPrimary }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>10 Readymade ERP Themes (1-Click Switch)</span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-black border"
                  style={{
                    backgroundColor: currentTheme.badgeBg,
                    color: currentTheme.badgeText,
                    borderColor: currentTheme.badgeBorder,
                  }}
                >
                  Active: {currentTheme.name}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any theme below to instantly apply color palette across all Buttons, Header, Footer, and Open Windows in Admin, Customer, and Auditor portals.
              </p>
            </div>
          </div>
        </div>

        {/* Live Active Theme Preview Chip */}
        <div className="flex items-center gap-2 self-stretch md:self-auto bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-600">Current Theme:</div>
          <div
            className="px-3 py-1 rounded-lg text-xs font-black shadow-xs flex items-center gap-1.5"
            style={{
              backgroundColor: currentTheme.primary,
              color: currentTheme.textOnPrimary,
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{currentTheme.name.split('(')[0]}</span>
          </div>
        </div>
      </div>

      {/* Instant Success Alert */}
      {successToast && (
        <div
          className="p-4 rounded-xl text-xs font-bold border flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-md"
          style={{
            backgroundColor: currentTheme.primary50,
            color: currentTheme.primaryDark,
            borderColor: currentTheme.primary,
          }}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 shrink-0" style={{ color: currentTheme.primary }} />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-slate-400 hover:text-slate-700 font-bold px-2 py-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Role Coherence Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: currentTheme.primaryLight, color: currentTheme.primaryDark }}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Admin Dashboard &amp; ERP</div>
            <div className="text-[10px] text-slate-500">Buttons, action cards, headers &amp; modals</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: currentTheme.primaryLight, color: currentTheme.primaryDark }}
          >
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Customer Storefront</div>
            <div className="text-[10px] text-slate-500">Add to cart, bottom navigation &amp; passbook</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: currentTheme.primaryLight, color: currentTheme.primaryDark }}
          >
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Auditor &amp; Delivery Portals</div>
            <div className="text-[10px] text-slate-500">Verification actions, audit bills &amp; reports</div>
          </div>
        </div>
      </div>

      {/* Category Sections */}
      {categories.map((cat) => {
        const catThemes = themes.filter((t) => t.category === cat.key);
        if (catThemes.length === 0) return null;

        return (
          <div key={cat.key} className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <span className="text-base">{cat.icon}</span>
              <h4 className={`text-sm font-black tracking-tight ${cat.color}`}>{cat.label}</h4>
              <span className="text-[11px] text-slate-400 font-semibold">• 1-Click to Activate</span>
            </div>

            <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2'} gap-4`}>
              {catThemes.map((theme) => {
                const isActive = currentTheme.id === theme.id;

                return (
                  <div
                    key={theme.id}
                    onClick={() => handleSelect(theme)}
                    className={`relative rounded-2xl p-4 sm:p-5 border-2 transition-all cursor-pointer bg-white group hover:shadow-lg ${
                      isActive
                        ? 'shadow-md scale-[1.01]'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    style={{
                      borderColor: isActive ? theme.primary : undefined,
                    }}
                  >
                    {/* Active Ribbon Badge */}
                    {isActive && (
                      <div
                        className="absolute -top-3 right-4 px-3 py-0.5 rounded-full text-[10px] font-black shadow-sm flex items-center gap-1 border"
                        style={{
                          backgroundColor: theme.primary,
                          color: theme.textOnPrimary,
                          borderColor: theme.primaryDark,
                        }}
                      >
                        <Check className="w-3 h-3" />
                        <span>CURRENT ACTIVE THEME</span>
                      </div>
                    )}

                    {/* Top Row: Color Palette Swatches & Name */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h5 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                          <span>{theme.name}</span>
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {theme.description}
                        </p>
                      </div>

                      {/* 4 Palette Swatches */}
                      <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                        {theme.previewColors.map((color, idx) => (
                          <div
                            key={idx}
                            className="w-4 h-6 rounded-md shadow-3xs border border-black/10"
                            style={{ backgroundColor: color }}
                            title={`Color ${idx + 1}: ${color}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Live Component UI Mockup Bar */}
                    <div
                      className="rounded-xl p-3 border mb-3 flex flex-wrap items-center justify-between gap-2"
                      style={{
                        backgroundColor: theme.primary50,
                        borderColor: theme.primaryLight,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {/* Sample Button */}
                        <div
                          className="px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: theme.primary,
                            color: theme.textOnPrimary,
                          }}
                        >
                          <span>Sample Button</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>

                        {/* Sample Badge */}
                        <div
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                          style={{
                            backgroundColor: theme.badgeBg,
                            color: theme.badgeText,
                            borderColor: theme.badgeBorder,
                          }}
                        >
                          Verified Badge
                        </div>
                      </div>

                      {/* Sample Mini Header Accent */}
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: theme.primary }}
                        />
                        <span>Header / Window Accent</span>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-400 font-medium font-mono">
                        ID: {theme.id}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(theme);
                        }}
                        disabled={isApplying}
                        className={`px-3 py-1.5 rounded-lg font-bold transition text-xs flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'hover:bg-slate-800 hover:text-white bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Selected</span>
                          </>
                        ) : (
                          <>
                            <Palette className="w-3.5 h-3.5" />
                            <span>Apply This Theme</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
