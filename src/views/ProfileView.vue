<template>
  <div class="profile-view overflow-y-auto h-full">
    <div class="profile-view__content px-lg py-md">
      <header class="mb-lg">
        <h1 class="text-xl font-bold">Profile</h1>
      </header>

      <!-- Avatar + Name -->
      <div class="profile-view__hero neo-card flex flex-col items-center mb-lg">
        <div class="profile-view__avatar">
          <span class="text-xl font-bold">{{ userStore.initials }}</span>
        </div>
        <p class="text-lg font-bold mt-md">{{ userStore.profile.name }}</p>
        <p class="text-sm text-secondary">GH₵ · Ghana Cedis</p>
      </div>

      <!-- Theme & Notifications -->
      <div class="neo-card-sm mb-md">
        <div class="profile-view__row" @click="themeStore.toggleMode">
          <span class="material-symbols-rounded text-secondary">
            {{ themeStore.mode === 'dark' ? 'dark_mode' : 'light_mode' }}
          </span>
          <span class="text-sm font-semibold flex-1">Dark Mode</span>
          <div class="profile-view__toggle" :class="{ 'profile-view__toggle--on': themeStore.mode === 'dark' }">
            <div class="profile-view__toggle-knob"></div>
          </div>
        </div>
        <div class="profile-view__divider"></div>
        <div class="profile-view__row" @click="toggleNotifications">
          <span class="material-symbols-rounded text-secondary">notifications_active</span>
          <span class="text-sm font-semibold flex-1">Daily Reminders</span>
          <div class="profile-view__toggle" :class="{ 'profile-view__toggle--on': userStore.profile.notificationsEnabled }">
            <div class="profile-view__toggle-knob"></div>
          </div>
        </div>
      </div>

      <!-- Menu Items -->
      <div class="neo-card-sm mb-md">
        <div class="profile-view__row" @click="$router.push('/momo')">
          <span class="material-symbols-rounded text-secondary">account_balance_wallet</span>
          <span class="text-sm font-semibold flex-1">Mobile Money</span>
          <span class="text-xs text-tertiary">{{ momoStore.accounts.length }} linked</span>
          <span class="material-symbols-rounded text-tertiary icon-sm">chevron_right</span>
        </div>
        <div class="profile-view__divider"></div>
        <div class="profile-view__row" @click="showApiKey = !showApiKey">
          <span class="material-symbols-rounded text-secondary">key</span>
          <span class="text-sm font-semibold flex-1">Groq API Key</span>
          <span class="material-symbols-rounded text-tertiary icon-sm">chevron_right</span>
        </div>
        <div class="profile-view__divider"></div>
        <div class="profile-view__row" @click="expensesStore.downloadCSV()">
          <span class="material-symbols-rounded text-secondary">download</span>
          <span class="text-sm font-semibold flex-1">Export CSV</span>
          <span class="material-symbols-rounded text-tertiary icon-sm">chevron_right</span>
        </div>
      </div>

      <!-- API Key Editor -->
      <div v-if="showApiKey" class="neo-card mb-md">
        <label class="text-xs text-secondary font-medium mb-xs" style="display:block;">Groq API Key</label>
        <input
          v-model="apiKeyInput"
          :type="showKeyValue ? 'text' : 'password'"
          class="neo-input mb-sm"
          placeholder="gsk_..."
        />
        <div class="flex gap-sm">
          <button class="neo-button neo-button--ghost text-xs" @click="showKeyValue = !showKeyValue">
            {{ showKeyValue ? 'Hide' : 'Show' }}
          </button>
          <button class="neo-button neo-button--primary text-xs" @click="saveApiKey">Save</button>
        </div>
      </div>

      <!-- Manage Categories -->
      <div class="neo-card-sm mb-md">
        <div class="profile-view__row" @click="showCategories = !showCategories">
          <span class="material-symbols-rounded text-secondary">category</span>
          <span class="text-sm font-semibold flex-1">Manage Categories</span>
          <span class="material-symbols-rounded text-tertiary icon-sm">
            {{ showCategories ? 'expand_less' : 'expand_more' }}
          </span>
        </div>
      </div>

      <div v-if="showCategories" class="neo-card mb-md">
        <div class="flex flex-col gap-sm mb-md">
          <div v-for="cat in categoriesStore.categories" :key="cat.id" class="flex items-center gap-sm">
            <div class="cat-dot" :style="{ background: cat.color }"></div>
            <span class="material-symbols-rounded icon-sm" :style="{ color: cat.color }">{{ cat.icon }}</span>
            <span class="text-sm flex-1">{{ cat.name }}</span>
            <button v-if="cat.isCustom" class="neo-button neo-button--ghost" style="padding:4px;" @click="categoriesStore.deleteCategory(cat.id)">
              <span class="material-symbols-rounded icon-sm text-danger">close</span>
            </button>
          </div>
        </div>
        <div class="flex gap-sm">
          <input v-model="newCatName" class="neo-input" placeholder="New category..." style="flex:1;" />
          <input v-model="newCatColor" type="color" style="width:40px;height:40px;border:none;border-radius:8px;cursor:pointer;" />
          <button class="neo-button neo-button--primary" @click="addCategory" :disabled="!newCatName.trim()">Add</button>
        </div>
      </div>

      <!-- Help & Feedback -->
      <div class="neo-card-sm mb-md">
        <div v-if="canInstall" class="profile-view__row" @click="promptInstall">
          <span class="material-symbols-rounded text-primary">download_for_offline</span>
          <span class="text-sm font-semibold flex-1">Install VoxSpend</span>
          <span class="material-symbols-rounded text-tertiary icon-sm">chevron_right</span>
        </div>
        <div v-if="canInstall" class="profile-view__divider"></div>
        <div class="profile-view__row" @click="$router.push('/feedback')">
          <span class="material-symbols-rounded text-secondary">feedback</span>
          <span class="text-sm font-semibold flex-1">Send Feedback</span>
          <span class="material-symbols-rounded text-tertiary icon-sm">chevron_right</span>
        </div>
      </div>

      <!-- App Info -->
      <div class="profile-view__footer">
        <p class="text-xs text-tertiary">VoxSpend v{{ appVersion }}</p>
        <p class="text-xs text-tertiary">Track spending with your voice.</p>
        <br>
        <p class="text-xs text-tertiary">Made with ❤️ by <a href="https://github.com/enoch-prince" target="_blank">Enoch Prince</a>😎</p>
      </div>

      <div style="height: 20px;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { useMomoStore } from '@/stores/momo'
