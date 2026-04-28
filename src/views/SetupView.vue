<template>
  <div class="setup h-full overflow-y-auto">
    <div class="setup__content px-lg py-xl">
      <div class="setup__header mb-xl">
        <h1 class="text-2xl font-extrabold">Set up VoxSpend</h1>
        <p class="text-sm text-secondary mt-xs">Just a few details to get started</p>
      </div>

      <!-- Name -->
      <div class="setup__field mb-lg">
        <label class="text-sm font-semibold mb-xs" style="display:block;">Your Name</label>
        <input v-model="name" class="neo-input" placeholder="e.g. Kwame Asante" id="setup-name" />
      </div>

      <!-- API Key -->
      <div class="setup__field mb-lg">
        <label class="text-sm font-semibold mb-xs" style="display:block;">Groq API Key</label>
        <p class="text-xs text-tertiary mb-sm">
          Required for voice features. Get a free key at
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener" class="text-primary">console.groq.com</a>
        </p>
        <div class="flex gap-sm">
          <input
            v-model="apiKey"
            :type="showKey ? 'text' : 'password'"
            class="neo-input flex-1"
            placeholder="gsk_..."
            id="setup-api-key"
          />
          <button class="neo-button neo-button--ghost" @click="showKey = !showKey" style="padding:8px 12px;">
            <span class="material-symbols-rounded icon-sm">{{ showKey ? 'visibility_off' : 'visibility' }}</span>
          </button>
        </div>
      </div>

      <!-- Validation hint -->
      <div v-if="validationError" class="setup__error mb-md">
        <span class="material-symbols-rounded icon-sm">warning</span>
        <span class="text-sm">{{ validationError }}</span>
      </div>

      <!-- Submit -->
      <button
        class="neo-button neo-button--primary w-full"
        style="padding:16px;font-size:16px;"
        @click="handleSubmit"
        :disabled="!canSubmit"
        id="setup-submit"
      >
        Start Tracking
      </button>

      <p class="text-xs text-tertiary mt-lg" style="text-align:center;">
        Your API key is stored locally on your device and never shared.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const name = ref('')
const apiKey = ref('')
const showKey = ref(false)
const validationError = ref('')

const canSubmit = computed(() => name.value.trim().length >= 2 && apiKey.value.trim().length > 10)

function handleSubmit() {
  validationError.value = ''

  if (name.value.trim().length < 2) {
    validationError.value = 'Please enter your name'
    return
  }

  if (!apiKey.value.trim().startsWith('gsk_')) {
    validationError.value = 'API key should start with gsk_'
    return
  }

  userStore.completeOnboarding(name.value.trim(), apiKey.value.trim())
  router.replace('/')
}
</script>

<style lang="scss">
.setup {
  background: var(--bg);

  &__content {
    max-width: 360px;
    margin: 0 auto;
  }

  &__error {
    display: flex;
    align-items: center;
    gap: $space-sm;
    padding: $space-md;
    background: rgba($danger, 0.1);
    border-radius: $radius-md;
    color: $danger;
    font-size: $font-size-sm;
  }
}
</style>
