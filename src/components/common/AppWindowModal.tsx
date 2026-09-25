import React, { useState, useEffect } from 'react';
import {
  X,
  Minus,
  Maximize2,
  Minimize2,
  ExternalLink,
} from 'lucide-react';

export interface AppWindowModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  headerClassName?: string;
  defaultMaximized?: boolean;
  size?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  zIndex?: string;
  minimizedTitle?: string;
  onMinimizeChange?: (isMinimized: boolean) => void;
}

export const AppWindowModal: React.FC<AppWindowModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: IconComponent,
  badge,
  headerActions,
  headerClassName,
  defaultMaximized = false,
  size = 'xl',
  children,
  footer,
  zIndex = 'z-50',
  minimizedTitle,
  onMinimizeChange,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(defaultMaximized);

  // Reset minimized state when opened
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Handle minimize state change callback
  const handleMinimize = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    if (onMinimizeChange) onMinimizeChange(next);
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (isMinimized) {
      setIsMinimized(false);
      if (onMinimizeChange) onMinimizeChange(false);
    }
  };

  if (!isOpen) return null;

  // Determine size classes when not maximized
  const getSizeClass = () => {
    switch (size) {
      case 'md':
        return 'w-[92vw] max-w-3xl h-[85vh] max-h-[88vh]';
      case 'lg':
        return 'w-[94vw] max-w-5xl h-[88vh] max-h-[92vh]';
      case 'xl':
        return 'w-[96vw] max-w-6xl xl:max-w-7xl h-[92vh] max-h-[95vh]';
      case '2xl':
        return 'w-[98vw] max-w-7xl 2xl:max-w-[1500px] h-[93vh] max-h-[96vh]';
      case 'full':
        return 'w-screen h-screen max-w-none max-h-none rounded-none';
      default:
        return 'w-[96vw] max-w-6xl xl:max-w-7xl h-[92vh] max-h-[95vh]';
    }
  };

    // Helper to safely render Icon whether it's a React element or component (function/forwardRef)
  const renderIcon = (className: string = 'w-5 h-5') => {
    if (!IconComponent) return null;
    if (React.isValidElement(IconComponent)) {
      return IconComponent;
    }
    try {
      const Component = IconComponent as React.ComponentType<{ className?: string }>;
      return <Component className={className} />;
    } catch {
      return <ExternalLink className={className} />;
    }
  };

  // If Minimized: Show docked floating pill in the bottom-right corner
  if (isMinimized) {
    return (
      <div
        style={{ borderLeft: '4px solid var(--theme-primary)' }}
        className="fixed bottom-4 right-4 z-[999] bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 p-3 pr-4 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200 cursor-pointer hover:border-slate-500 group transition-all"
        onClick={handleMinimize}
        title="Click to Restore Working Window"
      >
        <div className="relative flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute -top-1 -left-1" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -top-1 -left-1" />
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 group-hover:text-amber-300">
            {renderIcon('w-4 h-4') || <ExternalLink className="w-4 h-4" />}
          </div>
        </div>

        <div className="flex flex-col min-w-[140px] max-w-[280px]">
          <div className="text-xs font-black text-slate-100 truncate">
            {minimizedTitle || (typeof title === 'string' ? title : 'Active Working Window')}
          </div>
          <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <span>Window Minimized</span>
            <span className="text-slate-400 font-normal">• Click to restore</span>
          </div>
        </div>

        {badge && <div className="shrink-0">{badge}</div>}

        <div className="flex items-center gap-1 ml-2 shrink-0 border-l border-slate-700 pl-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleMinimize();
            }}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
            title="Restore Window"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
            title="Close Window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 ${zIndex} bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150`}
    >
      <div
        style={{ borderTop: '4px solid var(--theme-primary)' }}
        className={`bg-white border border-slate-200 flex flex-col shadow-2xl transition-all duration-150 overflow-hidden ${
          isMaximized
            ? 'fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none z-50'
            : `${getSizeClass()} rounded-2xl my-auto`
        }`}
      >
        {/* Universal Standardized Window Top Bar */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-slate-200 shrink-0 select-none ${
            headerClassName || 'bg-slate-50/90'
          }`}
        >
          {/* Left: Window Icon, Title, Subtitle, and Badges */}
          <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
            {IconComponent && (
              <div className="shrink-0 flex items-center justify-center">
                {React.isValidElement(IconComponent) ? (
                  IconComponent
                ) : (
                  <div
                    className="p-2 rounded-xl border shadow-3xs"
                    style={{
                      backgroundColor: 'var(--theme-primary-50)',
                      borderColor: 'var(--theme-primary-light)',
                      color: 'var(--theme-primary-dark)',
                    }}
                  >
                    {renderIcon('w-5 h-5')}
                  </div>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-slate-900 truncate tracking-tight">
                  {title}
                </h2>
                {badge && <div className="shrink-0">{badge}</div>}
              </div>
              {subtitle && (
                <div className="text-[11px] sm:text-xs text-slate-500 font-medium truncate mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Right: Custom Action Buttons + Standard Window Controls (Minimize, Maximize/Restore, Close) */}
          <div className="flex items-center gap-2 shrink-0">
            {headerActions && (
              <div className="flex items-center gap-1.5 mr-1 border-r border-slate-300/80 pr-2">
                {headerActions}
              </div>
            )}

            {/* Standard Window Control Trio */}
            <div className="flex items-center gap-1 bg-white/80 p-1 rounded-xl border border-slate-200 shadow-3xs">
              {/* 1. Minimize Button */}
              <button
                type="button"
                onClick={handleMinimize}
                className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                title="Minimize Window (Save to dock)"
                aria-label="Minimize Window"
              >
                <Minus className="w-4 h-4" />
              </button>

              {/* 2. Maximize / Fullscreen Toggle Button */}
              <button
                type="button"
                onClick={handleMaximize}
                className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                title={isMaximized ? 'Restore Window Size' : 'Maximize to Full Screen'}
                aria-label={isMaximized ? 'Restore Window Size' : 'Maximize to Full Screen'}
              >
                {isMaximized ? (
                  <Minimize2 className="w-4 h-4 text-amber-700" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              {/* 3. Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-rose-500 hover:text-white text-slate-500 rounded-lg transition cursor-pointer"
                title="Close Window"
                aria-label="Close Window"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Window Content Body */}
        <div className="flex-1 overflow-y-auto flex flex-col">{children}</div>

        {/* Optional Sticky Footer */}
        {footer && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/90 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
