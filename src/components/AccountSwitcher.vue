<template>
  <div ref="root" class="account-switcher">
    <button
      class="account-switcher__trigger"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="account-switcher-panel"
      :aria-label="`Active account: ${accountsStore.activeAccount?.name ?? 'No account'}`"
      @click="toggle"
      @keydown.escape="close"
    >
      <span class="account-switcher__avatar" aria-hidden="true">
        {{ accountInitials(accountsStore.activeAccount?.name ?? 'Account') }}
      </span>
      <span class="account-switcher__trigger-copy">
        <span class="account-switcher__trigger-name">
          {{ accountsStore.activeAccount?.name ?? 'Choose account' }}
        </span>
        <span class="account-switcher__trigger-meta">
          {{ accountsStore.activeAccount?.currency ?? 'GHS' }}
        </span>
      </span>
      <span class="material-symbols-rounded account-switcher__chevron" aria-hidden="true">
        {{ isOpen ? 'expand_less' : 'expand_more' }}
      </span>
    </button>

    <Transition name="account-popover">
      <div
        v-if="isOpen"
        id="account-switcher-panel"
        class="account-switcher__popover neo-card"
        role="dialog"
        aria-label="Account switcher"
        @keydown.escape="close"
      >
        <div class="account-switcher__identity">
          <span class="account-switcher__identity-avatar" aria-hidden="true">
            {{ userStore.initials }}
          </span>
          <div class="account-switcher__identity-copy">
            <strong>{{ userStore.profile.name || 'Your profile' }}</strong>
            <span>{{ authStore.verificationEmail || 'Signed-in account' }}</span>
          </div>
        </div>

        <div class="account-switcher__actions">
          <button type="button" class="account-switcher__action" @click="goToProfile">
            <span class="material-symbols-rounded" aria-hidden="true">person</span>
            <span>My profile</span>
          </button>
          <button type="button" class="account-switcher__action" @click="goToProfile">
            <span class="material-symbols-rounded" aria-hidden="true">settings</span>
            <span>Account settings</span>
          </button>
        </div>

        <div class="account-switcher__divider"></div>

        <fieldset class="account-switcher__list">
          <legend>Switch account</legend>
          <button
            v-for="(account, index) in accountsStore.accounts"
            :key="account.id"
            class="account-switcher__account"
            :class="{ 'account-switcher__account--active': account.id === activeAccountId }"
            type="button"
            role="radio"
            :aria-checked="account.id === activeAccountId"
            :disabled="switching"
            @click="selectAccount(account.id)"
            @keydown.down.prevent="focusAccount(index + 1)"
            @keydown.up.prevent="focusAccount(index - 1)"
          >
            <span class="account-switcher__account-avatar" aria-hidden="true">
              {{ accountInitials(account.name) }}
            </span>
            <span class="account-switcher__account-copy">
              <strong>{{ account.name }}</strong>
              <span>{{ account.currency }} · {{ currencyName(account.currency) }}</span>
            </span>
            <span
              class="account-switcher__radio"
              :class="{ 'account-switcher__radio--active': account.id === activeAccountId }"
              aria-hidden="true"
            >
              <span v-if="account.id === activeAccountId"></span>
            </span>
          </button>
        </fieldset>

        <button type="button" class="account-switcher__add" @click="goToCreateAccount">
          <span class="material-symbols-rounded" aria-hidden="true">add</span>
          <span>Add account</span>
        </button>

        <button type="button" class="account-switcher__signout" @click="signOut">
          <span class="material-symbols-rounded" aria-hidden="true">logout</span>
          <span>Sign out</span>
        </button>

        <p v-if="accountsStore.error" class="account-switcher__error" aria-live="polite">
          {{ accountsStore.error }}
        </p>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { useAccountsStore } from '@/stores/accounts';
  import { useAuthStore } from '@/stores/auth';
  import { useUserStore } from '@/stores/user';
  import { currencyInfo } from '@/utils/currency';

  const router = useRouter();
  const accountsStore = useAccountsStore();
  const authStore = useAuthStore();
  const userStore = useUserStore();
  const root = ref<HTMLElement | null>(null);
  const isOpen = ref(false);
  const switching = ref(false);

  const activeAccountId = computed(() => accountsStore.activeAccountId);

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  function close() {
    isOpen.value = false;
  }

  function accountInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'A';
  }

  function currencyName(code: string): string {
    return currencyInfo(code).name;
  }

  async function selectAccount(accountId: string) {
    if (accountId === accountsStore.activeAccountId) {
      close();
      return;
    }
    switching.value = true;
    try {
      await accountsStore.selectAccount(accountId);
      close();
    } finally {
      switching.value = false;
    }
  }

  function focusAccount(index: number) {
    const buttons = root.value?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    if (!buttons?.length) return;
    const target = Math.max(0, Math.min(buttons.length - 1, index));
    nextTick(() => buttons[target]?.focus());
  }

  async function goToProfile() {
    close();
    await router.push({ name: 'profile' });
  }

  async function goToCreateAccount() {
    close();
    await router.push({ name: 'profile', query: { account: 'new' } });
  }

  async function signOut() {
    close();
    await authStore.signOut();
    await router.push({ name: 'auth' });
  }

  function onDocumentPointerDown(event: PointerEvent) {
    if (isOpen.value && root.value && !root.value.contains(event.target as Node)) close();
  }

  function onDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeydown);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    document.removeEventListener('keydown', onDocumentKeydown);
  });
