// ============================================
// MoMo (Mobile Money) Store — Local-first
// ============================================
//
// Mirrors the expenses/categories pattern: Dexie reads, optimistic
// writes, queued sync to Convex.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { convex, api } from '@/services/convexClient';
import { db, generateId, generateClientId, now } from '@/services/database';
import { enqueue, drain } from '@/services/syncEngine';
import { useAuthStore } from './auth';
import { toFriendlyError } from '@/utils/errors';
import type { MomoAccount, MomoProvider } from '@/types';

type ConvexMomo = {
  _id: string;
  _creationTime: number;
  userId: string;
  clientId?: string;
  provider: MomoProvider;
  phoneNumber: string;
  nickname: string;
  linkedAt: string;
};

export const useMomoStore = defineStore('momo', () => {
  const accounts = ref<MomoAccount[]>([]);
  const loading = ref(false);

  function currentUserId(): string {
    const id = useAuthStore().currentUserId;
    if (!id) throw new Error('No signed-in user');
    return id;
  }

  const RECONCILE_TTL_MS = 60_000;
  const RECONCILE_KEY = 'voxspend-reconcile-momo';

  async function hydrate() {
    loading.value = true;
    try {
      const userId = currentUserId();
      accounts.value = await db.momoAccounts.where('userId').equals(userId).sortBy('linkedAt');
      if (navigator.onLine) {
        const lastReconcile = Number(localStorage.getItem(RECONCILE_KEY) ?? 0);
        if (Date.now() - lastReconcile > RECONCILE_TTL_MS) {
          void reconcileFromServer()
            .then(() => localStorage.setItem(RECONCILE_KEY, String(Date.now())))
            .catch(() => {
              /* swallow */
            });
        }
      }
    } finally {
      loading.value = false;
    }
  }

  async function reconcileFromServer() {
    const userId = currentUserId();
    const serverDocs = (await convex.query(api.momoAccounts.list)) as ConvexMomo[];

    const localByClientId = new Map<string, MomoAccount>();
    const localRows = await db.momoAccounts.where('userId').equals(userId).toArray();
    for (const row of localRows) localByClientId.set(row.clientId, row);

    for (const doc of serverDocs) {
      // Skip legacy rows without clientId — see expenses.reconcileFromServer.
      if (!doc.clientId) continue;
      const local = localByClientId.get(doc.clientId);
      if (!local) {
        await db.momoAccounts.add({
          id: generateId(),
          serverId: doc._id,
          userId,
          synced: true,
          clientId: doc.clientId,
          provider: doc.provider,
          phoneNumber: doc.phoneNumber,
          nickname: doc.nickname,
          linkedAt: doc.linkedAt,
        });
        continue;
      }
      if (!local.synced) continue;
      await db.momoAccounts.update(local.id, {
        serverId: doc._id,
        provider: doc.provider,
        phoneNumber: doc.phoneNumber,
        nickname: doc.nickname,
        synced: true,
      });
    }

    accounts.value = await db.momoAccounts.where('userId').equals(userId).sortBy('linkedAt');
  }

  async function linkAccount(provider: MomoProvider, phoneNumber: string, nickname: string) {
    const userId = currentUserId();
    const duplicate = accounts.value.find(
      (a) => a.provider === provider && a.phoneNumber === phoneNumber,
    );
    if (duplicate) throw new Error('This account is already linked');

    const row: MomoAccount = {
      id: generateId(),
      clientId: generateClientId(),
      userId,
      synced: false,
      provider,
      phoneNumber,
      nickname: nickname || `${provider.toUpperCase()} - ${phoneNumber.slice(-4)}`,
      linkedAt: now(),
    };
    try {
      await db.momoAccounts.add(row);
      await enqueue({
        userId,
        table: 'momoAccounts',
        action: 'create',
        entityId: row.id,
        clientId: row.clientId,
        payload: {
          provider: row.provider,
          phoneNumber: row.phoneNumber,
          nickname: row.nickname,
          linkedAt: row.linkedAt,
        },
      });
      accounts.value.push(row);
      return row;
    } catch (err) {
      throw toFriendlyError(err, "Couldn't link that mobile money account.");
    }
  }

  async function unlinkAccount(id: string) {
    const userId = currentUserId();
    try {
      const existing = await db.momoAccounts.get(id);
      if (!existing) {
        accounts.value = accounts.value.filter((a) => a.id !== id);
        return;
      }
      await db.momoAccounts.delete(id);
      await enqueue({
        userId,
        table: 'momoAccounts',
        action: 'delete',
        entityId: id,
        clientId: existing.clientId,
        serverId: existing.serverId,
        payload: {},
      });
      accounts.value = accounts.value.filter((a) => a.id !== id);
    } catch (err) {
      throw toFriendlyError(err, "Couldn't unlink that account.");
    }
  }

  async function updateAccount(id: string, updates: Partial<MomoAccount>) {
    const userId = currentUserId();
    const {
      id: _id,
      userId: _u,
      synced: _s,
      clientId: _cid,
      serverId: _sid,
      linkedAt: _l,
      ...mutable
    } = updates as Record<string, unknown>;
    try {
      const existing = await db.momoAccounts.get(id);
      if (!existing) throw new Error('That account no longer exists.');
      await db.momoAccounts.update(id, { ...mutable, synced: false });
      await enqueue({
        userId,
        table: 'momoAccounts',
        action: 'update',
        entityId: id,
        clientId: existing.clientId,
        serverId: existing.serverId,
        payload: mutable,
      });
      const idx = accounts.value.findIndex((a) => a.id === id);
      if (idx !== -1) {
        accounts.value[idx] = { ...accounts.value[idx], ...mutable, synced: false };
      }
    } catch (err) {
      throw toFriendlyError(err, "Couldn't update that account.");
    }
  }

  async function attributeLegacyRows() {
    const userId = currentUserId();
    const orphans = await db.momoAccounts.where('userId').equals('').toArray();
    if (orphans.length === 0) return;
    for (const row of orphans) {
      const clientId = row.clientId || generateClientId();
      await db.momoAccounts.update(row.id, { userId, clientId, synced: false });
      await enqueue({
        userId,
        table: 'momoAccounts',
        action: 'create',
        entityId: row.id,
        clientId,
        payload: {
          provider: row.provider,
          phoneNumber: row.phoneNumber,
          nickname: row.nickname,
          linkedAt: row.linkedAt,
        },
      });
    }
    void drain();
  }

  function getAccountById(id: string): MomoAccount | undefined {
    return accounts.value.find((a) => a.id === id);
  }

  return {
    accounts,
    loading,
    hydrate,
    reconcileFromServer,
    linkAccount,
    unlinkAccount,
    updateAccount,
    attributeLegacyRows,
    getAccountById,
  };
});
