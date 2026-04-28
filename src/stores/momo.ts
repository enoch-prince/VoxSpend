// ============================================
// MoMo (Mobile Money) Store
// ============================================

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, generateId, now } from '@/services/database'
import type { MomoAccount, MomoProvider } from '@/types'

export const useMomoStore = defineStore('momo', () => {
  const accounts = ref<MomoAccount[]>([])
  const loading = ref(false)

  async function fetchAccounts() {
    loading.value = true
    try {
      accounts.value = await db.momoAccounts.toArray()
    } finally {
      loading.value = false
    }
  }

  async function linkAccount(provider: MomoProvider, phoneNumber: string, nickname: string) {
    // Check if already linked
    const existing = accounts.value.find(
      a => a.provider === provider && a.phoneNumber === phoneNumber
    )
    if (existing) {
      throw new Error('This account is already linked')
    }

    const account: MomoAccount = {
      id: generateId(),
      provider,
      phoneNumber,
      nickname: nickname || `${provider.toUpperCase()} - ${phoneNumber.slice(-4)}`,
      linkedAt: now()
    }

    await db.momoAccounts.add(account)
    accounts.value.push(account)
    return account
  }

  async function unlinkAccount(id: string) {
    await db.momoAccounts.delete(id)
    accounts.value = accounts.value.filter(a => a.id !== id)
  }

  async function updateAccount(id: string, updates: Partial<MomoAccount>) {
    await db.momoAccounts.update(id, updates)
    const idx = accounts.value.findIndex(a => a.id === id)
    if (idx !== -1) {
      accounts.value[idx] = { ...accounts.value[idx], ...updates }
    }
  }

  function getAccountById(id: string): MomoAccount | undefined {
    return accounts.value.find(a => a.id === id)
  }

  return {
    accounts,
    loading,
    fetchAccounts,
    linkAccount,
    unlinkAccount,
    updateAccount,
    getAccountById
  }
})
