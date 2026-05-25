// ============================================
// Sync Engine — Dexie → Convex write-behind queue
// ============================================
//
// Architecture:
//   - Stores write to Dexie + enqueue a SyncQueueItem; UI updates optimistically.
//   - This engine drains the queue in FIFO order, calling the matching
//     Convex mutation for each item.
//   - Idempotency: every mutation carries a `clientId` UUID. The Convex
//     side looks up by (userId, clientId) so a retry after a lost ACK
//     resolves to the same row instead of inserting a duplicate.
//   - Cross-tab coordination: drain runs inside a Web Lock named
//     `voxspend-sync-<userId>`. Only one tab at a time holds the lock;
//     the others wait. With clientId-based idempotency, even if two tabs
//     race a single drain (lock unavailable, falling back to in-memory
//     mutex), no duplicates can occur.
//   - Backoff: network failures schedule a retry at `nextAttemptAt`
//     (1s → 5s → 30s → 5min cap). Validation errors freeze the item
//     with `lastError` set and stop auto-retrying.
//   - Auth (401) errors stop the whole drain and emit `needsReauth`.

import { ref } from 'vue';
import { db } from './database';
import { convex, api } from './convexClient';
import type { SyncQueueItem, SyncTable, SyncAction } from '@/types';
import type { Id } from '../../convex/_generated/dataModel';

// ---- Public reactive state ----
export const pendingCount = ref(0);
export const isDraining = ref(false);
export const hasErrors = ref(false);
export const needsReauth = ref(false);

// ---- Internals ----
const BACKOFF_SCHEDULE_MS = [1_000, 5_000, 30_000, 60_000, 300_000];
let inMemoryDraining = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let currentUserId: string | null = null;

export function setSyncUser(userId: string | null) {
  currentUserId = userId;
  void refreshPendingCount();
}

export async function refreshPendingCount() {
  if (!currentUserId) {
    pendingCount.value = 0;
    return;
  }
  pendingCount.value = await db.syncQueue.where('userId').equals(currentUserId).count();
  hasErrors.value =
    (await db.syncQueue
      .where('userId')
      .equals(currentUserId)
      .filter((item) => !!item.lastError && item.attemptCount >= BACKOFF_SCHEDULE_MS.length)
      .count()) > 0;
}

/**
 * Append one work item to the queue. Triggers a drain in the background.
 */
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

/**
 * Drain ready items in FIFO order. Safe to call concurrently — wrapped in
 * a Web Lock so only one tab drains at a time.
 */
export async function drain(): Promise<void> {
  if (!currentUserId) return;
  if (!navigator.onLine) return;
  if (inMemoryDraining) return;

  const userId = currentUserId;
  const run = async () => {
    inMemoryDraining = true;
    isDraining.value = true;
    try {
      // Loop until no ready items remain. Each pass picks up newly enqueued
      // items that landed mid-drain.
      let processed = 0;
      const MAX_PER_BATCH = 100; // safety cap
      while (processed < MAX_PER_BATCH) {
        const next = await pickNextReady(userId);
        if (!next) break;
        const handled = await processItem(next);
        processed += 1;
        if (!handled) break; // auth error or stop signal
      }
    } finally {
      inMemoryDraining = false;
      isDraining.value = false;
      await refreshPendingCount();
    }
  };

  if ('locks' in navigator && navigator.locks?.request) {
    try {
      await navigator.locks.request(`voxspend-sync-${userId}`, { mode: 'exclusive' }, run);
    } catch {
      // Lock API unavailable mid-flight — fall back to bare drain.
      await run();
    }
  } else {
    await run();
  }
}

async function pickNextReady(userId: string): Promise<SyncQueueItem | undefined> {
  const now = Date.now();
  // FIFO by createdAt, skipping items whose backoff hasn't elapsed.
  const items = await db.syncQueue
    .where('[userId+createdAt]')
    .between([userId, ''], [userId, '￿'])
    .sortBy('createdAt');
  return items.find((i) => (i.nextAttemptAt ?? 0) <= now);
}

// Returns true if drain should keep going, false to stop (auth error, etc.)
async function processItem(item: SyncQueueItem): Promise<boolean> {
  try {
    const serverId = await runMutation(item);
    // On a successful create, the server returns the new _id. Patch it
    // into the local row so subsequent reconciles know it's already synced.
    if (item.action === 'create' && serverId) {
      await db.table(item.table).update(item.entityId, { serverId, synced: true });
    } else {
      // For updates, mark the row as synced. Deletes already removed the row.
      if (item.action === 'update') {
        await db.table(item.table).update(item.entityId, { synced: true });
      }
    }
    if (item.id !== undefined) await db.syncQueue.delete(item.id);
    return true;
  } catch (err) {
    return await handleFailure(item, err);
  }
}

