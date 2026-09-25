export interface ThemePalette {
  id: string;
  name: string;
  category: 'YELLOW' | 'BLUE' | 'GREEN' | 'PARROT' | 'ACCENT';
  categoryLabel: string;
  description: string;
  primary: string;
  primaryHover: string;
  primaryDark: string;
  primaryLight: string;
  primary50: string;
  textOnPrimary: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  ring: string;
  gradient: string;
  previewColors: [string, string, string, string];

  // Themed Header, Submenu & Dark Surface properties:
  headerBg: string;
  headerBorder: string;
  headerText: string;
  menuBg: string;
  menuBorder: string;
  menuHover: string;
  menuItemText: string;
  menuItemSubtext: string;
  navActiveBg: string;
  navActiveText: string;
  surfaceDark: string;
  surfaceDarkBorder: string;
  footerBg: string;
  footerBorder: string;
}

export const APP_THEMES: ThemePalette[] = [
  // 1. YELLOW TYPE 1 (Default Active Theme)
  {
    id: 'yellow-amber',
    name: 'Royal Amber Gold (Yellow Type 1)',
    category: 'YELLOW',
    categoryLabel: 'Yellow (2 Themes)',
    description: 'Warm golden amber yellow with deep contrast, premium royal feel and ultra-sharp legibility.',
    primary: '#eab308',
    primaryHover: '#ca8a04',
    primaryDark: '#a16207',
    primaryLight: '#fef9c3',
    primary50: '#fefce8',
    textOnPrimary: '#0f172a',
    badgeBg: '#fef08a',
    badgeText: '#854d0e',
    badgeBorder: '#facc15',
    ring: '#eab308',
    gradient: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
    previewColors: ['#eab308', '#ca8a04', '#92400e', '#78350f'],

    headerBg: '#78350f',
    headerBorder: '#ca8a04',
    headerText: '#ffffff',
    menuBg: '#92400e',
    menuBorder: '#facc15',
    menuHover: '#b45309',
    menuItemText: '#fef9c3',
    menuItemSubtext: '#fde047',
    navActiveBg: '#facc15',
    navActiveText: '#78350f',
    surfaceDark: '#78350f',
    surfaceDarkBorder: '#ca8a04',
    footerBg: '#78350f',
    footerBorder: '#facc15',
  },

  // 2. YELLOW TYPE 2
  {
    id: 'yellow-lemon',
    name: 'Vibrant Electric Lemon (Yellow Type 2)',
    category: 'YELLOW',
    categoryLabel: 'Yellow (2 Themes)',
    description: 'Bright sunshine lemon yellow with high-energy vibrancy and prominent modern accents.',
    primary: '#facc15',
    primaryHover: '#eab308',
    primaryDark: '#ca8a04',
    primaryLight: '#fef08a',
    primary50: '#fef9c3',
    textOnPrimary: '#020617',
    badgeBg: '#fef9c3',
    badgeText: '#713f12',
    badgeBorder: '#facc15',
    ring: '#facc15',
    gradient: 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
    previewColors: ['#facc15', '#eab308', '#854d0e', '#713f12'],

    headerBg: '#713f12',
    headerBorder: '#eab308',
    headerText: '#ffffff',
    menuBg: '#854d0e',
    menuBorder: '#fde047',
    menuHover: '#a16207',
    menuItemText: '#fefce8',
    menuItemSubtext: '#fef08a',
    navActiveBg: '#fde047',
    navActiveText: '#713f12',
    surfaceDark: '#713f12',
    surfaceDarkBorder: '#eab308',
    footerBg: '#713f12',
    footerBorder: '#facc15',
  },

  // 3. BLUE TYPE 1
  {
    id: 'blue-ocean',
    name: 'Royal Ocean Sapphire (Blue Type 1)',
    category: 'BLUE',
    categoryLabel: 'Blue (2 Themes)',
    description: 'Deep royal ocean blue inspired by modern enterprise ERPs with crisp white contrast.',
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryDark: '#1e40af',
    primaryLight: '#dbeafe',
    primary50: '#eff6ff',
    textOnPrimary: '#ffffff',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    badgeBorder: '#93c5fd',
    ring: '#2563eb',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    previewColors: ['#2563eb', '#1d4ed8', '#1d4ed8', '#1e3a8a'],

    headerBg: '#1e3a8a',
    headerBorder: '#3b82f6',
    headerText: '#ffffff',
    menuBg: '#1d4ed8',
    menuBorder: '#60a5fa',
    menuHover: '#1e40af',
    menuItemText: '#eff6ff',
    menuItemSubtext: '#bfdbfe',
    navActiveBg: '#ffffff',
    navActiveText: '#1d4ed8',
    surfaceDark: '#1e3a8a',
    surfaceDarkBorder: '#3b82f6',
    footerBg: '#1e3a8a',
    footerBorder: '#60a5fa',
  },

  // 4. BLUE TYPE 2
  {
    id: 'blue-sky',
    name: 'Sky Azure Indigo (Blue Type 2)',
    category: 'BLUE',
    categoryLabel: 'Blue (2 Themes)',
    description: 'Vibrant sky azure blue with smooth cyan-indigo undertones for a fresh digital grocery feel.',
    primary: '#0284c7',
    primaryHover: '#0369a1',
    primaryDark: '#075985',
    primaryLight: '#e0f2fe',
    primary50: '#f0f9ff',
    textOnPrimary: '#ffffff',
    badgeBg: '#e0f2fe',
    badgeText: '#0369a1',
    badgeBorder: '#7dd3fc',
    ring: '#0284c7',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
    previewColors: ['#0284c7', '#0369a1', '#0369a1', '#075985'],

    headerBg: '#075985',
    headerBorder: '#38bdf8',
    headerText: '#ffffff',
    menuBg: '#0369a1',
    menuBorder: '#7dd3fc',
    menuHover: '#0284c7',
    menuItemText: '#f0f9ff',
    menuItemSubtext: '#bae6fd',
    navActiveBg: '#ffffff',
    navActiveText: '#0369a1',
    surfaceDark: '#075985',
    surfaceDarkBorder: '#38bdf8',
    footerBg: '#075985',
    footerBorder: '#38bdf8',
  },

  // 5. GREEN TYPE 1
  {
    id: 'green-emerald',
    name: 'Deep Emerald Forest (Green Type 1)',
    category: 'GREEN',
    categoryLabel: 'Green (2 Themes)',
    description: 'Rich organic forest emerald green, reflecting agriculture, fresh harvests and natural pantry stock.',
    primary: '#059669',
    primaryHover: '#047857',
    primaryDark: '#065f46',
    primaryLight: '#d1fae5',
    primary50: '#ecfdf5',
    textOnPrimary: '#ffffff',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
    badgeBorder: '#6ee7b7',
    ring: '#059669',
    gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    previewColors: ['#059669', '#047857', '#065f46', '#064e3b'],

    headerBg: '#064e3b',
    headerBorder: '#10b981',
    headerText: '#ffffff',
    menuBg: '#065f46',
    menuBorder: '#34d399',
    menuHover: '#047857',
    menuItemText: '#ecfdf5',
    menuItemSubtext: '#a7f3d0',
    navActiveBg: '#ffffff',
    navActiveText: '#065f46',
    surfaceDark: '#064e3b',
    surfaceDarkBorder: '#10b981',
    footerBg: '#064e3b',
    footerBorder: '#34d399',
  },

  // 6. GREEN TYPE 2
  {
    id: 'green-mint',
    name: 'Fresh Mint Jade (Green Type 2)',
    category: 'GREEN',
    categoryLabel: 'Green (2 Themes)',
    description: 'Bright crisp mint jade green, giving an airy, luminous and clean interface experience.',
    primary: '#10b981',
    primaryHover: '#059669',
    primaryDark: '#047857',
    primaryLight: '#a7f3d0',
    primary50: '#ecfdf5',
    textOnPrimary: '#ffffff',
    badgeBg: '#ecfdf5',
    badgeText: '#047857',
    badgeBorder: '#a7f3d0',
    ring: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    previewColors: ['#10b981', '#059669', '#059669', '#047857'],

    headerBg: '#047857',
    headerBorder: '#6ee7b7',
    headerText: '#ffffff',
    menuBg: '#059669',
    menuBorder: '#a7f3d0',
    menuHover: '#10b981',
    menuItemText: '#ffffff',
    menuItemSubtext: '#d1fae5',
    navActiveBg: '#ffffff',
    navActiveText: '#047857',
    surfaceDark: '#047857',
    surfaceDarkBorder: '#6ee7b7',
    footerBg: '#047857',
    footerBorder: '#6ee7b7',
  },

  // 7. PARROT COLOR TYPE 1
  {
    id: 'parrot-lime',
    name: 'Bright Parrot Lime (Parrot Type 1)',
    category: 'PARROT',
    categoryLabel: 'Parrot Color (2 Themes)',
    description: 'Classic tropical parrot green (lime green) with high contrast dark text and sharp visibility.',
    primary: '#84cc16',
    primaryHover: '#65a30d',
    primaryDark: '#4d7c0f',
    primaryLight: '#ecfccb',
    primary50: '#f7fee7',
    textOnPrimary: '#142502',
    badgeBg: '#ecfccb',
    badgeText: '#3f6212',
    badgeBorder: '#bef264',
    ring: '#84cc16',
    gradient: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
    previewColors: ['#84cc16', '#65a30d', '#4d7c0f', '#3f6212'],

    headerBg: '#3f6212',
    headerBorder: '#a3e635',
    headerText: '#ffffff',
    menuBg: '#4d7c0f',
    menuBorder: '#bef264',
    menuHover: '#65a30d',
    menuItemText: '#f7fee7',
    menuItemSubtext: '#d9f99d',
    navActiveBg: '#bef264',
    navActiveText: '#365314',
    surfaceDark: '#3f6212',
    surfaceDarkBorder: '#84cc16',
    footerBg: '#3f6212',
    footerBorder: '#a3e635',
  },

  // 8. PARROT COLOR TYPE 2
  {
    id: 'parrot-neon',
    name: 'Tropical Neon Chartreuse (Parrot Type 2)',
    category: 'PARROT',
    categoryLabel: 'Parrot Color (2 Themes)',
    description: 'Electrifying neon parrot chartreuse with striking brightness and ultra-modern aesthetic.',
    primary: '#a3e635',
    primaryHover: '#84cc16',
    primaryDark: '#65a30d',
    primaryLight: '#d9f99d',
    primary50: '#f7fee7',
    textOnPrimary: '#1a2e05',
    badgeBg: '#f7fee7',
    badgeText: '#365314',
    badgeBorder: '#a3e635',
    ring: '#a3e635',
    gradient: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
    previewColors: ['#a3e635', '#84cc16', '#4d7c0f', '#365314'],

    headerBg: '#365314',
    headerBorder: '#bef264',
    headerText: '#ffffff',
    menuBg: '#4d7c0f',
    menuBorder: '#d9f99d',
    menuHover: '#65a30d',
    menuItemText: '#f7fee7',
    menuItemSubtext: '#bef264',
    navActiveBg: '#d9f99d',
    navActiveText: '#1a2e05',
    surfaceDark: '#365314',
    surfaceDarkBorder: '#a3e635',
    footerBg: '#365314',
    footerBorder: '#bef264',
  },

  // 9. SUNSET CORAL ORANGE
  {
    id: 'sunset-coral',
    name: 'Sunset Coral Orange',
    category: 'ACCENT',
    categoryLabel: 'Special Accents (2 Themes)',
    description: 'Vibrant sunset coral orange radiating warmth, rapid actions and high focus attention.',
    primary: '#f97316',
    primaryHover: '#ea580c',
    primaryDark: '#c2410c',
    primaryLight: '#ffedd5',
    primary50: '#fff7ed',
    textOnPrimary: '#ffffff',
    badgeBg: '#ffedd5',
    badgeText: '#9a3412',
    badgeBorder: '#fed7aa',
    ring: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    previewColors: ['#f97316', '#ea580c', '#c2410c', '#9a3412'],

    headerBg: '#9a3412',
    headerBorder: '#fb923c',
    headerText: '#ffffff',
    menuBg: '#c2410c',
    menuBorder: '#fed7aa',
    menuHover: '#ea580c',
    menuItemText: '#fff7ed',
    menuItemSubtext: '#ffedd5',
    navActiveBg: '#ffffff',
    navActiveText: '#9a3412',
    surfaceDark: '#9a3412',
    surfaceDarkBorder: '#f97316',
    footerBg: '#9a3412',
    footerBorder: '#fb923c',
  },

  // 10. ROYAL AMETHYST VIOLET
  {
    id: 'royal-purple',
    name: 'Royal Amethyst Violet',
    category: 'ACCENT',
    categoryLabel: 'Special Accents (2 Themes)',
    description: 'Deep royal amethyst purple for luxury grocery, high credit limits and executive portal styling.',
    primary: '#8b5cf6',
    primaryHover: '#7c3aed',
    primaryDark: '#6d28d9',
    primaryLight: '#ede9fe',
    primary50: '#f5f3ff',
    textOnPrimary: '#ffffff',
    badgeBg: '#ede9fe',
    badgeText: '#5b21b6',
    badgeBorder: '#ddd6fe',
    ring: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    previewColors: ['#8b5cf6', '#7c3aed', '#6b21a8', '#581c87'],

    headerBg: '#581c87',
    headerBorder: '#a855f7',
    headerText: '#ffffff',
    menuBg: '#6b21a8',
    menuBorder: '#c084fc',
    menuHover: '#7e22ce',
    menuItemText: '#f5f3ff',
    menuItemSubtext: '#e9d5ff',
    navActiveBg: '#ffffff',
    navActiveText: '#581c87',
    surfaceDark: '#581c87',
    surfaceDarkBorder: '#a855f7',
    footerBg: '#581c87',
    footerBorder: '#a855f7',
  },
];

