<template>
  <div class="verify-email-view">
    <div class="verify-container">
      <div class="verify-hero">
        <div class="hero-badge" aria-hidden="true">
          <span class="material-symbols-rounded">mark_email_read</span>
        </div>
      </div>

      <div class="verify-header">
        <h1>OTP Verification</h1>
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

        <div
          class="otp-group"
          :class="{ 'has-error': !!error, 'is-loading': loading }"
          role="group"
          aria-label="Verification code"
        >
          <input
            v-for="(digit, index) in digits"
            :key="index"
            :ref="(el) => setInputRef(el as Element | null, index)"
            :value="digit"
            type="text"
            inputmode="numeric"
            pattern="\d"
            maxlength="1"
            class="otp-box"
            :class="{ filled: !!digit }"
            :autocomplete="index === 0 ? 'one-time-code' : 'off'"
            :aria-label="`Digit ${index + 1} of ${digits.length}`"
            :disabled="loading"
            @input="(e) => onDigitInput(e, index)"
            @keydown="(e) => onDigitKeydown(e, index)"
            @paste="(e) => onDigitPaste(e, index)"
            @focus="(e) => (e.target as HTMLInputElement).select()"
          />
        </div>

        <button type="submit" class="btn-verify" :disabled="loading">
          <span v-if="loading" class="material-symbols-rounded spin">progress_activity</span>
          <span v-else>VERIFY</span>
        </button>
      </form>

      <p class="resend-prompt">
        <span>Didn't get the code?</span>
        <button
          type="button"
          class="resend-link"
          @click="resendCode"
          :disabled="resendLoading || cooldown > 0"
        >
          <template v-if="resendLoading">
            <span class="material-symbols-rounded spin">progress_activity</span>
            <span>Sending…</span>
          </template>
          <span v-else-if="cooldown > 0">Resend in {{ cooldown }}s</span>
          <span v-else>Resend code</span>
        </button>
      </p>

      <button type="button" class="change-email-link" @click="changeEmail">
        Wrong email? Use a different one
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

const digits = ref<string[]>(Array.from({ length: OTP_LENGTH }, () => ''));
const inputRefs: HTMLInputElement[] = [];
const error = ref('');
const message = ref('');
const loading = ref(false);
const resendLoading = ref(false);
const cooldown = ref(0);

function setInputRef(el: Element | null, index: number) {
  if (el instanceof HTMLInputElement) inputRefs[index] = el;
}

function focusInput(index: number) {
  const el = inputRefs[Math.max(0, Math.min(OTP_LENGTH - 1, index))];
  el?.focus();
  el?.select();
}

function resetDigits(focusFirst = true) {
  digits.value = Array.from({ length: OTP_LENGTH }, () => '');
  if (focusFirst) nextTick(() => focusInput(0));
}

function fillFrom(startIndex: number, chars: string) {
  const next = [...digits.value];
  let i = startIndex;
  for (const ch of chars) {
    if (i >= OTP_LENGTH) break;
    next[i++] = ch;
  }
  digits.value = next;
  return i; // index of next empty slot (may be OTP_LENGTH)
}

function onDigitInput(event: Event, index: number) {
  clearError();
  const target = event.target as HTMLInputElement;
  const raw = target.value;
  const filtered = raw.replace(/\D/g, '');

  if (filtered.length === 0) {
    // Non-digit typed (e.g. letter). Restore from state.
    target.value = digits.value[index] ?? '';
    return;
  }

  if (filtered.length === 1) {
    const next = [...digits.value];
    next[index] = filtered;
    digits.value = next;
    target.value = filtered;
    if (index < OTP_LENGTH - 1) focusInput(index + 1);
    return;
  }

  // Multi-char input (autofill, IME, fast typing). Distribute across boxes.
  const landed = fillFrom(index, filtered);
  nextTick(() => focusInput(Math.min(landed, OTP_LENGTH - 1)));
}

function onDigitKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'Backspace') {
    if (digits.value[index]) {
      const next = [...digits.value];
      next[index] = '';
      digits.value = next;
    } else if (index > 0) {
      const next = [...digits.value];
      next[index - 1] = '';
      digits.value = next;
      focusInput(index - 1);
    }
    event.preventDefault();
  } else if (event.key === 'ArrowLeft' && index > 0) {
    focusInput(index - 1);
    event.preventDefault();
  } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
    focusInput(index + 1);
    event.preventDefault();
  } else if (event.key === 'Enter') {
    if (digits.value.every((d) => d !== '')) submitCode();
  }
}

function onDigitPaste(event: ClipboardEvent, index: number) {
  const pasted = event.clipboardData?.getData('text') ?? '';
  const filtered = pasted.replace(/\D/g, '');
  if (!filtered) return;
  event.preventDefault();
  clearError();
  const landed = fillFrom(index, filtered);
  nextTick(() => focusInput(Math.min(landed, OTP_LENGTH - 1)));
}

let cooldownTimer: ReturnType<typeof setInterval> | null = null;

function startCooldown(seconds = RESEND_COOLDOWN_SECONDS) {
  cooldown.value = seconds;
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 1000);
}

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});

