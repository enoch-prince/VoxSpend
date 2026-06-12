// ============================================
// Categories Store — Local-first (Dexie + sync queue)
// ============================================
//
// Same pattern as expenses. Default seeding happens locally on hydrate
// when both server and local are empty for this user — the queue then
// pushes them up so other devices receive them on next reconcile.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { convex, api } from '@/services/convexClient';
import { db, generateId, generateClientId, now } from '@/services/database';
import { enqueue, drain } from '@/services/syncEngine';
import { useAuthStore } from './auth';
import { toFriendlyError } from '@/utils/errors';
import type { Category } from '@/types';
import { DEFAULT_CATEGORIES } from '@/types';

type ConvexCategory = {
  _id: string;
  _creationTime: number;
  userId: string;
  clientId?: string;
  name: string;
  icon: string;
  color: string;
  isCustom: boolean;
  createdAt: string;
};

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([]);
  const loading = ref(false);

  function currentUserId(): string {
    const id = useAuthStore().currentUserId;
    if (!id) throw new Error('No signed-in user');
    return id;
  }

  const categoryNames = computed(() => categories.value.map((c) => c.name));
  const categoryMap = computed(() => {
    const map: Record<string, Category> = {};
    categories.value.forEach((c) => {
      map[c.name] = c;
    });
    return map;
  });

  const RECONCILE_TTL_MS = 60_000;
  const RECONCILE_KEY = 'voxspend-reconcile-categories';

  async function hydrate() {
    loading.value = true;
    try {
      const userId = currentUserId();
      categories.value = await db.categories.where('userId').equals(userId).sortBy('name');

      // First-run for this user: seed defaults locally and enqueue them.
      // The reconcile pass below will dedupe if the server already has them
      // (clientId-based upsert is idempotent).
      if (categories.value.length === 0) {
        await seedDefaults(userId);
        categories.value = await db.categories.where('userId').equals(userId).sortBy('name');
      }

      if (navigator.onLine) {
        const lastReconcile = Number(localStorage.getItem(RECONCILE_KEY) ?? 0);
        if (Date.now() - lastReconcile > RECONCILE_TTL_MS) {
          void reconcileFromServer()
            .then(() => localStorage.setItem(RECONCILE_KEY, String(Date.now())))
            .catch(() => {
              /* swallow — local data still serves */
            });
        }
      }
    } finally {
      loading.value = false;
    }
  }

  async function seedDefaults(userId: string) {
    const ts = now();
    for (const template of DEFAULT_CATEGORIES) {
      const row: Category = {
        id: generateId(),
        clientId: generateClientId(),
        userId,
        synced: false,
        name: template.name,
        icon: template.icon,
        color: template.color,
        isCustom: template.isCustom,
        createdAt: ts,
      };
      await db.categories.add(row);
      await enqueue({
        userId,
        table: 'categories',
        action: 'create',
        entityId: row.id,
        clientId: row.clientId,
        payload: {
          name: row.name,
          icon: row.icon,
          color: row.color,
          isCustom: row.isCustom,
          createdAt: row.createdAt,
        },
      });
    }
  }

  async function reconcileFromServer() {
    const userId = currentUserId();
    const serverDocs = (await convex.query(api.categories.list)) as ConvexCategory[];

    const localByClientId = new Map<string, Category>();
    const localRows = await db.categories.where('userId').equals(userId).toArray();
    for (const row of localRows) localByClientId.set(row.clientId, row);

    for (const doc of serverDocs) {
      // Skip legacy rows without clientId — see expenses.reconcileFromServer.
      if (!doc.clientId) continue;
      const local = localByClientId.get(doc.clientId);
      if (!local) {
        await db.categories.add({
          id: generateId(),
          serverId: doc._id,
          userId,
          synced: true,
          clientId: doc.clientId,
          name: doc.name,
          icon: doc.icon,
          color: doc.color,
          isCustom: doc.isCustom,
          createdAt: doc.createdAt,
        });
        continue;
      }
      if (!local.synced) continue;
      // Categories have no updatedAt; server values win after first sync.
      await db.categories.update(local.id, {
        serverId: doc._id,
        name: doc.name,
        icon: doc.icon,
        color: doc.color,
        isCustom: doc.isCustom,
        synced: true,
      });
    }

    categories.value = await db.categories.where('userId').equals(userId).sortBy('name');
  }

  async function addCategory(name: string, icon: string, color: string) {
    const userId = currentUserId();
    const createdAt = now();
    const row: Category = {
      id: generateId(),
      clientId: generateClientId(),
      userId,
      synced: false,
      name,
      icon,
      color,
      isCustom: true,
      createdAt,
    };
    try {
      await db.categories.add(row);
      await enqueue({
        userId,
        table: 'categories',
        action: 'create',
        entityId: row.id,
        clientId: row.clientId,
        payload: { name, icon, color, isCustom: true, createdAt },
      });
      categories.value.push(row);
    } catch (err) {
      throw toFriendlyError(err, "Couldn't add that category.");
    }
  }

  async function updateCategory(id: string, updates: Partial<Category>) {
    const userId = currentUserId();
    const {
      id: _id,
      createdAt: _c,
      isCustom: _ic,
      userId: _u,
      synced: _s,
      clientId: _cid,
      serverId: _sid,
      ...mutable
    } = updates as Record<string, unknown>;
    try {
      const existing = await db.categories.get(id);
      if (!existing) throw new Error('That category no longer exists.');
      await db.categories.update(id, { ...mutable, synced: false });
      await enqueue({
        userId,
        table: 'categories',
        action: 'update',
        entityId: id,
        clientId: existing.clientId,
        serverId: existing.serverId,
        payload: mutable,
      });
      const idx = categories.value.findIndex((c) => c.id === id);
      if (idx !== -1) {
        categories.value[idx] = { ...categories.value[idx], ...mutable, synced: false };
      }
    } catch (err) {
      throw toFriendlyError(err, "Couldn't update that category.");
    }
  }

  async function deleteCategory(id: string) {
    const userId = currentUserId();
    const cat = categories.value.find((c) => c.id === id);
    if (cat && !cat.isCustom) return; // never delete defaults
    try {
      const existing = await db.categories.get(id);
      if (!existing) {
        categories.value = categories.value.filter((c) => c.id !== id);
        return;
      }
      await db.categories.delete(id);
      await enqueue({
        userId,
        table: 'categories',
        action: 'delete',
        entityId: id,
        clientId: existing.clientId,
        serverId: existing.serverId,
        payload: {},
      });
      categories.value = categories.value.filter((c) => c.id !== id);
    } catch (err) {
      throw toFriendlyError(err, "Couldn't delete that category.");
    }
  }

  async function attributeLegacyRows() {
    const userId = currentUserId();
    const orphans = await db.categories.where('userId').equals('').toArray();
    if (orphans.length === 0) return;
    for (const row of orphans) {
      const clientId = row.clientId || generateClientId();
      await db.categories.update(row.id, { userId, clientId, synced: false });
      // Only push custom categories to the server — defaults will be seeded
      // freshly per-user via the hydrate flow.
      if (row.isCustom) {
        await enqueue({
          userId,
          table: 'categories',
          action: 'create',
          entityId: row.id,
          clientId,
          payload: {
            name: row.name,
            icon: row.icon,
            color: row.color,
            isCustom: row.isCustom,
            createdAt: row.createdAt,
          },
        });
      }
    }
    void drain();
  }

  function getCategoryByName(name: string): Category | undefined {
    return categories.value.find((c) => c.name.toLowerCase() === name.toLowerCase());
  }

  return {
    categories,
    loading,
    categoryNames,
    categoryMap,
    hydrate,
    reconcileFromServer,
    addCategory,
    updateCategory,
    deleteCategory,
    attributeLegacyRows,
    getCategoryByName,
  };
});
