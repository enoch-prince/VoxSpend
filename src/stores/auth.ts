// ============================================
// Auth Store — @convex-dev/auth + Password provider
// ============================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { convex, api, setConvexToken, clearConvexToken } from '@/services/convexClient';

const TOKEN_KEY = 'voxspend-auth-token';
const REFRESH_KEY = 'voxspend-auth-refresh';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const isInitialized = ref(false);

  const isAuthenticated = computed(() => !!token.value);

  // Load token from localStorage and activate it on the Convex client.
  function initialize() {
    const stored = localStorage.getItem(TOKEN_KEY);
    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    if (stored) {
      token.value = stored;
      refreshToken.value = storedRefresh;
      setConvexToken(stored);
    }
    isInitialized.value = true;
  }

  function _storeTokens(t: string, rt: string | null) {
    token.value = t;
    refreshToken.value = rt;
    localStorage.setItem(TOKEN_KEY, t);
    if (rt) localStorage.setItem(REFRESH_KEY, rt);
    setConvexToken(t);
  }

  function _clearTokens() {
    token.value = null;
    refreshToken.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    clearConvexToken();
  }

  async function signIn(email: string, password: string) {
    const result = await convex.action(api.auth.signIn, {
      provider: 'password',
      params: { email, password, flow: 'signIn' },
    });
    const tokens = (result as { tokens?: { token: string; refreshToken: string } }).tokens;
    if (!tokens?.token) throw new Error('Sign in failed — no token returned.');
    _storeTokens(tokens.token, tokens.refreshToken ?? null);
  }

  async function signUp(email: string, password: string) {
    const result = await convex.action(api.auth.signIn, {
      provider: 'password',
      params: { email, password, flow: 'signUp' },
    });
    const tokens = (result as { tokens?: { token: string; refreshToken: string } }).tokens;
    if (!tokens?.token) throw new Error('Sign up failed — no token returned.');
    _storeTokens(tokens.token, tokens.refreshToken ?? null);
  }

  async function signOut() {
    try {
      await convex.action(api.auth.signOut);
    } finally {
      _clearTokens();
    }
  }

  return {
    token,
    isAuthenticated,
    isInitialized,
    initialize,
    signIn,
    signUp,
    signOut,
  };
});