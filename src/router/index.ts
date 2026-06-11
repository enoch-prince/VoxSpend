// ============================================
// Vue Router Configuration
// ============================================

import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';

const ONBOARDING_SHOWN_KEY = 'voxspend-onboarding-shown';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/views/AuthView.vue'),
      meta: { title: 'Sign in — VoxSpend', hideNav: true, public: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: 'VoxSpend' },
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: () => import('@/views/ExpensesView.vue'),
      meta: { title: 'Expenses — VoxSpend' },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/HistoryView.vue'),
      meta: { title: 'History — VoxSpend' },
    },
    {
      path: '/history/:id',
      name: 'transaction-detail',
      component: () => import('@/views/TransactionDetailView.vue'),
      meta: { title: 'Transaction — VoxSpend' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      meta: { title: 'Profile — VoxSpend' },
    },
    {
      path: '/momo',
      name: 'momo',
      component: () => import('@/views/MomoLinkView.vue'),
      meta: { title: 'Mobile Money — VoxSpend' },
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingView.vue'),
      meta: { title: 'Welcome — VoxSpend', hideNav: true, public: true },
    },
    {
      path: '/setup',
      name: 'setup',
      component: () => import('@/views/SetupView.vue'),
      meta: { title: 'Setup — VoxSpend', hideNav: true },
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('@/views/VerifyEmailView.vue'),
      meta: { title: 'Verify Email — VoxSpend', hideNav: true },
    },
    {
      path: '/feedback',
      name: 'feedback',
      component: () => import('@/views/FeedbackView.vue'),
      meta: { title: 'Feedback — VoxSpend' },
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const userStore = useUserStore();

  if (!authStore.isInitialized) {
    authStore.initialize();
  }

  if (authStore.isAuthenticated && !authStore.currentUserId) {
    await authStore.resolveUserId();
  }

  if (
    authStore.isAuthenticated &&
    authStore.currentUserId &&
    authStore.emailVerified === null
  ) {
    await authStore.fetchEmailVerificationStatus();
  }

  const isAuthenticated = authStore.isAuthenticated && !!authStore.currentUserId;
  const isVerified = authStore.emailVerified === true;
  const isPublicRoute = to.meta.public === true;
  const onboardingShown = localStorage.getItem(ONBOARDING_SHOWN_KEY) === 'true';

  // 0. Anyone who reaches authenticated state has graduated past the intro —
  // mark it shown so existing users (and re-signs-in) never see it again.
  if (isAuthenticated && !onboardingShown) {
    localStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
  }

  // 1. Already signed in — don't show /auth again
  if (isAuthenticated && to.name === 'auth') {
    return { name: isVerified ? 'dashboard' : 'verify-email' };
  }

  // 2a. First-time, unauthenticated visitors see the onboarding carousel
  // before /auth. Once they finish or skip it, OnboardingView sets the flag.
  if (!isAuthenticated && !onboardingShown && to.name !== 'onboarding') {
    return { name: 'onboarding' };
  }

  // 2b. Returning unauthenticated visitors go straight to /auth.
  if (!isAuthenticated && onboardingShown && to.name === 'onboarding') {
    return { name: 'auth' };
  }

  // 2c. Auth check — redirect unauthenticated users to /auth
  if (!isAuthenticated && !isPublicRoute) {
    return { name: 'auth' };
  }

  // 3. Email verification gate — keep authenticated users on the verify page
  if (isAuthenticated && !isVerified && to.name !== 'verify-email') {
    return { name: 'verify-email' };
  }

  if (isAuthenticated && isVerified && to.name === 'verify-email') {
    return { name: 'dashboard' };
  }

  // 4. Setup check — signed in but hasn't configured profile yet
  if (
    isAuthenticated &&
    isVerified &&
    !isPublicRoute &&
    !userStore.isSetup &&
    to.name !== 'setup'
  ) {
    return { name: 'setup' };
  }

  if (to.meta.title) {
    document.title = to.meta.title as string;
  }
});

export default router;