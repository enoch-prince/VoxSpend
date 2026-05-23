// ============================================
// Expenses Store (Local-First)
// ============================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db, generateId, now } from '@/services/database';
import type { Expense, CategoryBreakdown, DayGroup } from '@/types';
import { useCategoriesStore } from './categories';

export const useExpensesStore = defineStore('expenses', () => {
  const expenses = ref<Expense[]>([]);
  const loading = ref(false);

  // ---- Computed ----
  const totalExpenses = computed(() =>
    expenses.value.filter((e) => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0)
  );

  const totalIncome = computed(() =>
    expenses.value.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0)
  );

  const balance = computed(() => totalIncome.value - totalExpenses.value);

  const currentMonthExpenses = computed(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return expenses.value.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  });

  const currentMonthTotal = computed(() =>
    currentMonthExpenses.value
      .filter((e) => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0)
  );

  const currentMonthIncome = computed(() =>
    currentMonthExpenses.value
      .filter((e) => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0)
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
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
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
      .slice(0, 5)
  );

  // ---- Actions ----
  async function fetchExpenses() {
    loading.value = true;
    try {
      expenses.value = await db.expenses.orderBy('date').reverse().toArray();
    } finally {
      loading.value = false;
    }
  }

  async function addExpense(data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'synced'>) {
    const expense: Expense = {
      ...data,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
      synced: false,
    };
    await db.expenses.add(expense);
    expenses.value.unshift(expense);

    // Queue for sync
    await db.syncQueue.add({
      action: 'create',
      table: 'expenses',
      entityId: expense.id,
      data: expense as unknown as Record<string, unknown>,
      createdAt: now(),
      retries: 0,
    });

    return expense;
  }

  async function updateExpense(id: string, updates: Partial<Expense>) {
    const updated = { ...updates, updatedAt: now() };
    await db.expenses.update(id, updated);

    const idx = expenses.value.findIndex((e) => e.id === id);
    if (idx !== -1) {
      expenses.value[idx] = { ...expenses.value[idx], ...updated };
    }

    await db.syncQueue.add({
      action: 'update',
      table: 'expenses',
      entityId: id,
      data: updated as unknown as Record<string, unknown>,
      createdAt: now(),
      retries: 0,
    });
  }

  async function deleteExpense(id: string) {
    await db.expenses.delete(id);
    expenses.value = expenses.value.filter((e) => e.id !== id);

    await db.syncQueue.add({
      action: 'delete',
      table: 'expenses',
      entityId: id,
      data: {},
      createdAt: now(),
      retries: 0,
    });
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
        ].join(',')
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
