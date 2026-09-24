// ============================================
// Sync Engine — Dexie → Convex write-behind queue
// ============================================

import { ref } from 'vue';
import { db } from './database';
import { convex, api } from './convexClient';
import type { SyncQueueItem, SyncTable } from '@/types';
import type { Id } from '../../convex/_generated/dataModel';

export const pendingCount = ref(0);
export const pendingByTable = ref<Record<string, number>>({ expenses: 0, categories: 0, momoAccounts: 0 });
export const isDraining = ref(false);
export const hasErrors = ref(false);
export const needsReauth = ref(false);

const BACKOFF_SCHEDULE_MS = [1_000, 5_000, 30_000, 60_000, 300_000];
let inMemoryDraining = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let currentUserId: string | null = null;
let currentAccountId: string | null = null;
let refreshTokenCallback: (() => Promise<boolean>) | null = null;

export function setRefreshCallback(callback: () => Promise<boolean>): void {
  refreshTokenCallback = callback;
}

export function setSyncUser(userId: string | null): void {
  currentUserId = userId;
  if (!userId) currentAccountId = null;
  void refreshPendingCount();
}

export function setSyncAccount(accountId: string | null): void {
  currentAccountId = accountId;
  void refreshPendingCount();
}

function currentQueueRange() {
  if (!currentUserId || !currentAccountId) return null;
  return {
    lower: [currentUserId, currentAccountId, ''] as [string, string, string],
    upper: [currentUserId, currentAccountId, '\uffff'] as [string, string, string],
  };
}

export async function refreshPendingCount(): Promise<void> {
  const range = currentQueueRange();
  if (!range) {
    pendingCount.value = 0;
    pendingByTable.value = { expenses: 0, categories: 0, momoAccounts: 0 };
    hasErrors.value = false;
    return;
  }

  const items = await db.syncQueue
    .where('[userId+accountId+createdAt]')
    .between(range.lower, range.upper)
    .toArray();
  pendingCount.value = items.length;
  const byTable: Record<string, number> = { expenses: 0, categories: 0, momoAccounts: 0 };
  let errored = false;
  for (const item of items) {
    byTable[item.table] = (byTable[item.table] ?? 0) + 1;
    if (item.lastError && item.attemptCount >= BACKOFF_SCHEDULE_MS.length) errored = true;
  }
  pendingByTable.value = byTable;
  hasErrors.value = errored;
}

export async function enqueue(
  item: Omit<SyncQueueItem, 'id' | 'attemptCount' | 'createdAt'>,
): Promise<void> {
  await db.syncQueue.add({
    ...item,
    attemptCount: 0,
    createdAt: new Date().toISOString(),
  });
  await refreshPendingCount();
  void drain();
}

export async function drain(): Promise<void> {
  if (!currentUserId || !currentAccountId || !navigator.onLine || inMemoryDraining) return;

  const userId = currentUserId;
  const accountId = currentAccountId;
  const run = async () => {
    inMemoryDraining = true;
    isDraining.value = true;
    try {
      let processed = 0;
      while (processed < 100) {
        const next = await pickNextReady(userId, accountId);
        if (!next) break;
        const handled = await processItem(next);
        processed += 1;
        if (!handled) break;
      }
    } finally {
      inMemoryDraining = false;
      isDraining.value = false;
      await refreshPendingCount();
    }
  };

  if ('locks' in navigator && navigator.locks?.request) {
    try {
      await navigator.locks.request(`voxspend-sync-${userId}-${accountId}`, { mode: 'exclusive' }, run);
    } catch {
      await run();
    }
  } else {
    await run();
  }
}

async function pickNextReady(userId: string, accountId: string): Promise<SyncQueueItem | undefined> {
  const items = await db.syncQueue
    .where('[userId+accountId+createdAt]')
    .between([userId, accountId, ''], [userId, accountId, '\uffff'])
    .sortBy('createdAt');
  return items.find((item) => (item.nextAttemptAt ?? 0) <= Date.now());
}

