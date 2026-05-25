// ============================================
// VoxSpend Local Database (Dexie / IndexedDB)
// ============================================
//
// Schema versions:
//   v1 — original local-only schema (expenses, categories, momoAccounts, syncQueue)
//   v2 — added pendingVoiceNotes table
//   v3 — local-first sync layer: every replicated row carries userId/serverId/
//        synced/clientId. syncQueue rewritten with userId scoping, action/
//        payload/attempt tracking, and an index for FIFO drain.

import Dexie, { type Table } from 'dexie';
import type { Expense, Category, MomoAccount, SyncQueueItem, PendingVoiceNote } from '@/types';

export class VoxSpendDB extends Dexie {
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;
  momoAccounts!: Table<MomoAccount, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  pendingVoiceNotes!: Table<PendingVoiceNote, number>;

  constructor() {
    super('VoxSpendDB');

    this.version(1).stores({
      expenses: 'id, date, category, type, momoAccountId, synced, createdAt',
      categories: 'id, name, isCustom',
      momoAccounts: 'id, provider, phoneNumber',
      syncQueue: '++id, table, entityId, action, createdAt',
    });

    this.version(2).stores({
      pendingVoiceNotes: '++id, createdAt',
    });

    // v3 — sync-layer fields on every replicated table.
    // Compound indexes ([userId+date], etc.) let stores scope reads cheaply.
    this.version(3)
      .stores({
        expenses: 'id, userId, [userId+date], [userId+synced], serverId, clientId, date, category, type, momoAccountId, synced, createdAt',
        categories: 'id, userId, [userId+name], serverId, clientId, name, isCustom',
        momoAccounts: 'id, userId, [userId+provider], serverId, clientId, provider, phoneNumber',
        syncQueue: '++id, userId, [userId+createdAt], table, entityId, clientId, createdAt',
      })
      .upgrade(async (tx) => {
        // Existing rows pre-date the sync layer. Mark them as unsynced and
        // leave userId empty — the App.vue startup flow attributes them to
        // the first user that signs in (legacy data attribution).
        const stamp = (row: Record<string, unknown>) => {
          if (!('userId' in row)) row.userId = '';
          if (!('synced' in row)) row.synced = false;
          if (!('clientId' in row)) row.clientId = generateClientId();
        };
        await tx.table('expenses').toCollection().modify(stamp);
        await tx.table('categories').toCollection().modify(stamp);
        await tx.table('momoAccounts').toCollection().modify(stamp);
        // syncQueue from v1/v2 used a different shape — drop it; the new
        // engine will re-enqueue anything that needs sending.
        await tx.table('syncQueue').clear();
      });
  }
}

export const db = new VoxSpendDB();

/**
 * Generate a unique ID for local entities. Stable across syncs — never
 * replaced with the Convex `_id` (the latter is stored in `serverId`).
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Dedup token for a single mutation. Sent to Convex as `clientId` so a
 * retry after a lost ACK doesn't create a duplicate row.
 */
export function generateClientId(): string {
  // crypto.randomUUID is available in all modern browsers; fall back for
  // older environments (mainly old WebViews).
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get the current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}
