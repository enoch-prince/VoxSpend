<template>
  <div class="app-shell" :class="{ 'has-nav': showNav }">
    <!-- Offline banner -->
    <transition name="page">
      <div v-if="!isOnline" class="offline-banner">
        <span class="material-symbols-rounded icon-sm">cloud_off</span>
        You're offline — expenses are saved locally
      </div>
      <div v-else-if="voiceStore.pendingCount > 0" class="offline-banner" style="background: var(--primary); color: white;">
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
    <BottomNav v-if="showNav" />

    <!-- Voice input modal -->
    <VoiceInputModal />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { useThemeStore } from '@/stores/theme'
import { useCategoriesStore } from '@/stores/categories'
import { useExpensesStore } from '@/stores/expenses'
import { useMomoStore } from '@/stores/momo'
import { useVoiceStore } from '@/stores/voice'
import BottomNav from '@/components/BottomNav.vue'
import VoiceInputModal from '@/components/VoiceInputModal.vue'

const route = useRoute()
const { isOnline } = useOnlineStatus()

// Initialize stores
const themeStore = useThemeStore()
const categoriesStore = useCategoriesStore()
const expensesStore = useExpensesStore()
const momoStore = useMomoStore()
const voiceStore = useVoiceStore()

// Watch online status to trigger sync
watch(isOnline, (online) => {
  if (online) {
    voiceStore.syncPendingNotes()
  }
})

// Register Service Worker with auto-update
const { updateServiceWorker } = useRegisterSW({
  onRegistered(r) {
    // Check for updates every 60 minutes
    if (r) {
      setInterval(() => {
        console.log('Checking for PWA updates...')
        r.update()
      }, 60 * 60 * 1000)
    }
  },
  onNeedRefresh() {
    console.log('New content available, reloading...')
    updateServiceWorker(true)
  }
})

const showNav = computed(() => !route.meta.hideNav)

onMounted(async () => {
  await categoriesStore.initialize()
  await expensesStore.fetchExpenses()
  await momoStore.fetchAccounts()
  
  await voiceStore.updatePendingCount()
  if (isOnline.value) {
    voiceStore.syncPendingNotes()
  }
})
</script>

<style lang="scss">
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;

  &.has-nav {
    padding-bottom: var(--bottom-nav-height); }
}

.spin-animation {
  animation: spin 2s linear infinite;
}
</style>
