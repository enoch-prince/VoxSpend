<template>
  <div class="expenses-view overflow-y-auto h-full">
    <div class="expenses-view__content px-lg py-md">
      <header class="flex justify-between items-center mb-lg">
        <h1 class="text-xl font-bold">Expenses</h1>
        <div
          class="expenses-view__month-select neo-chip"
          @click="showMonthPicker = !showMonthPicker"
        >
          <span>{{ monthLabel }}</span>
          <span class="material-symbols-rounded icon-sm">expand_more</span>
        </div>
      </header>

      <!-- Month picker dropdown -->
      <div v-if="showMonthPicker" class="expenses-view__picker neo-card-sm mb-md">
        <div class="expenses-view__picker-grid">
          <button
            v-for="m in 12"
            :key="m"
            class="neo-button neo-button--ghost"
            :class="{ 'neo-button--primary': m - 1 === selectedMonth }"
            @click="selectMonth(m - 1)"
          >
            {{ monthNames[m - 1] }}
          </button>
        </div>
      </div>

      <!-- Donut Chart -->
      <div class="neo-card mb-lg" v-if="breakdown.length > 0">
        <DonutChart :breakdown="breakdown" :total="monthTotal" />
      </div>

      <div v-else class="neo-card-flat mb-lg" style="padding: 2rem; text-align: center">
        <span class="material-symbols-rounded icon-lg text-tertiary">pie_chart</span>
        <p class="text-sm text-secondary mt-sm">No expenses this month</p>
      </div>

      <!-- Category list -->
      <div class="flex flex-col gap-sm">
        <div
          v-for="cat in breakdown"
          :key="cat.category"
          class="expenses-view__cat neo-card-sm flex items-center gap-md"
        >
          <div class="expenses-view__cat-dot" :style="{ background: cat.color }"></div>
          <div class="flex-1">
            <p class="font-semibold text-base">{{ cat.category }}</p>
            <p class="text-xs text-tertiary">
              {{ cat.count }} transaction{{ cat.count !== 1 ? 's' : '' }}
            </p>
          </div>
          <span class="text-xs text-tertiary">{{ cat.percentage }}%</span>
          <span class="text-md font-bold">GH₵ {{ cat.total.toFixed(2) }}</span>
        </div>
      </div>

      <div style="height: 20px"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useExpensesStore } from '@/stores/expenses';
  import { useCategoriesStore } from '@/stores/categories';
  import DonutChart from '@/components/DonutChart.vue';
  import type { CategoryBreakdown } from '@/types';

  const expensesStore = useExpensesStore();
  const categoriesStore = useCategoriesStore();

  const now = new Date();
  const selectedMonth = ref(now.getMonth());
  const selectedYear = ref(now.getFullYear());
  const showMonthPicker = ref(false);

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthLabel = computed(() => `${monthNames[selectedMonth.value]} ${selectedYear.value}`);

  const monthExpenses = computed(() =>
    expensesStore
      .getExpensesForMonth(selectedYear.value, selectedMonth.value)
      .filter((e) => e.type === 'expense')
  );

  const monthTotal = computed(() => monthExpenses.value.reduce((s, e) => s + e.amount, 0));

  const breakdown = computed((): CategoryBreakdown[] => {
    const total = monthTotal.value;
    const grouped: Record<string, { total: number; count: number }> = {};
    monthExpenses.value.forEach((e) => {
      if (!grouped[e.category]) grouped[e.category] = { total: 0, count: 0 };
      grouped[e.category].total += e.amount;
      grouped[e.category].count++;
    });
    return Object.entries(grouped)
      .map(([category, data]) => {
        const cat = categoriesStore.getCategoryByName(category);
        return {
          category,
          color: cat?.color || '#64748B',
          icon: cat?.icon || 'more_horiz',
          total: data.total,
          percentage: total > 0 ? Math.round((data.total / total) * 100) : 0,
          count: data.count,
        };
      })
      .sort((a, b) => b.total - a.total);
  });

  function selectMonth(m: number) {
    selectedMonth.value = m;
    showMonthPicker.value = false;
  }
</script>

<style lang="scss">
  .expenses-view {
    &__month-select {
      cursor: pointer;
    }
    &__picker-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: $space-xs;
    }
    &__cat-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  }
</style>