import { useExpensesStore } from '@/stores/expenses'
import { useCategoriesStore } from '@/stores/categories'
import { usePwaInstall } from '@/composables/usePwaInstall'
import { convex, api } from '@/services/convexClient'

const userStore = useUserStore()
const themeStore = useThemeStore()
const momoStore = useMomoStore()
const expensesStore = useExpensesStore()
const categoriesStore = useCategoriesStore()
const { canInstall, promptInstall } = usePwaInstall()
const appVersion = APP_VERSION

const showApiKey = ref(false)
const showKeyValue = ref(false)
const apiKeyInput = ref(userStore.profile.groqApiKey)
const showCategories = ref(false)
const newCatName = ref('')
const newCatColor = ref('#6366F1')

function saveApiKey() {
  userStore.setApiKey(apiKeyInput.value)
  showApiKey.value = false
}

async function addCategory() {
  if (!newCatName.value.trim()) return
  await categoriesStore.addCategory(newCatName.value.trim(), 'label', newCatColor.value)
  newCatName.value = ''
}

async function toggleNotifications() {
  const newState = !userStore.profile.notificationsEnabled

  if (newState) {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
        })
        
        const subJson = sub.toJSON()
        if (!subJson.endpoint || !subJson.keys) throw new Error('Invalid subscription')

        await convex.mutation(api.subscriptions.saveSubscription, {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh as string,
            auth: subJson.keys.auth as string
          }
        })

        userStore.updateProfile({ notificationsEnabled: true })
      } catch (err) {
        console.error('Failed to subscribe to push', err)
        alert('Failed to enable notifications. Ensure your device supports Web Push.')
      }
    } else {
      alert('Notification permission denied.')
    }
  } else {
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        await convex.mutation(api.subscriptions.removeSubscription, {
          endpoint: sub.endpoint
        })
        await sub.unsubscribe()
      }
      userStore.updateProfile({ notificationsEnabled: false })
    } catch (err) {
      console.error('Failed to unsubscribe', err)
      userStore.updateProfile({ notificationsEnabled: false })
    }
  }
}
</script>

<style lang="scss">
.profile-view {
  &__avatar {
    width: 64px; height: 64px; border-radius: 50%;
    background: linear-gradient(135deg, $primary, $accent);
    display: flex; align-items: center; justify-content: center; color: #fff;
  }
  &__row {
    display: flex; align-items: center; gap: $space-md; padding: $space-md 0; cursor: pointer;
    &:first-child { padding-top: 0; }
    &:last-child { padding-bottom: 0; }
  }
  &__divider { height: 1px; background: var(--border); }
  &__toggle {
    width: 44px; height: 24px; border-radius: 12px; background: var(--border);
    position: relative; transition: background $transition-fast; cursor: pointer;
    &--on { background: $primary; }
    &--on &-knob { transform: translateX(20px); }
  }
  &__toggle-knob {
    width: 20px; height: 20px; border-radius: 50%; background: #fff;
    position: absolute; top: 2px; left: 2px; transition: transform $transition-fast;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  &__toggle--on &__toggle-knob { transform: translateX(20px); }
  &__footer { text-align: center; padding: $space-xl 0; }
}
</style>
