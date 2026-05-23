// ============================================
// User Profile Store
// ============================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserProfile } from '@/types';
import { encrypt, decrypt } from '@/utils/encryption';

const STORAGE_KEY = 'voxspend-user';

export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile>(loadProfileSync());
  // True once the async key decryption completes — guards voice features from running before ready.
  const apiKeyReady = ref(false);
  // Tracks whether an encrypted key exists in storage, so hasApiKey is accurate before init completes.
  const _hasStoredKey = ref(hasEncryptedKeyInStorage());

  initApiKey();

  function loadProfileSync(): UserProfile {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as UserProfile;
        // Leave groqApiKey empty — initApiKey will decrypt and restore it asynchronously.
        data.groqApiKey = '';
        return data;
      }
    } catch {
      /* ignore */
    }
    return defaultProfile();
  }

  function hasEncryptedKeyInStorage(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as UserProfile;
        return !!data.groqApiKey;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  async function initApiKey() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as UserProfile;
        if (data.groqApiKey) {
          const plaintext = await decrypt(data.groqApiKey);
          profile.value.groqApiKey = plaintext;
          // Silently re-encrypt if this was an old XOR-encrypted value (no v2: prefix).
          if (!data.groqApiKey.startsWith('v2:') && plaintext) {
            void saveProfile();
          }
        }
      }
    } catch {
      /* ignore — key stays empty, user can re-enter in Settings */
    } finally {
      _hasStoredKey.value = !!profile.value.groqApiKey;
      apiKeyReady.value = true;
    }
  }

  async function saveProfile() {
    const dataToStore = { ...profile.value };
    if (dataToStore.groqApiKey) {
      dataToStore.groqApiKey = await encrypt(dataToStore.groqApiKey);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
  }

  function defaultProfile(): UserProfile {
    return {
      name: '',
      avatarInitials: '',
      currency: 'GHS',
      groqApiKey: '',
      onboardingComplete: false,
      notificationsEnabled: false,
      createdAt: new Date().toISOString(),
    };
  }

  const isSetup = computed(() => profile.value.onboardingComplete);
  const hasApiKey = computed(() => !!profile.value.groqApiKey || _hasStoredKey.value);
  const initials = computed(() => {
    if (!profile.value.name) return '?';
    return profile.value.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  });

  function updateProfile(updates: Partial<UserProfile>) {
    profile.value = { ...profile.value, ...updates };
    if (updates.name) {
      profile.value.avatarInitials = updates.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    _hasStoredKey.value = !!profile.value.groqApiKey;
    void saveProfile();
  }

  function completeOnboarding(name: string, apiKey: string) {
    updateProfile({
      name,
      groqApiKey: apiKey,
      onboardingComplete: true,
    });
  }

  function setApiKey(key: string) {
    updateProfile({ groqApiKey: key });
  }

  return {
    profile,
    apiKeyReady,
    isSetup,
    hasApiKey,
    initials,
    updateProfile,
    completeOnboarding,
    setApiKey,
  };
});