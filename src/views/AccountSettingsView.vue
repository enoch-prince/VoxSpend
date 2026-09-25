<template>
  <div class="account-settings-view overflow-y-auto h-full">
    <div class="account-settings-view__content px-lg py-md">
      <header class="flex items-center gap-md mb-lg">
        <button class="neo-button neo-button--ghost" type="button" aria-label="Back" @click="router.back()">
          <span class="material-symbols-rounded">arrow_back</span>
        </button>
        <div>
          <h1 class="text-xl font-bold">Account settings</h1>
          <p class="text-xs text-tertiary">Manage your active expense account</p>
        </div>
      </header>

      <section v-if="accountsStore.activeAccount" class="neo-card mb-md">
        <div class="account-settings-view__account-hero">
          <div class="account-settings-view__account-avatar" aria-hidden="true">
            {{ accountInitials(accountsStore.activeAccount.name) }}
          </div>
          <div class="flex flex-col">
            <span class="text-lg font-bold">{{ accountsStore.activeAccount.name }}</span>
            <span class="text-sm text-secondary">
              {{ accountsStore.activeAccount.currency }} ·
              {{ accountCurrencyName(accountsStore.activeAccount.currency) }}
            </span>
          </div>
        </div>

        <div class="profile-view__divider"></div>

        <div class="account-settings-view__field">
          <label class="text-xs text-secondary font-semibold" for="account-name">Account name</label>
          <div class="flex gap-sm">
            <input id="account-name" v-model="accountName" class="neo-input flex-1" />
            <button
              class="neo-button neo-button--ghost"
              type="button"
              :disabled="!accountName.trim() || accountsStore.saving"
              @click="renameActiveAccount"
            >
              Save
            </button>
          </div>
        </div>

        <div class="account-settings-view__field">
          <label class="text-xs text-secondary font-semibold" for="account-currency">
            Default currency
          </label>
          <select
            id="account-currency"
            :value="accountsStore.activeAccount.currency"
            class="neo-input"
            @change="updateCurrency"
          >
            <option v-for="currency in currencies" :key="currency.code" :value="currency.code">
              {{ currency.code }} · {{ currency.name }}
            </option>
          </select>
          <p class="text-xs text-tertiary">
            Existing transactions keep their original currency.
          </p>
        </div>

        <button
          v-if="accountsStore.accounts.length > 1"
          class="neo-button neo-button--ghost text-danger"
          type="button"
          @click="archiveActiveAccount"
        >
          <span class="material-symbols-rounded icon-sm" aria-hidden="true">archive</span>
          Archive account
        </button>

        <p v-if="accountsStore.error" class="account-settings-view__error" aria-live="polite">
          {{ accountsStore.error }}
        </p>
      </section>

      <section class="neo-card-sm">
        <div class="flex items-center justify-between mb-md">
          <div>
            <h2 class="text-md font-bold">Create another account</h2>
            <p class="text-xs text-tertiary">Keep separate ledgers for different parts of your life.</p>
          </div>
          <button
            class="neo-button neo-button--ghost text-xs"
            type="button"
            @click="showAccountForm = !showAccountForm"
          >
            {{ showAccountForm ? 'Close' : 'Add account' }}
          </button>
        </div>

        <div v-if="showAccountForm" class="account-settings-view__new-form">
          <input
            v-model="newAccountName"
            class="neo-input"
            placeholder="e.g. Business"
            aria-label="New account name"
          />
          <select v-model="newAccountCurrency" class="neo-input" aria-label="New account currency">
            <option v-for="currency in currencies" :key="currency.code" :value="currency.code">
              {{ currency.code }} · {{ currency.name }}
            </option>
          </select>
          <button
            class="neo-button neo-button--primary"
            type="button"
            :disabled="!newAccountName.trim() || accountsStore.saving"
            @click="createAccount"
          >
            Create account
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useAccountsStore } from '@/stores/accounts';
  import type { CurrencyCode } from '@/types';

  const router = useRouter();
  const route = useRoute();
  const accountsStore = useAccountsStore();

  const currencies: { code: CurrencyCode; name: string }[] = [
    { code: 'GHS', name: 'Ghana Cedi' },
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
  ];
  const accountName = ref(accountsStore.activeAccount?.name ?? '');
  const showAccountForm = ref(route.query.account === 'new');
  const newAccountName = ref('');
  const newAccountCurrency = ref<CurrencyCode>('GHS');

  watch(
    () => accountsStore.activeAccountId,
    () => {
      accountName.value = accountsStore.activeAccount?.name ?? '';
    },
  );

  watch(
    () => route.query.account,
    (account) => {
      showAccountForm.value = account === 'new';
    },
  );

  function accountInitials(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'A'
    );
  }

  function accountCurrencyName(code: CurrencyCode): string {
    return currencies.find((currency) => currency.code === code)?.name ?? code;
  }

  async function renameActiveAccount() {
    if (!accountsStore.activeAccountId || !accountName.value.trim()) return;
    await accountsStore.updateAccount(accountsStore.activeAccountId, {
      name: accountName.value.trim(),
    });
  }

  async function updateCurrency(event: Event) {
    const currency = (event.target as HTMLSelectElement).value as CurrencyCode;
    if (accountsStore.activeAccountId) {
      await accountsStore.updateAccount(accountsStore.activeAccountId, { currency });
    }
  }

  async function createAccount() {
    if (!newAccountName.value.trim()) return;
    await accountsStore.createAccount(newAccountName.value, newAccountCurrency.value);
    newAccountName.value = '';
    showAccountForm.value = false;
    await router.replace({ name: 'account-settings' });
  }

  async function archiveActiveAccount() {
    const account = accountsStore.activeAccount;
    if (!account || !window.confirm(`Archive ${account.name}?`)) return;
    await accountsStore.archiveAccount(account.id);
    await router.replace({ name: 'account-settings' });
  }
</script>

<style scoped lang="scss">
  @use '@/assets/scss/variables' as *;

  .account-settings-view {
    background: var(--bg);
  }

  .account-settings-view__content {
    max-width: 620px;
    margin: 0 auto;
  }

  .account-settings-view__account-hero {
    display: flex;
    align-items: center;
    gap: $space-md;
    padding-bottom: $space-lg;
  }

  .account-settings-view__account-avatar {
    display: grid;
    width: 54px;
    height: 54px;
    place-items: center;
    border-radius: 16px;
    background: linear-gradient(135deg, $primary, $accent);
    color: #fff;
    font-size: $font-size-md;
    font-weight: 800;
  }

  .account-settings-view__field {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
    margin-top: $space-lg;
  }

  .account-settings-view__new-form {
    display: flex;
    flex-direction: column;
    gap: $space-sm;
  }

  .account-settings-view__error {
    margin-top: $space-md;
    padding: $space-sm $space-md;
    border-radius: $radius-sm;
    background: rgba($danger, 0.08);
    color: $danger;
    font-size: $font-size-xs;
  }
</style>
