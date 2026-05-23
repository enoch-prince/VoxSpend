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
        <span class="material-symbols-rounded icon-sm spin-animation">sync</span>
        Syncing {{ voiceStore.pendingCount }} voice note(s)...
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

  onMounted(async () => {
    authStore.initialize();

    if (!authStore.isAuthenticated) return;

    // Check for local IndexedDB data to migrate (one-time, on first cloud sign-in)
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
