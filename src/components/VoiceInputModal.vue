<template>
  <transition name="modal">
    <div v-if="voiceStore.state !== 'idle'" class="voice-modal" @click.self="voiceStore.cancel">
      <div class="voice-modal__content modal-content neo-card">

        <!-- Recording State -->
        <div v-if="voiceStore.state === 'recording'" class="voice-modal__recording">
          <div class="voice-modal__viz">
            <div class="voice-modal__ring" :style="ringStyle"></div>
            <div class="voice-modal__mic-icon">
              <span class="material-symbols-rounded">mic</span>
            </div>
          </div>
          <p class="text-lg font-semibold mt-md">Listening...</p>
          <p class="text-secondary text-sm">{{ voiceStore.formatDuration(voiceStore.duration) }}</p>
          <div class="voice-modal__actions mt-lg">
            <button class="neo-button neo-button--ghost" @click="voiceStore.cancel">Cancel</button>
            <button class="neo-button neo-button--primary" @click="voiceStore.stopAndProcess">
              <span class="material-symbols-rounded icon-sm">stop</span>
              Done
            </button>
          </div>
        </div>


        <!-- Processing State -->
        <div v-else-if="voiceStore.state === 'processing'" class="voice-modal__processing">
          <div class="voice-modal__spinner"></div>
          <p class="text-lg font-semibold mt-md">Processing...</p>
          <p class="text-secondary text-sm">AI is parsing your expense</p>
        </div>

        <!-- Confirm State -->
        <div v-else-if="voiceStore.state === 'confirm' && voiceStore.parsedExpenses?.length > 0" class="voice-modal__confirm">
          <div class="voice-modal__transcript">
            <span class="material-symbols-rounded text-primary icon-sm">format_quote</span>
            <p class="text-sm text-secondary">"{{ voiceStore.transcript }}"</p>
          </div>

          <div class="voice-modal__expense-list">
            <div 
              v-for="(expense, index) in voiceStore.parsedExpenses" 
              :key="index" 
              class="voice-modal__expense-card neo-card"
            >
              <div class="flex justify-between items-start mb-sm">
                <label class="text-xs text-tertiary font-medium">Expense #{{ index + 1 }}</label>
                <button 
                  class="text-danger p-xs" 
                  @click="voiceStore.removeParsed(index)"
                  title="Remove this expense"
                >
                  <span class="material-symbols-rounded icon-sm">delete</span>
                </button>
              </div>

              <div class="voice-modal__parsed">
                <!-- Amount -->
                <div class="voice-modal__field">
                  <div class="flex items-center gap-sm">
                    <span class="text-xl font-extrabold" :class="expense.type === 'income' ? 'text-success' : ''">
                      {{ expense.type === 'income' ? '+' : '-' }}
                      GH₵ {{ expense.amount.toFixed(2) }}
                    </span>
                  </div>
                </div>

                <!-- Details grid -->
                <div class="voice-modal__details">
                  <div class="voice-modal__detail-item">
                    <span class="material-symbols-rounded icon-sm text-secondary">category</span>
                    <select
                      :value="expense.category"
                      @change="(e) => voiceStore.updateParsed(index, { category: (e.target as HTMLSelectElement).value })"
                      class="neo-input"
                    >
                      <option v-for="cat in categoriesStore.categoryNames" :key="cat" :value="cat">
                        {{ cat }}
                      </option>
                    </select>
                  </div>

                  <div class="voice-modal__detail-item">
                    <span class="material-symbols-rounded icon-sm text-secondary">store</span>
                    <input
                      :value="expense.merchant"
                      @input="(e) => voiceStore.updateParsed(index, { merchant: (e.target as HTMLInputElement).value })"
                      class="neo-input"
                      placeholder="Merchant"
                    />
                  </div>

                  <div class="voice-modal__detail-item">
                    <span class="material-symbols-rounded icon-sm text-secondary">calendar_today</span>
                    <input
                      type="date"
                      :value="expense.date"
                      @input="(e) => voiceStore.updateParsed(index, { date: (e.target as HTMLInputElement).value })"
                      class="neo-input"
                    />
                  </div>

                  <div class="voice-modal__detail-item">
                    <span class="material-symbols-rounded icon-sm text-secondary">
                      {{ expense.type === 'income' ? 'arrow_downward' : 'arrow_upward' }}
                    </span>
                    <select
                      :value="expense.type"
                      @change="(e) => voiceStore.updateParsed(index, { type: (e.target as HTMLSelectElement).value as 'expense' | 'income' })"
                      class="neo-input"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                </div>
                
                <div class="voice-modal__field mt-xs">
                  <input
                    :value="expense.note"
                    @input="(e) => voiceStore.updateParsed(index, { note: (e.target as HTMLInputElement).value })"
                    class="neo-input"
                    placeholder="Note"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="voice-modal__actions mt-lg">
            <button class="neo-button neo-button--ghost" @click="voiceStore.cancel">Discard All</button>
            <button class="neo-button neo-button--primary" @click="voiceStore.confirmExpense">
              <span class="material-symbols-rounded icon-sm">check_circle</span>
              Save {{ voiceStore.parsedExpenses?.length || 0 }} Expenses
            </button>
          </div>
        </div>

        <!-- Offline Saved State -->
        <div v-else-if="voiceStore.state === 'offline-saved'" class="voice-modal__processing">
          <span class="material-symbols-rounded icon-lg text-primary mb-sm">cloud_done</span>
          <p class="text-lg font-semibold mt-md">Saved Offline</p>
          <p class="text-secondary text-sm">Will sync automatically when online.</p>
        </div>

        <!-- Error State -->
        <div v-else-if="voiceStore.state === 'error'" class="voice-modal__error">
          <span class="material-symbols-rounded icon-lg text-danger">error</span>
          <p class="text-md font-semibold mt-md">Something went wrong</p>
          <p class="text-secondary text-sm">{{ voiceStore.errorMessage }}</p>
          <div class="voice-modal__actions mt-lg">
            <button class="neo-button" @click="voiceStore.reset">Try Again</button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVoiceStore } from '@/stores/voice'
