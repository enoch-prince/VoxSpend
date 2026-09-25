<template>
  <div class="account-settings-view overflow-y-auto h-full" @click="currencyPicker = null">
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
          <div class="currency-picker" @click.stop>
            <button
              id="account-currency"
              class="currency-picker__trigger"
              type="button"
              role="combobox"
              :aria-expanded="currencyPicker === 'active'"
              aria-controls="active-currency-options"
              @click="toggleCurrencyPicker('active')"
            >
              <span class="currency-picker__code">{{ accountsStore.activeAccount.currency }}</span>
              <span class="currency-picker__name">{{ accountCurrencyName(accountsStore.activeAccount.currency) }}</span>
              <span class="material-symbols-rounded currency-picker__chevron" aria-hidden="true">
                {{ currencyPicker === 'active' ? 'expand_less' : 'expand_more' }}
              </span>
            </button>
            <div
              v-if="currencyPicker === 'active'"
              id="active-currency-options"
              class="currency-picker__options"
              role="listbox"
              aria-label="Default currency"
            >
              <button
                v-for="currency in currencies"
                :key="currency.code"
                class="currency-picker__option"
                :class="{ 'currency-picker__option--active': currency.code === accountsStore.activeAccount.currency }"
                type="button"
                role="option"
                :aria-selected="currency.code === accountsStore.activeAccount.currency"
                @click="selectCurrency('active', currency.code)"
              >
                <span class="currency-picker__option-mark">{{ currency.symbol }}</span>
                <span class="currency-picker__option-copy">
                  <strong>{{ currency.code }}</strong>
                  <span>{{ currency.name }}</span>
                </span>
                <span v-if="currency.code === accountsStore.activeAccount.currency" class="material-symbols-rounded currency-picker__check" aria-hidden="true">
                  check
                </span>
              </button>
            </div>
          </div>
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
          <div class="currency-picker" @click.stop>
            <button
              class="currency-picker__trigger"
              type="button"
              role="combobox"
              :aria-expanded="currencyPicker === 'new'"
              aria-controls="new-currency-options"
              @click="toggleCurrencyPicker('new')"
            >
              <span class="currency-picker__code">{{ newAccountCurrency }}</span>
              <span class="currency-picker__name">{{ accountCurrencyName(newAccountCurrency) }}</span>
              <span class="material-symbols-rounded currency-picker__chevron" aria-hidden="true">
                {{ currencyPicker === 'new' ? 'expand_less' : 'expand_more' }}
              </span>
            </button>
            <div
              v-if="currencyPicker === 'new'"
              id="new-currency-options"
              class="currency-picker__options"
              role="listbox"
              aria-label="New account currency"
            >
              <button
                v-for="currency in currencies"
                :key="currency.code"
                class="currency-picker__option"
                :class="{ 'currency-picker__option--active': currency.code === newAccountCurrency }"
                type="button"
                role="option"
                :aria-selected="currency.code === newAccountCurrency"
                @click="selectCurrency('new', currency.code)"
              >
                <span class="currency-picker__option-mark">{{ currency.symbol }}</span>
                <span class="currency-picker__option-copy">
                  <strong>{{ currency.code }}</strong>
                  <span>{{ currency.name }}</span>
                </span>
                <span v-if="currency.code === newAccountCurrency" class="material-symbols-rounded currency-picker__check" aria-hidden="true">
                  check
                </span>
              </button>
            </div>
          </div>
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
  import { currencyInfo } from '@/utils/currency';

  const router = useRouter();
  const route = useRoute();
  const accountsStore = useAccountsStore();

  const currencies: { code: CurrencyCode; name: string; symbol: string }[] = [
    { code: 'GHS', name: 'Ghana Cedi', symbol: 'GH₵' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
  ];
  const accountName = ref(accountsStore.activeAccount?.name ?? '');
  const showAccountForm = ref(route.query.account === 'new');
  const newAccountName = ref('');
  const newAccountCurrency = ref<CurrencyCode>('GHS');
  const currencyPicker = ref<'active' | 'new' | null>(null);

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
    return currencyInfo(code).name;
  }

  function toggleCurrencyPicker(target: 'active' | 'new') {
    currencyPicker.value = currencyPicker.value === target ? null : target;
  }

  async function selectCurrency(target: 'active' | 'new', currency: CurrencyCode) {
    currencyPicker.value = null;
    if (target === 'new') {
      newAccountCurrency.value = currency;
      return;
    }
    await updateCurrency(currency);
  }

  async function renameActiveAccount() {
    if (!accountsStore.activeAccountId || !accountName.value.trim()) return;
    await accountsStore.updateAccount(accountsStore.activeAccountId, {
      name: accountName.value.trim(),
    });
  }

  async function updateCurrency(currency: CurrencyCode) {
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

  .currency-picker {
    position: relative;
  }

  .currency-picker__trigger {
    display: flex;
    align-items: center;
    gap: $space-sm;
    width: 100%;
    min-height: 48px;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: $radius-md;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: border-color $transition-fast, box-shadow $transition-fast;
  }

  .currency-picker__trigger:hover,
  .currency-picker__trigger[aria-expanded='true'] {
    border-color: $primary;
    box-shadow: 0 0 0 3px rgba($primary, 0.12);
  }

  .currency-picker__trigger:focus-visible,
  .currency-picker__option:focus-visible {
    outline: 3px solid rgba($primary, 0.3);
    outline-offset: 2px;
  }

  .currency-picker__code {
    min-width: 2.8rem;
    color: $primary;
    font-size: $font-size-sm;
    font-weight: 800;
  }

  .currency-picker__name {
    flex: 1;
    color: var(--text-secondary);
    font-size: $font-size-sm;
  }

  .currency-picker__chevron {
    color: var(--text-tertiary);
    font-size: 1.2rem;
  }

  .currency-picker__options {
    position: absolute;
    z-index: 30;
    top: calc(100% + 0.45rem);
    right: 0;
    left: 0;
    display: grid;
    gap: 0.2rem;
    padding: 0.35rem;
    border: 1px solid var(--border);
    border-radius: $radius-md;
    background: var(--surface);
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
  }

  .currency-picker__option {
    display: flex;
    align-items: center;
    gap: $space-sm;
    min-height: 48px;
    padding: 0.5rem 0.6rem;
    border: 0;
    border-radius: $radius-sm;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .currency-picker__option:hover,
  .currency-picker__option--active {
    background: var(--bg);
  }

  .currency-picker__option-mark {
    display: grid;
    width: 30px;
    height: 30px;
    place-items: center;
    border-radius: 9px;
    background: rgba($primary, 0.1);
    color: $primary;
    font-size: $font-size-sm;
    font-weight: 800;
  }

  .currency-picker__option-copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.05rem;
  }

  .currency-picker__option-copy strong {
    font-size: $font-size-sm;
  }

  .currency-picker__option-copy span {
    color: var(--text-tertiary);
    font-size: $font-size-xs;
  }

  .currency-picker__check {
    color: $primary;
    font-size: 1.15rem;
    font-weight: 800;
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