</script>

<style scoped lang="scss">
  @use '@/assets/scss/variables' as *;

  .account-switcher {
    position: relative;
    z-index: 20;
  }

  .account-switcher__trigger {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 172px;
    max-width: 220px;
    padding: 0.35rem 0.45rem;
    border: 1px solid transparent;
    border-radius: 0.8rem;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    text-align: left;
    transition: background $transition-fast, border-color $transition-fast;
  }

  .account-switcher__trigger:hover,
  .account-switcher__trigger[aria-expanded='true'] {
    background: var(--surface);
    border-color: var(--border);
  }

  .account-switcher__trigger:focus-visible,
  .account-switcher__action:focus-visible,
  .account-switcher__account:focus-visible,
  .account-switcher__add:focus-visible,
  .account-switcher__signout:focus-visible {
    outline: 3px solid rgba($primary, 0.35);
    outline-offset: 2px;
  }

  .account-switcher__avatar,
  .account-switcher__identity-avatar,
  .account-switcher__account-avatar {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: 50%;
    color: #fff;
    font-weight: 800;
  }

  .account-switcher__avatar {
    width: 34px;
    height: 34px;
    background: linear-gradient(135deg, $primary, $accent);
    font-size: 0.75rem;
  }

  .account-switcher__trigger-copy,
  .account-switcher__account-copy,
  .account-switcher__identity-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .account-switcher__trigger-copy {
    flex: 1;
  }

  .account-switcher__trigger-name,
  .account-switcher__account-copy strong,
  .account-switcher__identity-copy strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-switcher__trigger-name {
    font-size: 0.78rem;
    font-weight: 700;
  }

  .account-switcher__trigger-meta,
  .account-switcher__account-copy span,
  .account-switcher__identity-copy span {
    color: var(--text-tertiary);
    font-size: 0.68rem;
  }

  .account-switcher__chevron {
    color: var(--text-tertiary);
    font-size: 1.2rem;
  }

  .account-switcher__popover {
    position: absolute;
    top: calc(100% + 0.65rem);
    right: 0;
    width: min(320px, calc(100vw - 2rem));
    padding: 0.6rem;
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
  }

  .account-switcher__identity {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.65rem;
    border-radius: 0.65rem;
    background: var(--bg);
  }

  .account-switcher__identity-avatar {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, $primary, $accent);
  }

  .account-switcher__identity-copy {
    gap: 0.1rem;
  }

  .account-switcher__actions {
    display: grid;
    gap: 0.15rem;
    padding: 0.45rem 0;
  }

  .account-switcher__action,
  .account-switcher__add,
  .account-switcher__signout {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    min-height: 42px;
    border: 0;
    border-radius: 0.55rem;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .account-switcher__action {
    padding: 0.55rem 0.65rem;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .account-switcher__action:hover,
  .account-switcher__account:hover,
  .account-switcher__add:hover {
    background: var(--bg);
  }

  .account-switcher__action .material-symbols-rounded,
  .account-switcher__add .material-symbols-rounded,
  .account-switcher__signout .material-symbols-rounded {
    color: var(--text-secondary);
    font-size: 1.15rem;
  }

  .account-switcher__divider {
    height: 1px;
    background: var(--border);
  }

  .account-switcher__list {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0.7rem 0 0.45rem;
    border: 0;
  }

  .account-switcher__list legend {
    padding: 0 0.65rem 0.35rem;
    color: var(--text-tertiary);
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .account-switcher__account {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 56px;
    padding: 0.45rem 0.6rem;
    border: 0;
    border-radius: 0.65rem;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .account-switcher__account--active {
    background: var(--bg);
  }

  .account-switcher__account-avatar {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, rgba($primary, 0.85), rgba($accent, 0.85));
    font-size: 0.68rem;
  }

  .account-switcher__account-copy {
    flex: 1;
    gap: 0.1rem;
  }

  .account-switcher__account-copy strong {
    font-size: 0.8rem;
  }

  .account-switcher__radio {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 2px solid var(--border-strong, #cbd5e1);
    border-radius: 50%;
  }

  .account-switcher__radio--active {
    border-color: $primary;
  }

  .account-switcher__radio--active span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $primary;
  }

  .account-switcher__add {
    padding: 0.55rem 0.65rem;
    color: $primary;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .account-switcher__signout {
    margin-top: 0.25rem;
    padding: 0.55rem 0.65rem;
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .account-switcher__error {
    margin: 0.45rem 0 0;
    padding: 0.5rem 0.65rem;
    border-radius: 0.5rem;
    background: rgba($danger, 0.08);
    color: $danger;
    font-size: 0.72rem;
  }

  .account-popover-enter-active,
  .account-popover-leave-active {
    transition: opacity 160ms ease, transform 160ms ease;
  }

  .account-popover-enter-from,
  .account-popover-leave-to {
    opacity: 0;
    transform: translateY(-0.35rem) scale(0.98);
  }

  @media (max-width: 480px) {
    .account-switcher__trigger {
      min-width: 150px;
    }

    .account-switcher__popover {
      position: fixed;
      top: 4.75rem;
      right: 0.75rem;
      left: 0.75rem;
      width: auto;
      max-height: calc(100dvh - 7rem);
      overflow-y: auto;
    }
  }
</style>
