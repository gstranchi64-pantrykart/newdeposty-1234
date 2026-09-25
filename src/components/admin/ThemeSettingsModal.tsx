import React from 'react';
import { AppWindowModal } from '../common/AppWindowModal';
import { ThemeSelectorPanel } from './ThemeSelectorPanel';
import { Palette, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({ isOpen, onClose }) => {
  const { currentTheme } = useTheme();

  return (
    <AppWindowModal
      isOpen={isOpen}
      onClose={onClose}
      title="10 Ready-Made ERP Themes & Colors"
      subtitle="Click any theme to instantly apply to all buttons, header, footer and modal windows across Admin, Customer & Auditor"
      icon={Palette}
      size="2xl"
      badge={
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
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" style={{ color: currentTheme.primary }} />
            <span>Theme applies in real-time across the entire ERP platform</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold btn-theme cursor-pointer"
          >
            Done &amp; Close
          </button>
        </div>
      }
    >
      <div className="p-4 sm:p-6 overflow-y-auto max-h-[75vh]">
        <ThemeSelectorPanel />
      </div>
    </AppWindowModal>
  );
};
