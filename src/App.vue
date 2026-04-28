<template>
  <div class="app-shell" :class="{ 'has-nav': showNav }">
    <!-- Offline banner -->
    <transition name="page">
      <div v-if="!isOnline" class="offline-banner">
        <span class="material-symbols-rounded icon-sm">cloud_off</span>
        You're offline — expenses are saved locally
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
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { useThemeStore } from '@/stores/theme'
import { useCategoriesStore } from '@/stores/categories'
import { useExpensesStore } from '@/stores/expenses'
import { useMomoStore } from '@/stores/momo'
import BottomNav from '@/components/BottomNav.vue'
import VoiceInputModal from '@/components/VoiceInputModal.vue'

const route = useRoute()
const { isOnline } = useOnlineStatus()

// Initialize stores
const themeStore = useThemeStore()
const categoriesStore = useCategoriesStore()
const expensesStore = useExpensesStore()
const momoStore = useMomoStore()

const showNav = computed(() => !route.meta.hideNav)

onMounted(async () => {
  await categoriesStore.initialize()
  await expensesStore.fetchExpenses()
  await momoStore.fetchAccounts()
})
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
</style>
