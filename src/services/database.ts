// ============================================
// VoxSpend Local Database (Dexie / IndexedDB)
// ============================================

import Dexie, { type Table } from 'dexie'
import type { Expense, Category, MomoAccount, SyncQueueItem, PendingVoiceNote } from '@/types'

export class VoxSpendDB extends Dexie {
  expenses!: Table<Expense, string>
  categories!: Table<Category, string>
  momoAccounts!: Table<MomoAccount, string>
  syncQueue!: Table<SyncQueueItem, number>
  pendingVoiceNotes!: Table<PendingVoiceNote, number>

  constructor() {
    super('VoxSpendDB')

    this.version(1).stores({
      expenses: 'id, date, category, type, momoAccountId, synced, createdAt',
      categories: 'id, name, isCustom',
      momoAccounts: 'id, provider, phoneNumber',
      syncQueue: '++id, table, entityId, action, createdAt'
    })

    this.version(2).stores({
      pendingVoiceNotes: '++id, createdAt'
    })
  }
}


export const db = new VoxSpendDB()

/**
 * Generate a unique ID for local entities
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Get the current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString()
}
