<template>
  <div class="balance-card neo-card">
    <p class="balance-card__label text-secondary text-sm">Your balance</p>
    <h2 class="balance-card__amount text-3xl font-extrabold">GH₵ {{ formattedBalance }}</h2>

    <div class="balance-card__stats">
      <div class="balance-card__stat neo-card-flat">
        <span class="text-xs text-secondary">Income</span>
        <div class="flex items-center gap-xs">
          <span class="balance-card__badge balance-card__badge--income text-xs font-bold">
            <span class="material-symbols-rounded" style="font-size: 12px">arrow_upward</span>
          </span>
          <span class="text-md font-bold">GH₵ {{ formatAmount(income) }}</span>
        </div>
      </div>

      <div class="balance-card__stat neo-card-flat">
        <span class="text-xs text-secondary">Expenses</span>
        <div class="flex items-center gap-xs">
          <span class="balance-card__badge balance-card__badge--expense text-xs font-bold">
            <span class="material-symbols-rounded" style="font-size: 12px">arrow_downward</span>
          </span>
          <span class="text-md font-bold">GH₵ {{ formatAmount(expenses) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';

  const props = defineProps<{
    balance: number;
    income: number;
    expenses: number;
  }>();

  const formattedBalance = computed(() => {
    return props.balance.toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  });

  function formatAmount(val: number): string {
    return val.toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
</script>

<style lang="scss">
  .balance-card {
    background: linear-gradient(135deg, $primary, $primary-light);
    color: #fff;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: -40%;
      right: -20%;
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
    }

    &__label {
      color: rgba(255, 255, 255, 0.8) !important;
    }

    &__amount {
      margin: $space-sm 0 $space-lg;
      letter-spacing: -1px;
    }

    &__stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: $space-sm;
    }

    &__stat {
      background: rgba(255, 255, 255, 0.15) !important;
      backdrop-filter: blur(10px);
      padding: $space-md !important;
      border-radius: $radius-md !important;

      .text-secondary {
        color: rgba(255, 255, 255, 0.7) !important;
      }

      .font-bold {
        color: #fff;
      }
    }

    &__badge {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      &--income {
        background: rgba($success, 0.3);
        color: #6ee7b7;
      }

      &--expense {
        background: rgba($danger, 0.3);
        color: #fca5a5;
      }
    }
  }
</style>
