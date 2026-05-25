<template>
  <div class="app-shell" :class="{ 'has-nav': showNav }">
    <!-- Offline banner -->
    <transition name="page">
      <div v-if="!isOnline" class="offline-banner">
        <span class="material-symbols-rounded icon-sm">cloud_off</span>
        You're offline — expenses are saved locally
      </div>
      <div
        v-else-if="voiceStore.pendingCount > 0"
        class="offline-banner"
        style="background: var(--primary); color: white"
      >
        <span><span class="material-symbols-rounded icon-sm spin-animation">sync</span>
        <p class="text-secondary">Syncing {{ voiceStore.pendingCount }} voice note(s)...</p></span>
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
  import { db } from '@/services/database';
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
    if (online) voiceStore.syncPendingNotes();
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

  // Hoists local IndexedDB data into Convex on first cloud sign-in, then
  // hydrates all stores. Idempotent — safe to call repeatedly.
  // Why a function (not just onMounted): App.vue is the root component, so it
  // mounts before the user signs up. Without a watcher trigger, sign-ups that
  // happen during the same session never migrate their local data — users see
  // an empty cloud account and assume their expenses are gone.
  async function initializeUserData() {
    const migrationDone = localStorage.getItem('voxspend-migrated');
    if (!migrationDone) {
      const [localExpenses, localCategories] = await Promise.all([
        db.expenses.toArray(),
        db.categories.toArray(),
      ]);
      if (localExpenses.length > 0 || localCategories.filter((c) => c.isCustom).length > 0) {
        await categoriesStore.migrateFromLocal(localCategories);
        await expensesStore.migrateFromLocal(localExpenses);
        await db.expenses.clear();
        await db.categories.clear();
      }
      localStorage.setItem('voxspend-migrated', '1');
    }

    await categoriesStore.initialize();
    await expensesStore.fetchExpenses();
    await momoStore.fetchAccounts();

    await voiceStore.updatePendingCount();
    if (isOnline.value) voiceStore.syncPendingNotes();
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
