<template>
  <div class="auth-view">
    <div class="auth-card">
      <div class="auth-logo">
        <span class="material-symbols-rounded">account_balance_wallet</span>
        <h1>VoxSpend</h1>
      </div>

      <h2 class="auth-title">{{ isSignUp ? 'Create account' : 'Welcome back' }}</h2>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            required
            minlength="8"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button type="submit" class="btn-primary" :disabled="loading">
          <span v-if="loading" class="material-symbols-rounded spin">progress_activity</span>
          <span v-else>{{ isSignUp ? 'Create account' : 'Sign in' }}</span>
        </button>
      </form>

      <button class="auth-toggle" @click="toggleMode">
        {{ isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { useAuthStore } from '@/stores/auth';

  const router = useRouter();
  const authStore = useAuthStore();

  const isSignUp = ref(false);
  const email = ref('');
  const password = ref('');
  const error = ref('');
  const loading = ref(false);

  function toggleMode() {
    isSignUp.value = !isSignUp.value;
    error.value = '';
  }

  async function handleSubmit() {
    error.value = '';
    loading.value = true;
    try {
      if (isSignUp.value) {
        await authStore.signUp(email.value, password.value);
      } else {
        await authStore.signIn(email.value, password.value);
      }
      router.replace('/');
    } catch (err: unknown) {
      error.value =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    } finally {
      loading.value = false;
    }
  }
</script>

<style scoped lang="scss">
  .auth-view {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: var(--bg-primary);
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .auth-logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .material-symbols-rounded {
      font-size: 2rem;
      color: var(--primary);
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }
  }

  .auth-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;

    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    input {
      padding: 0.75rem 1rem;
      border: 1.5px solid var(--border-color);
      border-radius: 10px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 1rem;
      transition: border-color 0.2s;

      &:focus {
        outline: none;
        border-color: var(--primary);
      }
    }
  }

  .auth-error {
    font-size: 0.875rem;
    color: var(--danger, #ef4444);
    padding: 0.5rem 0.75rem;
    background: color-mix(in srgb, var(--danger, #ef4444) 10%, transparent);
    border-radius: 8px;
  }

  .btn-primary {
    width: 100%;
    padding: 0.875rem;
    border-radius: 12px;
    background: var(--primary);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: opacity 0.2s;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .auth-toggle {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.9rem;
    cursor: pointer;
    text-align: center;
    padding: 0.25rem;

    &:hover {
      text-decoration: underline;
    }
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>