<template>
  <div class="dashboard overflow-y-auto h-full">
    <div class="dashboard__content px-lg py-md">
      <!-- Header -->
      <header class="dashboard__header flex justify-between items-center mb-lg">
        <div>
          <p class="text-sm text-secondary">Good {{ greeting }},</p>
          <h1 class="text-lg font-bold">{{ userStore.profile.name || 'there' }}</h1>
        </div>
        <div class="dashboard__avatar" @click="$router.push('/profile')">
          <span class="font-bold text-sm">{{ userStore.initials }}</span>
        </div>
      </header>

      <!-- Balance Card -->
      <BalanceCard
        :balance="expensesStore.balance"
        :income="expensesStore.currentMonthIncome"
        :expenses="expensesStore.currentMonthTotal"
        class="mb-lg"
      />

      <!-- Voice prompt -->
      <div class="dashboard__voice-hint neo-card-sm flex items-center gap-md mb-sm" @click="startVoice">
        <div class="dashboard__voice-icon">
          <span class="material-symbols-rounded">mic</span>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-sm">Add by voice</p>
          <p class="text-xs text-tertiary">Tap to speak your expense</p>
        </div>
        <span class="material-symbols-rounded text-tertiary">arrow_forward_ios</span>
      </div>

      <!-- Manual entry prompt -->
      <div class="dashboard__manual-hint neo-card-sm flex items-center gap-md mb-lg" @click="openManualInput">
        <div class="dashboard__manual-icon">
          <span class="material-symbols-rounded">edit_note</span>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-sm">Type it instead</p>
          <p class="text-xs text-tertiary">Manually enter expense details</p>
        </div>
        <span class="material-symbols-rounded text-tertiary">arrow_forward_ios</span>
      </div>

      <!-- Recent Expenses -->
      <section class="mb-lg">
        <div class="flex justify-between items-center mb-md">
          <h2 class="text-md font-bold">Recent</h2>
          <router-link to="/history" class="text-sm text-primary font-semibold" style="text-decoration:none;">
            See all
          </router-link>
        </div>

        <div v-if="expensesStore.recentExpenses.length === 0" class="dashboard__empty neo-card-flat">
          <span class="material-symbols-rounded icon-lg text-tertiary">receipt_long</span>
          <p class="text-sm text-secondary mt-sm">No expenses yet</p>
          <p class="text-xs text-tertiary">Tap the mic to add your first expense</p>
        </div>

        <div v-else class="flex flex-col gap-sm">
          <ExpenseItem
            v-for="expense in expensesStore.recentExpenses"
            :key="expense.id"
            :expense="expense"
            @click="$router.push(`/history/${expense.id}`)"
          />
        </div>
      </section>

      <!-- Category Breakdown Mini -->
      <section v-if="expensesStore.categoryBreakdown.length > 0" class="mb-lg">
        <h2 class="text-md font-bold mb-md">This Month</h2>
        <div class="flex flex-col gap-sm">
          <div
            v-for="cat in expensesStore.categoryBreakdown.slice(0, 4)"
            :key="cat.category"
            class="dashboard__cat-row neo-card-sm flex items-center gap-md"
          >
            <div class="cat-dot" :style="{ background: cat.color }"></div>
            <span class="text-sm font-semibold flex-1">{{ cat.category }}</span>
            <span class="text-xs text-tertiary">{{ cat.percentage }}%</span>
            <span class="text-sm font-bold">GH₵ {{ cat.total.toFixed(2) }}</span>
          </div>
        </div>
      </section>

      <!-- Spacer for bottom nav -->
      <div style="height: 20px;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useExpensesStore } from '@/stores/expenses'
import { useUserStore } from '@/stores/user'
import { useVoiceStore } from '@/stores/voice'
import BalanceCard from '@/components/BalanceCard.vue'
import ExpenseItem from '@/components/ExpenseItem.vue'

const expensesStore = useExpensesStore()
const userStore = useUserStore()
const voiceStore = useVoiceStore()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
})

function startVoice() {
  voiceStore.startRecording()
}

const openManualFromParent = inject<() => void>('openManualInput', () => {})
function openManualInput() {
  openManualFromParent()
}
</script>

<style lang="scss">
.dashboard {
  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, $primary, $accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    cursor: pointer;
  }

  &__voice-hint {
    cursor: pointer;
    transition: transform $transition-fast;
    &:active { transform: scale(0.98); }
  }

  &__voice-icon {
    width: 40px;
    height: 40px;
    border-radius: $radius-md;
    background: linear-gradient(135deg, $primary, $primary-light);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    .material-symbols-rounded { font-size: 22px; }
  }

  &__manual-hint {
    cursor: pointer;
    transition: transform $transition-fast;
    &:active { transform: scale(0.98); }
  }

  &__manual-icon {
    width: 40px;
    height: 40px;
    border-radius: $radius-md;
    background: linear-gradient(135deg, $accent, $accent-light);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    .material-symbols-rounded { font-size: 22px; }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: $space-xl;
    text-align: center;
  }

  &__cat-row {
    .cat-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  }
}
</style>
