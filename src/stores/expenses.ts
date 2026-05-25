// ============================================
// Expenses Store — Local-first (Dexie + sync queue)
// ============================================
//
// Reads: always from Dexie, scoped by currentUserId. Loads are instant.
// Writes: optimistic — patch Dexie + enqueue, then update store state.
//         The syncEngine drains the queue when online.
// Reconcile: pulls fresh server rows into Dexie on hydrate. Local rows
//            with `synced === false` win over server (unsaved edits).

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { convex, api } from '@/services/convexClient';
import { db, generateId, generateClientId, now } from '@/services/database';
import { enqueue, drain } from '@/services/syncEngine';
import { useAuthStore } from './auth';
import { toFriendlyError } from '@/utils/errors';
import type { Expense, CategoryBreakdown, DayGroup } from '@/types';
import { useCategoriesStore } from './categories';

type ConvexExpense = {
  _id: string;
  _creationTime: number;
  userId: string;
  clientId?: string;
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  category: string;
  merchant: string;
  note: string;
  date: string;
  momoAccountId?: string;
  createdAt: string;
  updatedAt: string;
};

export const useExpensesStore = defineStore('expenses', () => {
  const expenses = ref<Expense[]>([]);
  const loading = ref(false);

  function currentUserId(): string {
    const id = useAuthStore().currentUserId;
    if (!id) throw new Error('No signed-in user');
    return id;
  }

  // ---- Computed (unchanged) ----
  const totalExpenses = computed(() =>
    expenses.value.filter((e) => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0),
  );

  const totalIncome = computed(() =>
    expenses.value.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0),
  );

  const balance = computed(() => totalIncome.value - totalExpenses.value);

  const currentMonthExpenses = computed(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    return expenses.value.filter((e) => {
      const ed = new Date(e.date);
      return ed.getFullYear() === year && ed.getMonth() === month;
    });
  });

  const currentMonthTotal = computed(() =>
    currentMonthExpenses.value
      .filter((e) => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0),
  );

  const currentMonthIncome = computed(() =>
    currentMonthExpenses.value
      .filter((e) => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0),
  );

  const categoryBreakdown = computed((): CategoryBreakdown[] => {
    const catStore = useCategoriesStore();
    const monthExpenses = currentMonthExpenses.value.filter((e) => e.type === 'expense');
    const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const grouped: Record<string, { total: number; count: number }> = {};
    monthExpenses.forEach((e) => {
      if (!grouped[e.category]) grouped[e.category] = { total: 0, count: 0 };
      grouped[e.category].total += e.amount;
      grouped[e.category].count++;
    });
    return Object.entries(grouped)
      .map(([category, data]) => {
        const cat = catStore.getCategoryByName(category);
        return {
          category,
          color: cat?.color || '#64748B',
          icon: cat?.icon || 'more_horiz',
          total: data.total,
          percentage: total > 0 ? Math.round((data.total / total) * 100) : 0,
          count: data.count,
        };
      })
      .sort((a, b) => b.total - a.total);
  });

  const expensesByDate = computed((): DayGroup[] => {
    const sorted = [...expenses.value].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const groups: Record<string, Expense[]> = {};
    sorted.forEach((e) => {
      const dateKey = e.date.split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(e);
    });
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    return Object.entries(groups).map(([date, items]) => ({
      label: date === today ? 'Today' : date === yesterday ? 'Yesterday' : formatDateLabel(date),
      date,
      expenses: items,
    }));
  });

  const recentExpenses = computed(() =>
    [...expenses.value]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
  );

  // ---- Lifecycle ----

  /**
   * Two-step hydrate: instant Dexie read first, then background server
   * reconcile if online. Never throws on network failure — local data is
   * always available.
   */
  async function hydrate() {
    loading.value = true;
    try {
      const userId = currentUserId();
      expenses.value = await db.expenses.where('userId').equals(userId).reverse().sortBy('date');
      if (navigator.onLine) {
        // Don't block UI on the reconcile.
        void reconcileFromServer().catch(() => {
          /* swallow — local data still serves */
        });
      }
    } finally {
      loading.value = false;
    }
  }

  /**
   * Pull fresh server rows into Dexie. Local rows with `synced === false`
   * are preserved (last-write-wins by updatedAt for synced rows).
   */
  async function reconcileFromServer() {
    const userId = currentUserId();
    const serverDocs = (await convex.query(api.expenses.list)) as ConvexExpense[];

    // Index local rows by clientId for quick lookup. clientId is the
    // stable cross-device identifier; serverId fills in after first sync.
    const localByClientId = new Map<string, Expense>();
    const localRows = await db.expenses.where('userId').equals(userId).toArray();
    for (const row of localRows) localByClientId.set(row.clientId, row);

    for (const doc of serverDocs) {
      // Defensive: server rows without clientId are legacy data that hasn't
      // been backfilled yet. Skip them so reconcile doesn't import them as
      // unkeyed duplicates. Run `npx convex run migrations:backfillClientIds`
      // to assign clientIds; the next reconcile will pick them up.
      if (!doc.clientId) continue;
      const local = localByClientId.get(doc.clientId);
      if (!local) {
        // New row from another device — insert.
        await db.expenses.add({
          id: generateId(),
          serverId: doc._id,
          userId,
          synced: true,
          clientId: doc.clientId,
          amount: doc.amount,
          currency: doc.currency,
          type: doc.type,
          category: doc.category,
          merchant: doc.merchant,
          note: doc.note,
          date: doc.date,
          momoAccountId: doc.momoAccountId,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        });
        continue;
      }
      if (!local.synced) continue; // local edits win
      // Last-write-wins by updatedAt.
      if (new Date(doc.updatedAt).getTime() > new Date(local.updatedAt).getTime()) {
        await db.expenses.update(local.id, {
          serverId: doc._id,
          amount: doc.amount,
          currency: doc.currency,
          type: doc.type,
          category: doc.category,
          merchant: doc.merchant,
          note: doc.note,
          date: doc.date,
          momoAccountId: doc.momoAccountId,
          updatedAt: doc.updatedAt,
          synced: true,
        });
      } else if (!local.serverId) {
        // Same updatedAt but server has an _id we didn't know about.
        await db.expenses.update(local.id, { serverId: doc._id });
      }
    }

    // NOTE: cross-device deletes (server has fewer rows than local synced
    // set) are not handled in MVP. Tombstones are a follow-up.

    expenses.value = await db.expenses.where('userId').equals(userId).reverse().sortBy('date');
  }

  // ---- Actions (optimistic + enqueue) ----

  async function addExpense(
    data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'userId' | 'clientId' | 'serverId'>,
  ) {
    const userId = currentUserId();
    const ts = now();
    const row: Expense = {
      ...data,
      id: generateId(),
      clientId: generateClientId(),
      userId,
      synced: false,
      createdAt: ts,
      updatedAt: ts,
    };
    try {
      await db.expenses.add(row);
      await enqueue({
        userId,
        table: 'expenses',
        action: 'create',
        entityId: row.id,
        clientId: row.clientId,
        payload: {
          amount: row.amount,
          currency: row.currency,
          type: row.type,
          category: row.category,
          merchant: row.merchant,
          note: row.note,
          date: row.date,
          momoAccountId: row.momoAccountId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      });
      expenses.value.unshift(row);
      return row;
    } catch (err) {
      throw toFriendlyError(err, "Couldn't save your expense.");
    }
  }

  async function updateExpense(id: string, updates: Partial<Expense>) {
    const userId = currentUserId();
    const updatedAt = now();
    // Strip fields the sync layer manages so they can't be clobbered.
    const {
      id: _id,
      synced: _s,
      createdAt: _c,
      userId: _u,
      clientId: _cid,
      serverId: _sid,
      ...mutable
    } = updates as Record<string, unknown>;
    try {
      const existing = await db.expenses.get(id);
      if (!existing) throw new Error('That expense no longer exists.');
      await db.expenses.update(id, { ...mutable, updatedAt, synced: false });
      await enqueue({
        userId,
        table: 'expenses',
        action: 'update',
        entityId: id,
        clientId: existing.clientId,
        serverId: existing.serverId,
        payload: { ...mutable, updatedAt },
      });
      const idx = expenses.value.findIndex((e) => e.id === id);
      if (idx !== -1) {
        expenses.value[idx] = { ...expenses.value[idx], ...mutable, updatedAt, synced: false };
      }
    } catch (err) {
      throw toFriendlyError(err, "Couldn't update that expense.");
    }
  }

  async function deleteExpense(id: string) {
    const userId = currentUserId();
    try {
      const existing = await db.expenses.get(id);
      if (!existing) {
        expenses.value = expenses.value.filter((e) => e.id !== id);
        return;
      }
      await db.expenses.delete(id);
      await enqueue({
        userId,
        table: 'expenses',
        action: 'delete',
        entityId: id,
        clientId: existing.clientId,
        serverId: existing.serverId,
        payload: {},
      });
      expenses.value = expenses.value.filter((e) => e.id !== id);
    } catch (err) {
      throw toFriendlyError(err, "Couldn't delete that expense.");
    }
  }

  /**
   * Attribute pre-sync-layer rows (no userId) to the current user and
   * enqueue them for upload. Called once on first sign-in from App.vue.
   */
  async function attributeLegacyRows() {
    const userId = currentUserId();
    const orphans = await db.expenses.where('userId').equals('').toArray();
    if (orphans.length === 0) return;
    for (const row of orphans) {
      const clientId = row.clientId || generateClientId();
      await db.expenses.update(row.id, { userId, clientId, synced: false });
      await enqueue({
        userId,
        table: 'expenses',
        action: 'create',
        entityId: row.id,
        clientId,
        payload: {
          amount: row.amount,
          currency: row.currency,
          type: row.type,
          category: row.category,
          merchant: row.merchant,
          note: row.note,
          date: row.date,
          momoAccountId: row.momoAccountId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      });
    }
    void drain();
  }

  function getExpenseById(id: string): Expense | undefined {
    return expenses.value.find((e) => e.id === id);
  }

  function getExpensesForMonth(year: number, month: number): Expense[] {
    return expenses.value.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  function exportCSV(): string {
    const headers = ['Date', 'Type', 'Category', 'Merchant', 'Amount', 'Currency', 'Note'];
    const rows = expenses.value
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((e) =>
        [
          e.date.split('T')[0],
          e.type,
          e.category,
          `"${e.merchant}"`,
          e.amount.toFixed(2),
          e.currency,
          `"${e.note}"`,
        ].join(','),
      );
    return [headers.join(','), ...rows].join('\n');
  }

  function downloadCSV() {
    const csv = exportCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voxspend-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    expenses,
    loading,
    totalExpenses,
    totalIncome,
    balance,
    currentMonthExpenses,
    currentMonthTotal,
    currentMonthIncome,
    categoryBreakdown,
    expensesByDate,
    recentExpenses,
    hydrate,
    reconcileFromServer,
    addExpense,
    updateExpense,
    deleteExpense,
    attributeLegacyRows,
    getExpenseById,
    getExpensesForMonth,
    exportCSV,
    downloadCSV,
  };
});

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
