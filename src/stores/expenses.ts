// ============================================
// Expenses Store — Convex-backed
// ============================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { convex, api } from '@/services/convexClient';
import { now } from '@/services/database';
import type { Expense, CategoryBreakdown, DayGroup } from '@/types';
import { useCategoriesStore } from './categories';
import type { Id } from '../../convex/_generated/dataModel';

// Convex stores _id (Id<"expenses">) as the primary key.
// We expose it as `id` on the local Expense type for compatibility.
type ConvexExpense = Omit<Expense, 'id' | 'synced'> & {
  _id: Id<'expenses'>;
  _creationTime: number;
  userId: Id<'users'>;
};

function fromConvex(doc: ConvexExpense): Expense {
  return {
    id: doc._id,
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
    synced: true,
  };
}

export const useExpensesStore = defineStore('expenses', () => {
  const expenses = ref<Expense[]>([]);
  const loading = ref(false);

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

  // ---- Actions ----
  async function fetchExpenses() {
    loading.value = true;
    try {
      const docs = await convex.query(api.expenses.list);
      expenses.value = (docs as ConvexExpense[]).map(fromConvex);
    } finally {
      loading.value = false;
    }
  }

  async function addExpense(data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'synced'>) {
    const ts = now();
    const id = await convex.mutation(api.expenses.add, {
      ...data,
      createdAt: ts,
      updatedAt: ts,
    });
    const expense: Expense = { ...data, id: id as string, createdAt: ts, updatedAt: ts, synced: true };
    expenses.value.unshift(expense);
    return expense;
  }

  async function updateExpense(id: string, updates: Partial<Expense>) {
    const updatedAt = now();
    // Exclude local-only fields that are not part of the Convex mutation args
    const { id: _id, synced: _s, createdAt: _c, userId: _u, ...mutableFields } = updates as Record<string, unknown>;
    await convex.mutation(api.expenses.update, {
      id: id as unknown as Id<'expenses'>,
      ...mutableFields,
      updatedAt,
    });
    const idx = expenses.value.findIndex((e) => e.id === id);
    if (idx !== -1) {
      expenses.value[idx] = { ...expenses.value[idx], ...updates, updatedAt };
    }
  }

  async function deleteExpense(id: string) {
    await convex.mutation(api.expenses.remove, { id: id as Id<'expenses'> });
    expenses.value = expenses.value.filter((e) => e.id !== id);
  }

  // Migrate local IndexedDB expenses to Convex on first sign-in
  async function migrateFromLocal(localExpenses: Expense[]) {
    if (localExpenses.length === 0) return;
    await convex.mutation(api.expenses.bulkAdd, {
      expenses: localExpenses.map(({ id: _id, synced: _s, ...rest }) => rest),
    });
    await fetchExpenses();
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
    fetchExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    migrateFromLocal,
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