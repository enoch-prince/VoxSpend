<template>
  <div class="donut-chart">
    <div class="donut-chart__container">
      <Doughnut :data="chartData" :options="chartOptions" />
      <div class="donut-chart__center">
        <p class="text-xs text-secondary">Total</p>
        <p class="text-xl font-extrabold">{{ formattedTotal }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Doughnut } from 'vue-chartjs';
  import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
  import type { CategoryBreakdown } from '@/types';
  import { formatCurrency } from '@/utils/currency';

  ChartJS.register(ArcElement, Tooltip, Legend);

  const props = defineProps<{
    breakdown: CategoryBreakdown[];
    total: number;
    currency: string;
  }>();

  const formattedTotal = computed(() => formatCurrency(props.total, props.currency));

  const chartData = computed(() => ({
    labels: props.breakdown.map((b) => b.category),
    datasets: [
      {
        data: props.breakdown.map((b) => b.total),
        backgroundColor: props.breakdown.map((b) => b.color),
        borderWidth: 0,
        cutout: '72%',
        borderRadius: 6,
        spacing: 4,
      },
    ],
  }));

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` ${formatCurrency(ctx.parsed, props.currency)}`,
        },
      },
    },
    animation: { animateRotate: true, animateScale: true, duration: 800 },
  };
</script>

<style lang="scss">
  .donut-chart {
    &__container {
      position: relative;
      width: 180px;
      height: 180px;
      margin: 0 auto;
    }
    &__center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
    }
  }
</style>
