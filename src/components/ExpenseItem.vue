<template>
  <div
    class="expense-item neo-card-sm"
    @click="$emit('click', expense)"
    role="button"
    tabindex="0"
  >
    <div class="expense-item__icon" :style="{ background: categoryColor + '18' }">
      <span class="material-symbols-rounded" :style="{ color: categoryColor }">
        {{ categoryIcon }}
      </span>
    </div>

    <div class="expense-item__info">
      <p class="expense-item__merchant font-semibold text-base">{{ expense.merchant }}</p>
      <p class="expense-item__meta text-xs text-tertiary">
        {{ formatDate(expense.date) }}
        <span v-if="expense.category" class="expense-item__cat">· {{ expense.category }}</span>
      </p>
    </div>

    <div class="expense-item__amount" :class="expense.type === 'income' ? 'amount--positive' : 'amount--negative'">
      <span class="font-bold text-md">
        {{ expense.type === 'income' ? '+' : '-' }}GH₵{{ expense.amount.toFixed(2) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCategoriesStore } from '@/stores/categories'
import type { Expense } from '@/types'

const props = defineProps<{
  expense: Expense
}>()

defineEmits<{
  click: [expense: Expense]
}>()

const categoriesStore = useCategoriesStore()

const categoryColor = computed(() => {
  const cat = categoriesStore.getCategoryByName(props.expense.category)
  return cat?.color || '#64748B'
})

const categoryIcon = computed(() => {
  const cat = categoriesStore.getCategoryByName(props.expense.category)
  return cat?.icon || 'more_horiz'
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ' ' + date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style lang="scss">
.expense-item {
  display: flex;
  align-items: center;
  gap: $space-md;
  cursor: pointer;
  transition: transform $transition-fast;

  &:active {
    transform: scale(0.98);
  }

  &__icon {
    width: 44px;
    height: 44px;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .material-symbols-rounded {
      font-size: 22px;
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__merchant {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    margin-top: 2px;
  }

  &__amount {
    flex-shrink: 0;
    text-align: right;
  }
}
</style>