function clearError() {
  if (error.value) error.value = '';
}

async function changeEmail() {
  await authStore.signOut();
  await router.replace({ name: 'auth' });
}

// Show confirmation message if code was just sent
watch(
  () => authStore.justSentCode,
  (just) => {
    if (just) {
      message.value = 'Verification code sent to your email.';
      authStore.justSentCode = false;
      startCooldown();
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
  if (loading.value) return;
  error.value = '';
  message.value = '';

  const joined = digits.value.join('');
  if (joined.length !== OTP_LENGTH || !/^\d{6}$/.test(joined)) {
    error.value = 'Please enter the 6-digit code from your email.';
    return;
  }

  loading.value = true;

  try {
    await authStore.verifyEmailOtp(joined);
    message.value = 'Email verified successfully.';
    await navigateAfterVerify();
  } catch (err: unknown) {
    error.value =
      err instanceof Error ? err.message : 'Verification failed. Please try again.';
    resetDigits();
  } finally {
    loading.value = false;
  }
}

// Auto-submit when all 6 digits are filled
watch(
  digits,
  (next) => {
    if (next.every((d) => d !== '') && !loading.value) {
      submitCode();
    }
  },
  { deep: true },
);

async function resendCode() {
  error.value = '';
  message.value = '';
  resendLoading.value = true;

  try {
    await authStore.resendEmailVerification();
    message.value = 'A new code has been sent to your inbox.';
    startCooldown();
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

  if (authStore.justSentCode) {
    message.value = 'Verification code sent to your email.';
    authStore.justSentCode = false;
    startCooldown();
    setTimeout(() => {
      message.value = '';
    }, 4000);
  }

  await authStore.fetchEmailVerificationStatus();
  if (authStore.emailVerified) {
    await navigateAfterVerify();
    return;
  }

  nextTick(() => focusInput(0));
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
  gap: 1.25rem;
}

.verify-hero {
  display: flex;
  justify-content: center;
  margin-bottom: 0.25rem;
}

.hero-badge {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $primary, $primary-light);
  color: #fff;
  box-shadow:
    8px 8px 20px rgba($primary, 0.32),
    -6px -6px 14px rgba(255, 255, 255, 0.65);

  .material-symbols-rounded {
    font-size: 48px;
  }
}

html[data-theme='dark'] .hero-badge {
  box-shadow:
    8px 8px 20px rgba(0, 0, 0, 0.5),
    -6px -6px 14px rgba(255, 255, 255, 0.04);
}

.verify-header {
  text-align: center;

  h1 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--text);
  }

  p {
    margin: 0.5rem 0 0;
    color: var(--text-tertiary);
    line-height: 1.5;
  }
}

.verify-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.otp-group {
  display: flex;
  justify-content: space-between;
  gap: 0.625rem;

  &.is-loading {
    opacity: 0.7;
  }
}

.otp-box {
  flex: 1 1 0;
  min-width: 0;
  height: 52px;
  padding: 0;
  border: none;
  border-radius: $radius-md;
  background: var(--bg);
  color: var(--text);
  font-family: $font-family;
  font-size: 1.375rem;
  font-weight: 600;
  text-align: center;
  box-shadow: var(--neo-inset);
  transition:
    box-shadow $transition-fast,
    color $transition-fast;
  caret-color: $primary;

  &:focus {
    outline: none;
    box-shadow:
      var(--neo-inset),
      0 0 0 2px rgba($primary, 0.35);
  }

  &.filled {
    color: $primary;
    box-shadow:
      var(--neo-inset),
      inset 0 0 0 1.5px rgba($primary, 0.35);
  }

  &.filled:focus {
    box-shadow:
      var(--neo-inset),
      inset 0 0 0 1.5px rgba($primary, 0.35),
      0 0 0 2px rgba($primary, 0.35);
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.otp-group.has-error .otp-box {
  box-shadow:
    var(--neo-inset),
    0 0 0 1.5px rgba($danger, 0.7);
  color: $danger;

  &:focus {
    box-shadow:
      var(--neo-inset),
      0 0 0 2px rgba($danger, 0.7);
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

.btn-verify {
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

html[data-theme='dark'] .btn-verify {
  box-shadow:
    6px 6px 14px rgba(0, 0, 0, 0.45),
    -4px -4px 10px rgba(255, 255, 255, 0.03);
}

.resend-prompt {
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.35rem;
  font-size: $font-size-sm;
  color: var(--text-secondary);
}

.resend-link {
  background: none;
  border: none;
  padding: 0;
  font-family: $font-family;
  font-size: inherit;
  font-weight: 600;
  color: $primary;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: color $transition-fast;

  .material-symbols-rounded {
    font-size: 1em;
  }

  &:not(:disabled):hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:disabled {
    color: var(--text-tertiary);
    cursor: not-allowed;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spin {
  animation: spin 1s linear infinite;
}

.change-email-link {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-family: $font-family;
  font-size: $font-size-sm;
  cursor: pointer;
  padding: 0.5rem;
  align-self: center;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color $transition-fast;

  &:hover {
    color: $primary;
  }
}
</style>
