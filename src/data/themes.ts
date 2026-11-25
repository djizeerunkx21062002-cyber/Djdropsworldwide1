import { ThemeId } from '../types';

export interface StudioThemeOption {
  id: ThemeId;
  name: string;
  tagline: string;
  canvasSwatch: string;
  accentSwatch: string;
  isLight?: boolean;
}

export const STUDIO_THEMES: StudioThemeOption[] = [
  {
    id: 'obsidian',
    name: 'Obsidian Amber',
    tagline: 'Signature dark console & warm gold',
    canvasSwatch: '#0B0D11',
    accentSwatch: '#F59E0B',
  },
  {
    id: 'midnight',
    name: 'Midnight Cyan',
    tagline: 'Deep studio navy & electric cyan',
    canvasSwatch: '#070B14',
    accentSwatch: '#06B6D4',
  },
  {
    id: 'crimson',
    name: 'Crimson Club',
    tagline: 'Carbon booth & ruby stage accent',
    canvasSwatch: '#110A0D',
    accentSwatch: '#F43F5E',
  },
  {
    id: 'emerald',
    name: 'Emerald Mastering',
    tagline: 'Deep pine rack & crisp emerald',
    canvasSwatch: '#08110E',
    accentSwatch: '#10B981',
  },
  {
    id: 'daylight',
    name: 'Daylight Studio',
    tagline: 'High-contrast crisp light workspace',
    canvasSwatch: '#F4F5F7',
    accentSwatch: '#D97706',
    isLight: true,
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'obsidian';
export const THEME_STORAGE_KEY = 'dropvault_studio_theme';

export function getStoredThemeId(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (STUDIO_THEMES.some((t) => t.id === saved)) {
    return saved as ThemeId;
  }
  return DEFAULT_THEME_ID;
}