async function processItem(item: SyncQueueItem): Promise<boolean> {
  try {
    const serverId = await runMutation(item);
    if (item.action === 'create' && serverId) {
      await db.table(item.table).update(item.entityId, { serverId, synced: true });
    } else if (item.action === 'update') {
      await db.table(item.table).update(item.entityId, { synced: true });
    }
    if (item.id !== undefined) await db.syncQueue.delete(item.id);
    return true;
  } catch (err) {
    return handleFailure(item, err);
  }
}

async function runMutation(item: SyncQueueItem): Promise<string | undefined> {
  const { table, action, clientId, accountId, payload } = item;
  const scopedPayload = accountId ? { accountId, ...payload } : payload;

  if (table === 'expenses') {
    if (action === 'create') return (await convex.mutation(api.expenses.upsert, { clientId, ...scopedPayload } as never)) as string;
    if (action === 'update') await convex.mutation(api.expenses.update, { clientId, ...scopedPayload } as never);
    if (action === 'delete') await convex.mutation(api.expenses.remove, { clientId, ...(accountId ? { accountId } : {}) } as never);
    return;
  }
  if (table === 'categories') {
    if (action === 'create') return (await convex.mutation(api.categories.upsert, { clientId, ...scopedPayload } as never)) as string;
    if (action === 'update') await convex.mutation(api.categories.update, { clientId, ...scopedPayload } as never);
    if (action === 'delete') await convex.mutation(api.categories.remove, { clientId, ...(accountId ? { accountId } : {}) } as never);
    return;
  }
  if (table === 'momoAccounts') {
    if (action === 'create') return (await convex.mutation(api.momoAccounts.upsert, { clientId, ...scopedPayload } as never)) as string;
    if (action === 'update') await convex.mutation(api.momoAccounts.update, { clientId, ...scopedPayload } as never);
    if (action === 'delete') await convex.mutation(api.momoAccounts.remove, { clientId, ...(accountId ? { accountId } : {}) } as never);
    return;
  }
  throw new Error(`Unknown sync table: ${table as string}`);
}

async function handleFailure(item: SyncQueueItem, err: unknown): Promise<boolean> {
  const message = err instanceof Error ? err.message : String(err);
  const isAuth = /Unauthorized|not authenticated|missing.*identity|401/i.test(message);
  const isNetwork = /network|failed to fetch|fetch.*failed|offline|timeout/i.test(message);

  if (isAuth) {
    if (refreshTokenCallback) {
      try {
        if (await refreshTokenCallback()) return true;
      } catch {
        // Fall through to the re-auth state.
      }
    }
    needsReauth.value = true;
    if (item.id !== undefined) {
      await db.syncQueue.update(item.id, {
        attemptCount: item.attemptCount + 1,
        lastError: message,
      });
    }
    return false;
  }

  const lastBackoff = BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
  const nextAttempt =
    isNetwork || item.attemptCount < BACKOFF_SCHEDULE_MS.length
      ? Date.now() + (BACKOFF_SCHEDULE_MS[item.attemptCount] ?? lastBackoff)
      : Date.now() + 24 * 60 * 60 * 1000;
  if (item.id !== undefined) {
    await db.syncQueue.update(item.id, {
      attemptCount: item.attemptCount + 1,
      lastError: message,
      nextAttemptAt: nextAttempt,
    });
  }
  return !isNetwork;
}

export function startSyncListeners(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void drain());
  if (!heartbeat) heartbeat = setInterval(() => void drain(), 60_000);
}

export function stopSyncListeners(): void {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

export function clearReauthFlag(): void {
  needsReauth.value = false;
}

export async function retryFailed(): Promise<void> {
  const range = currentQueueRange();
  if (!range) return;
  const items = await db.syncQueue
    .where('[userId+accountId+createdAt]')
    .between(range.lower, range.upper)
    .filter((item) => !!item.lastError && item.attemptCount >= BACKOFF_SCHEDULE_MS.length)
    .toArray();
  await Promise.all(
    items.map((item) =>
      item.id !== undefined
        ? db.syncQueue.update(item.id, { attemptCount: 0, lastError: undefined, nextAttemptAt: 0 })
        : Promise.resolve(),
    ),
  );
  await refreshPendingCount();
  void drain();
}

export type ServerId<T extends 'expenses' | 'categories' | 'momoAccounts'> = Id<T>;
export type { SyncTable };
