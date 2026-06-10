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
const VERIFIED_KEY = 'voxspend-email-verified';
const EMAIL_KEY = 'voxspend-verification-email';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  // The Convex `users._id` of the signed-in user. Persisted to localStorage
  // so Dexie queries can scope by userId offline (the `me` query needs network).
  const currentUserId = ref<string | null>(null);
  const emailVerified = ref<boolean | null>(null);
  const verificationEmail = ref<string | null>(null);
  // Set to true after requestEmailVerification succeeds; cleared after display
  const justSentCode = ref(false);
  const isInitialized = ref(false);

  const isAuthenticated = computed(() => !!token.value);

  // Load token from localStorage and activate it on the Convex client.
  function initialize() {
    const stored = localStorage.getItem(TOKEN_KEY);
    const storedUserId = localStorage.getItem(USER_ID_KEY);
    const storedVerified = localStorage.getItem(VERIFIED_KEY);
    const storedEmail = localStorage.getItem(EMAIL_KEY);

    if (stored) {
      token.value = stored;
      currentUserId.value = storedUserId;
      emailVerified.value =
        storedVerified === 'true'
          ? true
          : storedVerified === 'false'
          ? false
          : null;
      verificationEmail.value = storedEmail;
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

  function _setVerified(value: boolean) {
    emailVerified.value = value;
    localStorage.setItem(VERIFIED_KEY, String(value));
  }

  function _setVerificationEmail(value: string | null) {
    verificationEmail.value = value;
    if (value) {
      localStorage.setItem(EMAIL_KEY, value);
    } else {
      localStorage.removeItem(EMAIL_KEY);
    }
  }

  function _clearTokens() {
    token.value = null;
    currentUserId.value = null;
    emailVerified.value = null;
    verificationEmail.value = null;
    justSentCode.value = false;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(VERIFIED_KEY);
    localStorage.removeItem(EMAIL_KEY);
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
      await fetchEmailVerificationStatus();
      return id;
    } catch {
      // Offline or transient error — keep whatever we already had cached.
      return currentUserId.value;
    }
  }

  async function fetchEmailVerificationStatus(): Promise<boolean> {
    if (!token.value) return false;
    try {
      const response = (await convex.query(
        'verification.emailVerificationStatus' as any,
      )) as { emailVerified?: boolean; email?: string } | null;

      const verified = response?.emailVerified === true;
      if (verified) {
        _setVerified(true);
      } else if (emailVerified.value === null) {
        _setVerified(false);
      }

      if (response?.email) {
        _setVerificationEmail(response.email);
      }

      return verified;
    } catch {
      return emailVerified.value ?? false;
    }
  }

  async function requestEmailVerification() {
    if (!token.value) throw new Error('Unauthorized');
    await resolveUserId();

    try {
      await convex.action('verification.requestEmailVerification' as any, {});
      _setVerified(false);
      justSentCode.value = true;
      // Pull the now-populated profile email so the verify-email subtitle
      // shows the real address instead of "your email address". Safe: the
      // helper swallows its own errors and never throws.
      await fetchEmailVerificationStatus();
    } catch (err) {
      throw toFriendlyError(
        err,
        "Couldn't send the verification code. Please try again.",
      );
    }
  }

  async function verifyEmailOtp(code: string): Promise<boolean> {
    if (!token.value) throw new Error('Unauthorized');
    await resolveUserId();

    try {
      await convex.action('verification.verifyEmailOtp' as any, { code });
      _setVerified(true);
      return true;
    } catch (err) {
      throw toFriendlyError(err, "Couldn't verify the code. Please try again.");
    }
  }

  async function resendEmailVerification() {
    return requestEmailVerification();
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
    emailVerified,
    verificationEmail,
    justSentCode,
    isAuthenticated,
    isInitialized,
    initialize,
    resolveUserId,
    fetchEmailVerificationStatus,
    requestEmailVerification,
    verifyEmailOtp,
    resendEmailVerification,
    signIn,
    signUp,
    signOut,
  };
});
