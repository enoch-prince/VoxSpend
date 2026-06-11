<template>
  <div class="app-shell" :class="{ 'has-nav': showNav }">
    <!-- App update prompt -->
    <transition name="page">
      <div v-if="updateAvailable" class="update-banner" role="alert">
        <div class="update-banner__content">
          <span class="material-symbols-rounded">system_update</span>
          <p>A new version of VoxSpend is available.</p>
          <button type="button" class="update-banner__btn" @click="applyUpdate">
            Update
          </button>
          <button
            type="button"
            class="update-banner__btn update-banner__btn--ghost"
            @click="dismissUpdate"
          >
            Later
          </button>
        </div>
      </div>
    </transition>

    <!-- Offline / sync banner -->
    <transition name="page">
      <div v-if="!isOnline" class="offline-banner">
        <div class="flex items-center justify-center gap-sm">
          <span class="material-symbols-rounded icon-sm">cloud_off</span>
          <p>
            You're offline —
            <template v-if="totalPending > 0">
              {{ totalPending }} change{{ totalPending === 1 ? '' : 's' }} will sync when you reconnect
            </template>
            <template v-else>changes are saved locally</template>
          </p>
        </div>
      </div>
      <div
        v-else-if="isSyncing"
        class="offline-banner"
        style="background: var(--primary); color: white"
      >
        <div class="flex items-center justify-center gap-sm">
          <span class="text-secondary material-symbols-rounded icon-sm spin-animation">sync</span>
          <p class="text-secondary">
            Syncing {{ totalPending }} change{{ totalPending === 1 ? '' : 's' }}…
          </p>
        </div>
      </div>
    </transition>

    <!-- Main content -->
    <router-view v-slot="{ Component, route }">
      <transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>

    <!-- Bottom navigation -->
    <BottomNav v-if="showNav" @openManual="showManualInput = true" />

    <!-- Voice input modal -->
    <VoiceInputModal />

    <!-- Manual input modal -->
    <ManualInputModal
      :isOpen="showManualInput"
      @close="showManualInput = false"
      @saved="showManualInput = false"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, provide, ref, watch } from 'vue';
  import { useRoute } from 'vue-router';
  import { useRegisterSW } from 'virtual:pwa-register/vue';
  import { useOnlineStatus } from '@/composables/useOnlineStatus';
  import { useThemeStore } from '@/stores/theme';
  import { useAuthStore } from '@/stores/auth';
  import { useCategoriesStore } from '@/stores/categories';
  import { useExpensesStore } from '@/stores/expenses';
  import { useMomoStore } from '@/stores/momo';
  import { useVoiceStore } from '@/stores/voice';
  import {
    pendingCount as syncPendingCount,
    isDraining as syncIsDraining,
    drain as syncDrain,
    startSyncListeners,
  } from '@/services/syncEngine';
  import BottomNav from '@/components/BottomNav.vue';
  import VoiceInputModal from '@/components/VoiceInputModal.vue';
  import ManualInputModal from '@/components/ManualInputModal.vue';

  const route = useRoute();
  const { isOnline } = useOnlineStatus();

  // Initialize stores
  const themeStore = useThemeStore();
  void themeStore; // side-effect: applies theme
  const authStore = useAuthStore();
  const categoriesStore = useCategoriesStore();
  const expensesStore = useExpensesStore();
  const momoStore = useMomoStore();
  const voiceStore = useVoiceStore();
  const showManualInput = ref(false);
  provide('openManualInput', () => {
    showManualInput.value = true;
  });

  watch(isOnline, (online) => {
    if (online) {
      voiceStore.syncPendingNotes();
      void syncDrain();
    }
  });

  // Service worker update flow:
  // - Background check every hour for a new build.
  // - When a new build is ready, surface a banner asking the user to update
  //   instead of silently reloading the page mid-task (which used to be the
  //   behaviour — silent updateServiceWorker(true) on onNeedRefresh).
  const updateAvailable = ref(false);
  const { updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
    onNeedRefresh() {
      updateAvailable.value = true;
    },
  });

  function applyUpdate() {
    updateAvailable.value = false;
    void updateServiceWorker(true);
  }

  function dismissUpdate() {
    updateAvailable.value = false;
  }

  const showNav = computed(() => !route.meta.hideNav);
  // Surface combined pending state to the offline banner.
  const totalPending = computed(() => syncPendingCount.value + voiceStore.pendingCount);
  const isSyncing = computed(() => syncIsDraining.value || totalPending.value > 0);

  // Local-first hydration:
  // 1. Resolve the user's _id (online query; falls back to cached value).
  // 2. Attribute any legacy rows from the pre-sync-layer schema to this user
  //    and enqueue them for upload. One-shot per browser.
  // 3. Hydrate every store from Dexie (instant) — they kick off background
  //    server reconciles themselves.
  // 4. Drain the sync queue.
  async function initializeUserData() {
    await authStore.resolveUserId();
    if (!authStore.currentUserId) return; // offline + never signed in here before

    const attributed = localStorage.getItem('voxspend-attributed');
    if (!attributed) {
      await expensesStore.attributeLegacyRows();
      await categoriesStore.attributeLegacyRows();
      await momoStore.attributeLegacyRows();
      localStorage.setItem('voxspend-attributed', '1');
    }

    await Promise.all([
      categoriesStore.hydrate(),
      expensesStore.hydrate(),
      momoStore.hydrate(),
    ]);

    await voiceStore.updatePendingCount();
    if (isOnline.value) {
      voiceStore.syncPendingNotes();
      void syncDrain();
    }
  }

  // Hydrate only once the user is BOTH authenticated and email-verified.
  // The server-side `requireVerifiedUser` check rejects expenses/categories/
  // momo queries from unverified users, so firing hydrate during the brief
  // post-signup pre-verification window just spams the Convex logs and
  // leaves the local cache empty after verification (the watcher only sees
  // each transition once).
  const isReadyToHydrate = computed(
    () => authStore.isAuthenticated && authStore.emailVerified === true,
  );
  let didHydrate = false;
  watch(
    isReadyToHydrate,
    (ready) => {
      if (ready && !didHydrate) {
        didHydrate = true;
        void initializeUserData();
      } else if (!ready) {
        // Sign-out or verification revoked — allow a re-hydrate on next ready.
        didHydrate = false;
      }
    },
    { immediate: true },
  );

  onMounted(() => {
    authStore.initialize();
    startSyncListeners();
  });
