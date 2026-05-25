<template>
  <div class="app-shell" :class="{ 'has-nav': showNav }">
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

  const { updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
    onNeedRefresh() {
      updateServiceWorker(true);
    },
  });

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

  // Fires for both cases: refresh while signed in (initialize() restores token)
  // and live sign-in/sign-up (auth store flips after AuthView submits).
  watch(
    () => authStore.isAuthenticated,
    (isAuth, wasAuth) => {
      if (isAuth && !wasAuth) void initializeUserData();
    },
  );

  onMounted(() => {
    authStore.initialize();
    startSyncListeners();
  });
</script>

<style lang="scss">
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;

    &.has-nav {
      padding-bottom: var(--bottom-nav-height);
    }
  }

  .spin-animation {
    animation: spin 2s linear infinite;
  }
</style>
