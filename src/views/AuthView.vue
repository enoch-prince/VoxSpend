<template>
  <div class="auth-view">
    <div class="auth-container">
      <!-- Logo -->
      <div class="auth-logo">
        <div class="logo-mark">
          <img src="/icons/icon-192.png" alt="VoxSpend" />
        </div>
        <h1>VoxSpend</h1>
        <p><i>Track spending with your voice</i></p>
      </div>

      <!-- Form -->
      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="input-wrapper">
          <span class="material-symbols-rounded field-icon">person</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="Email"
            required
          />
        </div>

        <div class="input-wrapper">
          <span class="material-symbols-rounded field-icon">lock</span>
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="Password"
            required
            minlength="8"
          />
          <button
            type="button"
            class="eye-toggle"
            tabindex="-1"
            @click="showPassword = !showPassword"
          >
            <span class="material-symbols-rounded">
              {{ showPassword ? 'visibility_off' : 'visibility' }}
            </span>
          </button>
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="loading" class="material-symbols-rounded spin">progress_activity</span>
          <span v-else>{{ isSignUp ? 'CREATE ACCOUNT' : 'LOGIN' }}</span>
        </button>

        <button v-if="!isSignUp" type="button" class="btn-forgot" tabindex="-1">
          FORGOT PASSWORD
        </button>
      </form>

      <!-- Divider -->
      <div class="auth-divider">
        <span>Or</span>
      </div>

      <!-- Social buttons -->
      <div class="social-buttons">
        <button type="button" class="btn-social" @click="socialComingSoon">
          <svg class="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>CONTINUE WITH GOOGLE</span>
        </button>

        <button type="button" class="btn-social" @click="socialComingSoon">
          <svg class="social-icon apple-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.33.07 2.25.73 3.03.73.8 0 2.28-.9 3.84-.77.65.03 2.48.26 3.66 1.97-.09.06-2.19 1.28-2.17 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.04 2.1zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="currentColor"/>
          </svg>
          <span>CONTINUE WITH APPLE</span>
        </button>
      </div>

      <!-- Toggle -->
      <p class="auth-toggle">
        {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
        <button type="button" class="toggle-link" @click="toggleMode">
          {{ isSignUp ? 'Sign in' : 'Register here' }}
        </button>
      </p>
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
  const showPassword = ref(false);
  const error = ref('');
  const loading = ref(false);

  function toggleMode() {
    isSignUp.value = !isSignUp.value;
    error.value = '';
  }

  function socialComingSoon() {
    error.value = 'Social login is coming soon.';
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
  @use '@/assets/scss/variables' as *;

  .auth-view {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
    background: var(--bg);
  }

  .auth-container {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  /* ---- Logo ---- */
  .auth-logo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: 0.5rem;

    .logo-mark {
      width: 72px;
      height: 72px;
      border-radius: 18px;
      box-shadow:
        8px 8px 18px rgba($primary, 0.28),
        -6px -6px 14px rgba(255, 255, 255, 0.65);
      overflow: hidden;
      display: flex;

      img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: var(--text);
    }
  }

  /* ---- Form ---- */
  .auth-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    border-radius: $radius-md;
    background: var(--bg);
    box-shadow: var(--neo-inset);
    transition: box-shadow $transition-fast;

    .field-icon {
      position: absolute;
      left: 1rem;
      font-size: 1.25rem;
      color: var(--text-tertiary);
      pointer-events: none;
      user-select: none;
    }

    input {
      width: 100%;
      padding: 0.95rem 3rem 0.95rem 2.875rem;
      border: none;
      background: transparent;
      color: var(--text);
      font-family: $font-family;
      font-size: $font-size-base;
      border-radius: $radius-md;

      &::placeholder {
        color: var(--text-tertiary);
      }

      &:focus {
        outline: none;
      }
    }

    &:focus-within {
      box-shadow:
        var(--neo-inset),
        0 0 0 2px rgba($primary, 0.18);
    }

    .eye-toggle {
      position: absolute;
      right: 0.5rem;
      width: 36px;
      height: 36px;
      background: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      border-radius: 50%;
      transition: color $transition-fast;

      .material-symbols-rounded {
        font-size: 1.25rem;
      }

      &:hover {
        color: var(--text-secondary);
      }
    }
  }

  .auth-error {
    font-size: $font-size-sm;
    color: $danger;
    padding: 0.625rem 0.875rem;
    background: var(--bg);
    box-shadow: var(--neo-inset);
    border-radius: $radius-md;
    text-align: center;
  }

  /* ---- Primary button ---- */
  .btn-login {
    width: 100%;
    padding: 0.95rem;
    border-radius: $radius-md;
    background: linear-gradient(135deg, $primary, $primary-light);
    color: #fff;
    font-family: $font-family;
    font-size: $font-size-base;
    font-weight: 700;
    letter-spacing: 0.08em;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    box-shadow:
      6px 6px 14px rgba($primary, 0.28),
      -4px -4px 10px rgba(255, 255, 255, 0.6);
    transition: all $transition-fast;
    margin-top: 0.25rem;

    &:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    &:not(:disabled):active {
      transform: scale(0.98);
      box-shadow: 3px 3px 8px rgba($primary, 0.25);
    }
  }

  html[data-theme='dark'] .logo-mark {
    box-shadow:
      8px 8px 18px rgba(0, 0, 0, 0.5),
      -6px -6px 14px rgba(255, 255, 255, 0.04);
  }

  html[data-theme='dark'] .btn-login {
    box-shadow:
      6px 6px 14px rgba(0, 0, 0, 0.45),
      -4px -4px 10px rgba(255, 255, 255, 0.03);
  }

  .btn-forgot {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: $font-size-xs;
    font-weight: 700;
    letter-spacing: 0.08em;
    cursor: pointer;
    padding: 0.5rem;
    align-self: center;
    transition: color $transition-fast;

    &:hover {
      color: $primary;
    }
  }

  /* ---- Divider ---- */
  .auth-divider {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    color: var(--text-tertiary);
    font-size: $font-size-sm;

    &::before,
    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
  }

  /* ---- Social buttons (raised neumorphic) ---- */
  .social-buttons {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .btn-social {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
    border: none;
    border-radius: $radius-md;
    background: var(--bg);
    color: var(--text);
    font-family: $font-family;
    font-size: $font-size-sm;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    box-shadow: var(--neo-shadow-sm);
    transition: all $transition-fast;

    &:hover {
      color: $primary;
    }

    &:active {
      box-shadow: var(--neo-inset);
      transform: scale(0.99);
    }

    .social-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;

      &.apple-icon {
        color: var(--text);
      }
    }
  }

  /* ---- Toggle ---- */
  .auth-toggle {
    font-size: $font-size-base;
    color: var(--text-secondary);
    text-align: center;
    margin-top: 0.25rem;

    .toggle-link {
      background: none;
      border: none;
      color: $primary;
      font-family: $font-family;
      font-size: inherit;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
      margin-left: 0.25rem;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  /* ---- Spinner ---- */
  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
