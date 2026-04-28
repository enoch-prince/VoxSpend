<template>
  <div class="detail-view overflow-y-auto h-full">
    <div class="detail-view__content px-lg py-md">
      <!-- Header -->
      <header class="flex justify-between items-center mb-lg">
        <button class="neo-button neo-button--ghost" @click="$router.back()">
          <span class="material-symbols-rounded">arrow_back</span>
        </button>
        <h1 class="text-md font-bold">Transaction</h1>
        <button class="neo-button neo-button--ghost" @click="editing = !editing">
          <span class="material-symbols-rounded">{{ editing ? 'close' : 'edit' }}</span>
        </button>
      </header>

      <div v-if="expense" class="flex flex-col gap-lg">
        <!-- Icon + Amount -->
        <div class="detail-view__hero neo-card">
          <div class="detail-view__cat-icon" :style="{ background: catColor + '20' }">
            <span class="material-symbols-rounded" :style="{ color: catColor }">{{ catIcon }}</span>
          </div>
          <p class="text-3xl font-extrabold mt-md" :class="expense.type === 'income' ? 'text-success' : ''">
            {{ expense.type === 'income' ? '+' : '-' }}GH₵ {{ expense.amount.toFixed(2) }}
          </p>
          <p class="text-sm text-secondary mt-xs">{{ expense.merchant }}</p>
        </div>

        <!-- Details -->
        <div class="neo-card flex flex-col gap-md">
          <div class="detail-view__row">
            <span class="text-sm text-secondary">Category</span>
            <select v-if="editing" v-model="editData.category" class="neo-input">
              <option v-for="c in categoriesStore.categoryNames" :key="c" :value="c">{{ c }}</option>
            </select>
            <span v-else class="text-sm font-semibold">{{ expense.category }}</span>
          </div>
          <div class="detail-view__row">
            <span class="text-sm text-secondary">Date</span>
            <input v-if="editing" type="date" v-model="editData.date" class="neo-input" />
            <span v-else class="text-sm font-semibold">{{ formatDate(expense.date) }}</span>
          </div>
          <div class="detail-view__row">
            <span class="text-sm text-secondary">Type</span>
            <span class="text-sm font-semibold" :class="expense.type === 'income' ? 'text-success' : 'text-danger'">
              {{ expense.type === 'income' ? 'Income' : 'Expense' }}
            </span>
          </div>
          <div class="detail-view__row">
            <span class="text-sm text-secondary">Note</span>
            <input v-if="editing" v-model="editData.note" class="neo-input" />
            <span v-else class="text-sm">{{ expense.note || '—' }}</span>
          </div>
        </div>

        <!-- Save / Delete -->
        <div v-if="editing" class="flex gap-md">
          <button class="neo-button neo-button--danger flex-1" @click="handleDelete">
            <span class="material-symbols-rounded icon-sm">delete</span> Delete
          </button>
          <button class="neo-button neo-button--primary flex-1" @click="handleSave">
            <span class="material-symbols-rounded icon-sm">check</span> Save
          </button>
        </div>

        <button v-else class="neo-button neo-button--danger w-full" @click="handleDelete" style="display:flex;align-items:center;justify-content:center;gap:6px;">
          <span class="material-symbols-rounded icon-sm">delete</span> Delete Transaction
        </button>
      </div>

      <div v-else class="detail-view__not-found neo-card-flat">
        <p class="text-secondary">Transaction not found</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useExpensesStore } from '@/stores/expenses'
import { useCategoriesStore } from '@/stores/categories'

const route = useRoute()
const router = useRouter()
const expensesStore = useExpensesStore()
const categoriesStore = useCategoriesStore()

const editing = ref(false)
const expense = computed(() => expensesStore.getExpenseById(route.params.id as string))
const editData = reactive({ category: '', date: '', note: '' })

onMounted(() => {
  if (expense.value) {
    editData.category = expense.value.category
    editData.date = expense.value.date.split('T')[0]
    editData.note = expense.value.note
  }
})

const catColor = computed(() => categoriesStore.getCategoryByName(expense.value?.category || '')?.color || '#64748B')
const catIcon = computed(() => categoriesStore.getCategoryByName(expense.value?.category || '')?.icon || 'more_horiz')

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

async function handleSave() {
  if (!expense.value) return
  await expensesStore.updateExpense(expense.value.id, editData)
  editing.value = false
}

async function handleDelete() {
  if (!expense.value) return
  await expensesStore.deleteExpense(expense.value.id)
  router.back()
}
</script>

<style lang="scss">
.detail-view {
  &__hero { text-align: center; }
  &__cat-icon {
    width: 56px; height: 56px; border-radius: $radius-lg;
    display: inline-flex; align-items: center; justify-content: center;
    .material-symbols-rounded { font-size: 28px; }
  }
  &__row {
    display: flex; justify-content: space-between; align-items: center;
    padding: $space-sm 0; border-bottom: 1px solid var(--border);
    &:last-child { border-bottom: none; }
    .neo-input { max-width: 160px; padding: 6px 10px; font-size: 13px; }
  }
  &__not-found { padding: $space-2xl; text-align: center; }
}
</style>
