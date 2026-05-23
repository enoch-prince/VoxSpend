<template>
  <div class="history-view overflow-y-auto h-full">
    <div class="history-view__content px-lg py-md">
      <header class="flex justify-between items-center mb-lg">
        <h1 class="text-xl font-bold">History</h1>
        <span class="material-symbols-rounded text-secondary" style="cursor: pointer"
          >calendar_month</span
        >
      </header>

      <div
        v-if="expensesStore.expensesByDate.length === 0"
        class="history-view__empty neo-card-flat"
      >
        <span class="material-symbols-rounded icon-lg text-tertiary">receipt_long</span>
        <p class="text-sm text-secondary mt-sm">No transactions yet</p>
        <p class="text-xs text-tertiary">Tap the mic button to add your first expense by voice</p>
      </div>

      <div v-else class="flex flex-col gap-lg">
        <section v-for="group in expensesStore.expensesByDate" :key="group.date">
          <h3 class="text-sm font-bold text-secondary mb-sm px-sm">{{ group.label }}</h3>
          <div class="flex flex-col gap-sm">
            <ExpenseItem
              v-for="expense in group.expenses"
              :key="expense.id"
              :expense="expense"
              @click="goToDetail(expense.id)"
            />
          </div>
        </section>
      </div>

      <div style="height: 20px"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import { useExpensesStore } from '@/stores/expenses';
  import ExpenseItem from '@/components/ExpenseItem.vue';

  const router = useRouter();
  const expensesStore = useExpensesStore();

  function goToDetail(id: string) {
    router.push(`/history/${id}`);
  }
</script>

<style lang="scss">
  .history-view {
    &__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: $space-2xl;
      text-align: center;
    }
  }
</style>
