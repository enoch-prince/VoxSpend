// ============================================
// User Profile Store
// ============================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserProfile } from '@/types'
import { encrypt, decrypt } from '@/utils/encryption'

const STORAGE_KEY = 'voxspend-user'

export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile>(loadProfile())
  
  // Migration: If we loaded a plain-text key, encrypt it immediately
  if (profile.value.groqApiKey && profile.value.groqApiKey.startsWith('gsk_')) {
    saveProfile()
  }

  function loadProfile(): UserProfile {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as UserProfile
        // Decrypt the API key if it exists
        if (data.groqApiKey) {
          data.groqApiKey = decrypt(data.groqApiKey)
        }
        return data
      }
    } catch { /* ignore */ }

    return {
      name: '',
      avatarInitials: '',
      currency: 'GHS',
      groqApiKey: '',
      onboardingComplete: false,
      notificationsEnabled: false,
      createdAt: new Date().toISOString()
    }
  }

  function saveProfile() {
    const dataToStore = { ...profile.value }
    // Encrypt the API key before storing
    if (dataToStore.groqApiKey) {
      dataToStore.groqApiKey = encrypt(dataToStore.groqApiKey)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore))
  }

  const isSetup = computed(() => profile.value.onboardingComplete)
  const hasApiKey = computed(() => !!profile.value.groqApiKey)
  const initials = computed(() => {
    if (!profile.value.name) return '?'
    return profile.value.name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  })

  function updateProfile(updates: Partial<UserProfile>) {
    profile.value = { ...profile.value, ...updates }
    if (updates.name) {
      profile.value.avatarInitials = updates.name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    }
    saveProfile()
  }

  function completeOnboarding(name: string, apiKey: string) {
    updateProfile({
      name,
      groqApiKey: apiKey,
      onboardingComplete: true
    })
  }

  function setApiKey(key: string) {
    updateProfile({ groqApiKey: key })
  }

  return {
    profile,
    isSetup,
    hasApiKey,
    initials,
    updateProfile,
    completeOnboarding,
    setApiKey
  }
})
