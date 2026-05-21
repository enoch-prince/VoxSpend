<template>
  <transition name="modal">
    <div v-if="isOpen" class="manual-modal" @click.self="close">
      <div class="manual-modal__content neo-card" @click.stop>
        <!-- Header -->
        <div class="manual-modal__header">
          <h2 class="text-lg font-bold">Add Expense</h2>
          <button class="manual-modal__close" @click="close" aria-label="Close">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <!-- Type Toggle -->
        <div class="manual-modal__type-toggle">
          <button
            class="manual-modal__type-btn"
            :class="{ 'manual-modal__type-btn--active': form.type === 'expense', 'manual-modal__type-btn--expense': form.type === 'expense' }"
            @click="form.type = 'expense'"
          >
            <span class="material-symbols-rounded icon-sm">arrow_upward</span>
            Expense
          </button>
          <button
            class="manual-modal__type-btn"
            :class="{ 'manual-modal__type-btn--active': form.type === 'income', 'manual-modal__type-btn--income': form.type === 'income' }"
            @click="form.type = 'income'"
          >
            <span class="material-symbols-rounded icon-sm">arrow_downward</span>
            Income
          </button>
        </div>

        <!-- Amount Input -->
        <div class="manual-modal__amount-wrapper">
          <span class="manual-modal__currency">GH₵</span>
          <input
            ref="amountInput"
            v-model="amountDisplay"
            type="text"
            inputmode="decimal"
            class="manual-modal__amount-input"
            placeholder="0.00"
            @input="onAmountInput"
            id="manual-amount-input"
          />
        </div>

        <!-- Form Fields -->
        <div class="manual-modal__fields">
          <!-- Category -->
          <div class="manual-modal__field">
            <label class="manual-modal__label">
              <span class="material-symbols-rounded icon-sm text-secondary">category</span>
              Category
            </label>
            <div class="manual-modal__category-grid">
              <button
                v-for="cat in categoriesStore.categories"
                :key="cat.id"
                class="manual-modal__cat-chip"
                :class="{ 'manual-modal__cat-chip--active': form.category === cat.name }"
                :style="form.category === cat.name ? { background: cat.color, color: '#fff', boxShadow: `0 4px 12px ${cat.color}40` } : {}"
                @click="form.category = cat.name"
              >
                <span class="material-symbols-rounded" style="font-size: 16px;">{{ cat.icon }}</span>
                <span>{{ cat.name }}</span>
              </button>
            </div>
          </div>

          <!-- Merchant -->
          <div class="manual-modal__field">
            <label class="manual-modal__label" for="manual-merchant-input">
              <span class="material-symbols-rounded icon-sm text-secondary">store</span>
              Merchant / Source
            </label>
            <input
              v-model="form.merchant"
              type="text"
              class="neo-input"
              placeholder="e.g. Melcom, MTN, Market"
              id="manual-merchant-input"
            />
          </div>

          <!-- Date -->
          <div class="manual-modal__field">
            <label class="manual-modal__label" for="manual-date-input">
              <span class="material-symbols-rounded icon-sm text-secondary">calendar_today</span>
              Date
            </label>
            <input
              v-model="form.date"
              type="date"
              class="neo-input"
              id="manual-date-input"
            />
          </div>

          <!-- Note -->
          <div class="manual-modal__field">
            <label class="manual-modal__label" for="manual-note-input">
              <span class="material-symbols-rounded icon-sm text-secondary">edit_note</span>
              Note (optional)
            </label>
            <input
              v-model="form.note"
              type="text"
              class="neo-input"
              placeholder="What was this for?"
              id="manual-note-input"
            />
          </div>
        </div>

        <!-- Actions -->
        <div class="manual-modal__actions">
          <button class="neo-button neo-button--ghost" @click="close">Cancel</button>
          <button
            class="neo-button neo-button--primary"
            :disabled="!isValid"
            @click="saveExpense"
            id="manual-save-btn"
          >
            <span class="material-symbols-rounded icon-sm">check_circle</span>
            Save {{ form.type === 'income' ? 'Income' : 'Expense' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, watch } from 'vue'
import { useExpensesStore } from '@/stores/expenses'
import { useCategoriesStore } from '@/stores/categories'

const emit = defineEmits<{
  close: []
  saved: []
}>()

const props = defineProps<{
  isOpen: boolean
}>()

const expensesStore = useExpensesStore()
const categoriesStore = useCategoriesStore()

const amountInput = ref<HTMLInputElement | null>(null)
const amountDisplay = ref('')

const form = reactive({
  amount: 0,
  type: 'expense' as 'expense' | 'income',
  category: 'Other',
  merchant: '',
  date: new Date().toISOString().split('T')[0],
  note: ''
})

const isValid = computed(() => form.amount > 0)

function onAmountInput() {
  // Strip non-numeric characters except decimal point
  const cleaned = amountDisplay.value.replace(/[^0-9.]/g, '')
  // Prevent multiple decimal points
  const parts = cleaned.split('.')
  const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned
  amountDisplay.value = sanitized
  form.amount = parseFloat(sanitized) || 0
}

watch(() => props.isOpen, (open) => {
  if (open) {
    // Reset form when opening
    resetForm()
    nextTick(() => {
      amountInput.value?.focus()
    })
  }
})

function resetForm() {
  form.amount = 0
  form.type = 'expense'
  form.category = 'Other'
  form.merchant = ''
  form.date = new Date().toISOString().split('T')[0]
  form.note = ''
  amountDisplay.value = ''
}

async function saveExpense() {
  if (!isValid.value) return

  await expensesStore.addExpense({
    amount: form.amount,
    currency: 'GHS',
    type: form.type,
    category: form.category,
    merchant: form.merchant || 'Unknown',
    note: form.note || `Manual ${form.type}`,
    date: form.date
  })

  emit('saved')
  close()
}

function close() {
  emit('close')
}
</script>

<style lang="scss">
.manual-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  max-width: $max-app-width;
  margin: 0 auto;

  &__content {
    width: 100%;
    border-radius: $radius-xl $radius-xl 0 0;
    padding: $space-lg;
    padding-bottom: calc($space-xl + #{$safe-area-bottom});
    max-height: 92vh;
    overflow-y: auto;
    animation: slide-up-modal 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $space-lg;
  }

  &__close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--surface-alt);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all $transition-fast;

    &:active {
      transform: scale(0.9);
      background: var(--border);
    }
  }

  &__type-toggle {
    display: flex;
    gap: $space-xs;
    padding: 4px;
    background: var(--surface-alt);
    border-radius: $radius-md;
    margin-bottom: $space-lg;
  }

  &__type-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-xs;
    padding: 10px $space-md;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--text-tertiary);
    font-family: $font-family;
    font-size: $font-size-sm;
    font-weight: 600;
    cursor: pointer;
    transition: all $transition-fast;

    &--active {
      color: #fff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &--expense {
      background: $danger;
    }

    &--income {
      background: $success;
    }
  }

  &__amount-wrapper {
    display: flex;
    align-items: center;
    gap: $space-sm;
    padding: $space-md $space-lg;
    background: var(--surface-alt);
    border-radius: $radius-md;
    margin-bottom: $space-lg;
    border: 2px solid transparent;
    transition: border-color $transition-fast;

    &:focus-within {
      border-color: $primary;
    }
  }

  &__currency {
    font-size: $font-size-lg;
    font-weight: 800;
    color: var(--text-tertiary);
  }

  &__amount-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: $font-family;
    font-size: $font-size-2xl;
    font-weight: 800;
    color: var(--text);
    min-width: 0;

    &::placeholder {
      color: var(--text-tertiary);
      opacity: 0.5;
    }
  }

  &__fields {
    display: flex;
    flex-direction: column;
    gap: $space-md;
    margin-bottom: $space-lg;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: $space-xs;
    font-size: $font-size-xs;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__category-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__cat-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: $radius-full;
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
    font-family: $font-family;
    font-size: $font-size-xs;
    font-weight: 600;
    cursor: pointer;
    transition: all $transition-fast;
    white-space: nowrap;

    &:active {
      transform: scale(0.95);
    }

    &--active {
      border-color: transparent;
    }
  }

  &__actions {
    display: flex;
    gap: $space-md;

    .neo-button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: $space-xs;
      padding: 14px 20px;

      &:disabled {
        opacity: 0.4;
        pointer-events: none;
      }
    }
  }
}

@keyframes slide-up-modal {
  from {
    transform: translateY(100%);
    opacity: 0.5;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