export const DEFAULT_THEME_ID = 'yellow-amber';

export const getThemeById = (id?: string): ThemePalette => {
  return APP_THEMES.find((t) => t.id === id) || APP_THEMES[0];
};

export const applyThemeToDom = (theme: ThemePalette) => {
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-primary-hover', theme.primaryHover);
  root.style.setProperty('--theme-primary-dark', theme.primaryDark);
  root.style.setProperty('--theme-primary-light', theme.primaryLight);
  root.style.setProperty('--theme-primary-50', theme.primary50);
  root.style.setProperty('--theme-text-on-primary', theme.textOnPrimary);
  root.style.setProperty('--theme-badge-bg', theme.badgeBg);
  root.style.setProperty('--theme-badge-text', theme.badgeText);
  root.style.setProperty('--theme-badge-border', theme.badgeBorder);
  root.style.setProperty('--theme-ring', theme.ring);
  root.style.setProperty('--theme-gradient', theme.gradient);

  // Set the themed header, submenus, dropdowns & dark backgrounds
  root.style.setProperty('--theme-header-bg', theme.headerBg);
  root.style.setProperty('--theme-header-border', theme.headerBorder);
  root.style.setProperty('--theme-header-text', theme.headerText);
  root.style.setProperty('--theme-menu-bg', theme.menuBg);
  root.style.setProperty('--theme-menu-border', theme.menuBorder);
  root.style.setProperty('--theme-menu-hover', theme.menuHover);
  root.style.setProperty('--theme-menu-item-text', theme.menuItemText);
  root.style.setProperty('--theme-menu-item-subtext', theme.menuItemSubtext);
  root.style.setProperty('--theme-nav-active-bg', theme.navActiveBg);
  root.style.setProperty('--theme-nav-active-text', theme.navActiveText);
  root.style.setProperty('--theme-surface-dark', theme.surfaceDark);
  root.style.setProperty('--theme-surface-dark-border', theme.surfaceDarkBorder);
  root.style.setProperty('--theme-footer-bg', theme.footerBg);
  root.style.setProperty('--theme-footer-border', theme.footerBorder);

  // Set meta theme-color for mobile browser headers
  let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = theme.headerBg;
};
