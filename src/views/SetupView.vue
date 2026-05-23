<template>
  <div class="setup h-full overflow-y-auto">
    <div class="setup__content px-lg py-xl">
      <div class="setup__header mb-xl">
        <h1 class="text-2xl font-extrabold">Set up VoxSpend</h1>
        <p class="text-sm text-secondary mt-xs">Just a few details to get started</p>
      </div>

      <!-- Name -->
      <div class="setup__field mb-lg">
        <label class="text-sm font-semibold mb-xs" style="display: block">Your Name</label>
        <input v-model="name" class="neo-input" placeholder="e.g. Kwame Asante" id="setup-name" />
      </div>

      <!-- Submit -->
      <button
        class="neo-button neo-button--primary w-full"
        style="padding: 16px; font-size: 16px"
        @click="handleSubmit"
        :disabled="!canSubmit"
        id="setup-submit"
      >
        Start Tracking
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { useUserStore } from '@/stores/user';

  const router = useRouter();
  const userStore = useUserStore();

  const name = ref('');
  const validationError = ref('');

  const canSubmit = computed(() => name.value.trim().length >= 2);

  function handleSubmit() {
    validationError.value = '';

    if (name.value.trim().length < 2) {
      validationError.value = 'Please enter your name';
      return;
    }

    userStore.completeOnboarding(name.value.trim(), '');
    router.replace('/');
  }
</script>

<style lang="scss">
  .setup {
    background: var(--bg);
    display: flex;
    flex-direction: column;
    align-content: center;
    flex-wrap: wrap;
    justify-content: center;

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
