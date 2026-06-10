<template>
  <div class="verify-email-view">
    <div class="verify-container">
      <div class="verify-header">
        <h1>Verify your email</h1>
        <p>
          Enter the 6-digit code sent to
          <strong>{{ authStore.verificationEmail || 'your email address' }}</strong>.
        </p>
      </div>

      <form class="verify-form" @submit.prevent="submitCode" novalidate>
        <p v-if="error" class="verify-error" role="alert">
          <span class="material-symbols-rounded error-icon">error</span>
          <span>{{ error }}</span>
        </p>
        <p v-if="message" class="verify-message" role="status">
          <span class="material-symbols-rounded success-icon">check_circle</span>
          <span>{{ message }}</span>
        </p>

        <div class="input-wrapper" :class="{ 'has-error': !!error }">
          <span class="material-symbols-rounded field-icon">key</span>
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            pattern="\d{6}"
            maxlength="6"
            placeholder="000000"
            autocomplete="one-time-code"
            @input="clearError"
          />
        </div>

        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="loading" class="material-symbols-rounded spin">progress_activity</span>
          <span v-else>VERIFY EMAIL</span>
        </button>
      </form>

      <button
        type="button"
        class="btn-resend"
        @click="resendCode"
        :disabled="resendLoading"
      >
        <span v-if="resendLoading" class="material-symbols-rounded spin">progress_activity</span>
        <span v-else>Resend code</span>
      </button>

      <p class="verify-note">
        If you don't see the email, check your spam folder or request a new code.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();

const code = ref('');
const error = ref('');
const message = ref('');
const loading = ref(false);
const resendLoading = ref(false);

function clearError() {
  if (error.value) error.value = '';
}

// Show confirmation message if code was just sent
watch(
  () => authStore.justSentCode,
  (just) => {
    if (just) {
      message.value = 'Verification code sent to your email.';
      authStore.justSentCode = false;
      setTimeout(() => {
        message.value = '';
      }, 4000);
    }
  },
);

async function navigateAfterVerify() {
  if (userStore.isSetup) {
    await router.replace({ name: 'dashboard' });
  } else {
    await router.replace({ name: 'setup' });
  }
}

async function submitCode() {
  error.value = '';
  message.value = '';

  const trimmed = code.value.trim();
  if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
    error.value = 'Please enter the 6-digit code from your email.';
    return;
  }

  loading.value = true;

  try {
    await authStore.verifyEmailOtp(trimmed);
    message.value = 'Email verified successfully.';
    await navigateAfterVerify();
  } catch (err: unknown) {
    error.value =
      err instanceof Error ? err.message : 'Verification failed. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function resendCode() {
  error.value = '';
  message.value = '';
  resendLoading.value = true;

  try {
    await authStore.resendEmailVerification();
    message.value = 'A new code has been sent to your inbox.';
    setTimeout(() => {
      message.value = '';
    }, 4000);
  } catch (err: unknown) {
    error.value =
      err instanceof Error
        ? err.message
        : "Couldn't resend the code. Please try again.";
  } finally {
    resendLoading.value = false;
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await router.replace({ name: 'auth' });
    return;
  }

  if (authStore.emailVerified) {
    await navigateAfterVerify();
    return;
  }

  await authStore.fetchEmailVerificationStatus();
  if (authStore.emailVerified) {
    await navigateAfterVerify();
  }
});
</script>

<style scoped lang="scss">
@use '@/assets/scss/variables' as *;

.verify-email-view {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  background: var(--bg);
}

.verify-container {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.verify-header {
  text-align: center;

  h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text);
  }

  p {
    margin: 0.75rem 0 0;
    color: var(--text-tertiary);
    line-height: 1.5;
  }
}

.verify-form {
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

  .field-icon {
    position: absolute;
    left: 1rem;
    font-size: 1.25rem;
    color: var(--text-tertiary);
  }

  input {
    width: 100%;
    padding: 0.95rem 1rem 0.95rem 3rem;
    border: none;
    background: transparent;
    color: var(--text);
    font-family: $font-family;
    font-size: $font-size-base;
    border-radius: $radius-md;
    letter-spacing: 0.4em;

    &::placeholder {
      color: var(--text-tertiary);
      letter-spacing: 0.2em;
    }

    &:focus {
      outline: none;
    }
  }

  &.has-error {
    box-shadow:
      var(--neo-inset),
      0 0 0 1.5px rgba($danger, 0.7);

    .field-icon {
      color: $danger;
    }
  }
}

.verify-error,
.verify-message {
  margin: 0;
  padding: 0.625rem 0.875rem;
  font-size: $font-size-sm;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  line-height: 1.35;

  .error-icon,
  .success-icon {
    font-size: 1.125rem;
    flex-shrink: 0;
  }
}

.verify-error {
  color: $danger;
  background: rgba($danger, 0.08);
  border: 1px solid rgba($danger, 0.25);
}

.verify-message {
  color: $success;
  background: rgba($success, 0.08);
  border: 1px solid rgba($success, 0.25);
}

html[data-theme='dark'] {
  .verify-error {
    background: rgba($danger, 0.12);
    border-color: rgba($danger, 0.35);
  }
  .verify-message {
    background: rgba($success, 0.12);
    border-color: rgba($success, 0.35);
  }
}

.btn-login,
.btn-resend {
  width: 100%;
}

.verify-note {
  margin: 0;
  text-align: center;
  color: var(--text-tertiary);
}
</style>