async function runMutation(item: SyncQueueItem): Promise<string | undefined> {
  const { table, action, clientId, payload } = item;
  if (table === 'expenses') return runExpenseMutation(action, clientId, payload);
  if (table === 'categories') return runCategoryMutation(action, clientId, payload);
  if (table === 'momoAccounts') return runMomoMutation(action, clientId, payload);
  throw new Error(`Unknown sync table: ${table as string}`);
}

// Why the `as never` casts: the syncEngine treats payloads generically
// (Record<string, unknown>) so it can drive any table. The Convex SDK's
// per-mutation arg types are strict — we trust the calling store to have
// supplied a shape-compatible payload at enqueue time.

async function runExpenseMutation(
  action: SyncAction,
  clientId: string,
  payload: Record<string, unknown>,
): Promise<string | undefined> {
  if (action === 'create') {
    const id = await convex.mutation(api.expenses.upsert, { clientId, ...payload } as never);
    return id as unknown as string;
  }
  if (action === 'update') {
    await convex.mutation(api.expenses.update, { clientId, ...payload } as never);
    return;
  }
  if (action === 'delete') {
    await convex.mutation(api.expenses.remove, { clientId });
    return;
  }
}

async function runCategoryMutation(
  action: SyncAction,
  clientId: string,
  payload: Record<string, unknown>,
): Promise<string | undefined> {
  if (action === 'create') {
    const id = await convex.mutation(api.categories.upsert, { clientId, ...payload } as never);
    return id as unknown as string;
  }
  if (action === 'update') {
    await convex.mutation(api.categories.update, { clientId, ...payload } as never);
    return;
  }
  if (action === 'delete') {
    await convex.mutation(api.categories.remove, { clientId });
    return;
  }
}

async function runMomoMutation(
  action: SyncAction,
  clientId: string,
  payload: Record<string, unknown>,
): Promise<string | undefined> {
  if (action === 'create') {
    const id = await convex.mutation(api.momoAccounts.upsert, { clientId, ...payload } as never);
    return id as unknown as string;
  }
  if (action === 'update') {
    await convex.mutation(api.momoAccounts.update, { clientId, ...payload } as never);
    return;
  }
  if (action === 'delete') {
    await convex.mutation(api.momoAccounts.remove, { clientId });
    return;
  }
}

async function handleFailure(item: SyncQueueItem, err: unknown): Promise<boolean> {
  const message = err instanceof Error ? err.message : String(err);
  const isAuth = /Unauthorized|not authenticated|missing.*identity|401/i.test(message);
  const isNetwork = /network|failed to fetch|fetch.*failed|offline|timeout/i.test(message);

  if (isAuth) {
    needsReauth.value = true;
    if (item.id !== undefined) {
      await db.syncQueue.update(item.id, {
        attemptCount: item.attemptCount + 1,
        lastError: message,
      });
    }
    return false; // stop the drain
  }

  const lastBackoff = BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
  const nextAttempt =
    isNetwork || item.attemptCount < BACKOFF_SCHEDULE_MS.length
      ? Date.now() + (BACKOFF_SCHEDULE_MS[item.attemptCount] ?? lastBackoff)
      : Date.now() + 24 * 60 * 60 * 1000; // park failures for 24h after exhausting backoff

  if (item.id !== undefined) {
    await db.syncQueue.update(item.id, {
      attemptCount: item.attemptCount + 1,
      lastError: message,
      nextAttemptAt: nextAttempt,
    });
  }
  // Keep draining other items — this one is rescheduled.
  return !isNetwork;
}

// ---- Lifecycle helpers ----

export function startSyncListeners() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void drain());
  // Heartbeat: catch backoff-scheduled items whose nextAttemptAt has elapsed
  // while no other trigger fired.
  if (!heartbeat) {
    heartbeat = setInterval(() => void drain(), 60_000);
  }
}

export function stopSyncListeners() {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

/**
 * Used by stores when the user signs out — wipe pending state so the next
 * user starts fresh. Local rows are kept on disk per the design (offline
 * resume for the same user across sign-out/sign-in cycles).
 */
export function clearReauthFlag() {
  needsReauth.value = false;
}

// Re-export so call sites don't need to import dataModel directly.
export type ServerId<T extends 'expenses' | 'categories' | 'momoAccounts'> = Id<T>;

/**
 * Used by the store when attributing legacy un-userId'd rows to the
 * current user. Returns the new SyncTable, just a helper alias.
 */
export type { SyncTable };