import { useCategoriesStore } from '@/stores/categories'

const voiceStore = useVoiceStore()
const categoriesStore = useCategoriesStore()

const ringStyle = computed(() => {
  const scale = 1 + voiceStore.audioLevel * 0.5
  return {
    transform: `scale(${scale})`,
    opacity: 0.3 + voiceStore.audioLevel * 0.7
  }
})
</script>

<style lang="scss">
.voice-modal {
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
    padding: $space-xl $space-lg;
    padding-bottom: calc($space-xl + #{$safe-area-bottom});
    max-height: 85vh;
    overflow-y: auto;
  }

  &__recording {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: $space-lg 0;
  }

  &__viz {
    position: relative;
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba($danger, 0.2);
    transition: transform 100ms ease, opacity 100ms ease;
  }

  &__mic-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, $danger, #FF6B8A);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    z-index: 1;
    animation: pulse-glow 2s ease-in-out infinite;

    .material-symbols-rounded {
      font-size: 32px;
    }
  }

  &__processing {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: $space-xl 0;
  }

  &__spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--border);
    border-top-color: $primary;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  &__progress-container {
    width: 200px;
    height: 8px;
    background: var(--surface-alt);
    border-radius: 4px;
    overflow: hidden;
    margin: $space-md 0;
  }

  &__progress-bar {
    height: 100%;
    background: $primary;
    transition: width 0.3s ease;
  }

  &__confirm {
    display: flex;
    flex-direction: column;
  }

  &__transcript {
    display: flex;
    align-items: flex-start;
    gap: $space-sm;
    padding: $space-md;
    background: var(--surface-alt);
    border-radius: $radius-md;
    margin-bottom: $space-lg;

    p {
      font-style: italic;
      line-height: 1.4;
    }
  }

  &__expense-list {
    display: flex;
    flex-direction: column;
    gap: $space-md;
    max-height: 50vh;
    overflow-y: auto;
    padding: 4px; // For box shadow visibility
  }

  &__expense-card {
    padding: $space-md;
    border: 1px solid var(--border);
    background: var(--surface);
  }

  &__parsed {
    display: flex;
    flex-direction: column;
    gap: $space-md;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-sm;
  }

  &__detail-item {
    display: flex;
    align-items: center;
    gap: $space-sm;

    .neo-input {
      padding: 8px 12px;
      font-size: $font-size-sm;
    }
  }

  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: $space-lg 0;
  }

  &__actions {
    display: flex;
    gap: $space-md;
    justify-content: center;

    .neo-button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: $space-xs;
      padding: 14px 20px;
    }
  }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba($danger, 0.4); }
  50% { box-shadow: 0 0 20px 8px rgba($danger, 0.15); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