</script>

<style lang="scss">
  @use '@/assets/scss/variables' as *;

  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;

    &.has-nav {
      padding-bottom: var(--bottom-nav-height);
    }
  }

  .update-banner {
    position: relative;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    max-width: $max-app-width;
    width: 100%;
    padding: 10px 16px;
    background: linear-gradient(135deg, $primary, $primary-light);
    color: #fff;
    z-index: 1001;
    animation: slideDown 300ms ease;

    &__content {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      max-width: 100%;

      .material-symbols-rounded {
        font-size: 1.125rem;
        flex-shrink: 0;
      }

      p {
        margin: 0;
        font-size: $font-size-sm;
        font-weight: 600;
        flex: 1;
        min-width: 0;
      }
    }

    &__btn {
      border: none;
      padding: 6px 12px;
      border-radius: $radius-sm;
      background: rgba(255, 255, 255, 0.22);
      color: #fff;
      font-family: $font-family;
      font-size: $font-size-xs;
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: background $transition-fast;

      &:hover {
        background: rgba(255, 255, 255, 0.32);
      }

      &--ghost {
        background: transparent;

        &:hover {
          background: rgba(255, 255, 255, 0.14);
        }
      }
    }
  }

  .spin-animation {
    animation: spin 2s linear infinite;
  }
</style>
