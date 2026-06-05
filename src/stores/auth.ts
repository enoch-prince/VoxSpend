// ============================================
// Auth Store — @convex-dev/auth + Password provider
// ============================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { convex, api, setConvexToken, clearConvexToken } from '@/services/convexClient';
import { toFriendlyError } from '@/utils/errors';
import { setSyncUser } from '@/services/syncEngine';

const TOKEN_KEY = 'voxspend-auth-token';
const USER_ID_KEY = 'voxspend-current-user-id';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  // The Convex `users._id` of the signed-in user. Persisted to localStorage
  // so Dexie queries can scope by userId offline (the `me` query needs network).
  const currentUserId = ref<string | null>(null);
  const isInitialized = ref(false);

  const isAuthenticated = computed(() => !!token.value);

  // Load token from localStorage and activate it on the Convex client.
  function initialize() {
    const stored = localStorage.getItem(TOKEN_KEY);
    const storedUserId = localStorage.getItem(USER_ID_KEY);
    if (stored) {
      token.value = stored;
      currentUserId.value = storedUserId;
      setConvexToken(stored);
      setSyncUser(storedUserId);
    }
    isInitialized.value = true;
  }

  function _storeTokens(t: string) {
    token.value = t;
    localStorage.setItem(TOKEN_KEY, t);
    setConvexToken(t);
  }

  function _clearTokens() {
    token.value = null;
    currentUserId.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    clearConvexToken();
    setSyncUser(null);
  }

  /**
   * Fetch the signed-in user's Convex _id and pin it to the sync engine.
   * Call this after sign-in/sign-up and after restoring a token from
   * localStorage on app boot. Safe to call repeatedly.
   */
  async function resolveUserId(): Promise<string | null> {
    if (!token.value) return null;
    try {
      const id = (await convex.query(api.auth.me)) as string | null;
      if (!id) {
        _clearTokens();
        return null;
      }
      currentUserId.value = id;
      localStorage.setItem(USER_ID_KEY, id);
      setSyncUser(id);
      return id;
    } catch {
      // Offline or transient error — keep whatever we already had cached.
      return currentUserId.value;
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const result = await convex.action(api.auth.signIn, {
        provider: 'password',
        params: { email, password, flow: 'signIn' },
      });
      const tokens = (result as { tokens?: { token: string } }).tokens;
      if (!tokens?.token) throw new Error('Sign in failed — no token returned.');
      _storeTokens(tokens.token);
    } catch (err) {
      throw toFriendlyError(err, "Couldn't sign you in. Please try again.");
    }
  }

  async function signUp(email: string, password: string) {
    try {
      const result = await convex.action(api.auth.signIn, {
        provider: 'password',
        params: { email, password, flow: 'signUp' },
      });
      const tokens = (result as { tokens?: { token: string } }).tokens;
      if (!tokens?.token) throw new Error('Sign up failed — no token returned.');
      _storeTokens(tokens.token);
    } catch (err) {
      throw toFriendlyError(err, "Couldn't create your account. Please try again.");
    }
  }

  async function signOut() {
    try {
      await convex.action(api.auth.signOut);
    } catch {
      // Sign-out failures shouldn't block local logout
    } finally {
      _clearTokens();
    }
  }

  return {
    token,
    currentUserId,
    isAuthenticated,
    isInitialized,
    initialize,
    resolveUserId,
    signIn,
    signUp,
    signOut,
  };
});
