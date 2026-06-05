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

      <form class="verify-form" @submit.prevent="submitCode">
        <div class="input-wrapper">
          <span class="material-symbols-rounded field-icon">key</span>
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            pattern="\d{6}"
            maxlength="6"
            placeholder="000000"
            autocomplete="one-time-code"
            required
          />
        </div>

        <p v-if="error" class="verify-error">{{ error }}</p>
        <p v-if="message" class="verify-message">{{ message }}</p>

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

// Show confirmation message if code was just sent
watch(
  () => authStore.justSentCode,
  (just) => {
    if (just) {
      message.value = '✓ Verification code sent to your email';
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
  loading.value = true;

  try {
    await authStore.verifyEmailOtp(code.value.trim());
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
    message.value = '✓ A new code has been sent to your inbox.';
    setTimeout(() => {
      message.value = '';
    }, 4000);
  } catch (err: unknown) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Could not resend the code. Please try again.';
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

    &::placeholder {
      color: var(--text-tertiary);
    }

    &:focus {
      outline: none;
    }
  }
}

.verify-error,
.verify-message {
  margin: 0;
  color: var(--text-tertiary);
  min-height: 1.25rem;
}

.verify-error {
  color: var(--danger);
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
