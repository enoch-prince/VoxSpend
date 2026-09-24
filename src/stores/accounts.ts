import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { convex, api } from '@/services/convexClient';
import { useAuthStore } from './auth';
import { toFriendlyError } from '@/utils/errors';
import type { CurrencyCode, ExpenseAccount } from '@/types';
import { db } from '@/services/database';
import { setSyncAccount } from '@/services/syncEngine';

type ConvexExpenseAccount = {
  _id: string;
  _creationTime: number;
  name: string;
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref<ExpenseAccount[]>([]);
  const activeAccountId = ref<string | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');

  const activeAccount = computed(
    () => accounts.value.find((account) => account.id === activeAccountId.value) ?? null,
  );
  const hasActiveAccount = computed(() => activeAccount.value !== null);

  function currentUserId(): string {
    const id = useAuthStore().currentUserId;
    if (!id) throw new Error('No signed-in user');
    return id;
  }

  function storageKey(userId: string): string {
    return `voxspend-active-account:${userId}`;
  }

  function readStoredAccountId(userId: string): string | null {
    return localStorage.getItem(storageKey(userId));
  }

  function persistActiveAccount(userId: string, accountId: string): void {
    localStorage.setItem(storageKey(userId), accountId);
  }

  async function load(): Promise<void> {
    const userId = currentUserId();
    loading.value = true;
    error.value = '';
    try {
      let serverAccounts = (await convex.query(api.accounts.list)) as ConvexExpenseAccount[];
      if (serverAccounts.length === 0) {
        await convex.mutation(api.accounts.ensureDefault, {});
        serverAccounts = (await convex.query(api.accounts.list)) as ConvexExpenseAccount[];
      } else {
        await convex.mutation(api.accounts.ensureDefault, {});
        serverAccounts = (await convex.query(api.accounts.list)) as ConvexExpenseAccount[];
      }

      accounts.value = serverAccounts.map((account) => ({
        id: account._id,
        name: account.name,
        currency: account.currency,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        archivedAt: account.archivedAt,
      }));

      const storedId = readStoredAccountId(userId);
      const selected = accounts.value.find((account) => account.id === storedId) ?? accounts.value[0];
      if (selected) {
        activeAccountId.value = selected.id;
        persistActiveAccount(userId, selected.id);
        setSyncAccount(selected.id);
      }
    } catch (err) {
      error.value = toFriendlyError(err, "Couldn't load your expense accounts.").message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function selectAccount(accountId: string): Promise<void> {
    const account = accounts.value.find((candidate) => candidate.id === accountId);
    if (!account) throw new Error('That expense account is unavailable.');
    const userId = currentUserId();
    activeAccountId.value = account.id;
    persistActiveAccount(userId, account.id);
    setSyncAccount(account.id);
  }

  async function bindLegacyRows(): Promise<void> {
    const userId = currentUserId();
    const accountId = activeAccountId.value;
    if (!accountId) throw new Error('No active expense account');

    await db.transaction(
      'rw',
      [db.expenses, db.categories, db.momoAccounts, db.syncQueue, db.pendingVoiceNotes],
      async () => {
        await db.expenses.where('userId').equals(userId).modify((row) => {
          if (!row.accountId) row.accountId = accountId;
        });
        await db.categories.where('userId').equals(userId).modify((row) => {
          if (!row.accountId) row.accountId = accountId;
        });
        await db.momoAccounts.where('userId').equals(userId).modify((row) => {
          if (!row.accountId) row.accountId = accountId;
        });
        await db.syncQueue.where('userId').equals(userId).modify((row) => {
          if (!row.accountId) row.accountId = accountId;
        });
        await db.pendingVoiceNotes.where('userId').equals('').modify((row) => {
          row.userId = userId;
          row.accountId = accountId;
        });
        await db.pendingVoiceNotes
          .where('userId')
          .equals(userId)
          .modify((row) => {
            if (!row.accountId) row.accountId = accountId;
          });
      },
    );
  }

  async function createAccount(name: string, currency: CurrencyCode): Promise<ExpenseAccount> {
    const userId = currentUserId();
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Account name cannot be empty.');
    saving.value = true;
    error.value = '';
    try {
      const id = await convex.mutation(api.accounts.create, {
        name: trimmedName,
        currency,
      });
      const created: ExpenseAccount = {
        id: id as string,
        name: trimmedName,
        currency,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      accounts.value.push(created);
      await selectAccount(created.id);
      return created;
    } catch (err) {
      const friendly = toFriendlyError(err, "Couldn't create that account.");
      error.value = friendly.message;
      throw friendly;
    } finally {
      saving.value = false;
    }
  }

  async function updateAccount(
    accountId: string,
    updates: { name?: string; currency?: CurrencyCode },
  ): Promise<void> {
    const account = accounts.value.find((candidate) => candidate.id === accountId);
    if (!account) throw new Error('That expense account is unavailable.');
    saving.value = true;
    error.value = '';
    try {
      await convex.mutation(api.accounts.update, { accountId: accountId as never, ...updates });
      Object.assign(account, updates, { updatedAt: new Date().toISOString() });
    } catch (err) {
      const friendly = toFriendlyError(err, "Couldn't update that account.");
      error.value = friendly.message;
      throw friendly;
    } finally {
      saving.value = false;
    }
  }

  async function archiveAccount(accountId: string): Promise<void> {
    const userId = currentUserId();
    saving.value = true;
    error.value = '';
    try {
      await convex.mutation(api.accounts.archive, { accountId: accountId as never });
      accounts.value = accounts.value.filter((account) => account.id !== accountId);
      if (activeAccountId.value === accountId) {
        const replacement = accounts.value[0];
        if (!replacement) throw new Error('At least one active account is required.');
        activeAccountId.value = replacement.id;
        persistActiveAccount(userId, replacement.id);
        setSyncAccount(replacement.id);
      }
    } catch (err) {
      const friendly = toFriendlyError(err, "Couldn't archive that account.");
      error.value = friendly.message;
      throw friendly;
    } finally {
      saving.value = false;
    }
  }

  function clear(): void {
    accounts.value = [];
    activeAccountId.value = null;
    error.value = '';
  }

  return {
    accounts,
    activeAccountId,
    activeAccount,
    hasActiveAccount,
    loading,
    saving,
    error,
    load,
    selectAccount,
    createAccount,
    updateAccount,
    archiveAccount,
    bindLegacyRows,
    clear,
  };
});
