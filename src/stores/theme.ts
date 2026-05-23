// ============================================
// Theme Store
// ============================================

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { ThemeMode } from '@/types';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem('voxspend-theme') as ThemeMode) || 'light');

  const applyTheme = (m: ThemeMode) => {
    let resolved: 'light' | 'dark' = 'light';

    if (m === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolved = m;
    }

    console.log(`Applying theme: ${resolved} (mode: ${m})`);
    document.documentElement.setAttribute('data-theme', resolved);
  };

  const setMode = (newMode: ThemeMode) => {
    console.log(`Setting mode to: ${newMode}`);
    mode.value = newMode;
    localStorage.setItem('voxspend-theme', newMode);
    applyTheme(newMode);
  };

  const toggleMode = () => {
    const next: ThemeMode = mode.value === 'light' ? 'dark' : 'light';
    setMode(next);
  };

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    if (mode.value === 'system') {
      applyTheme('system');
    }
  });

  // Apply on init
  applyTheme(mode.value);

  return { mode, setMode, toggleMode };
});
