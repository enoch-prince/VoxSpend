// ============================================
// Vue Router Configuration
// ============================================

import { createRouter, createWebHistory } from 'vue-router';

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
      path: '/feedback',
      name: 'feedback',
      component: () => import('@/views/FeedbackView.vue'),
      meta: { title: 'Feedback — VoxSpend' },
    },
  ],
});

// Splash gate — resets on every page load, so the intro slides show as the
// first screen each time the app opens, regardless of auth or prior visits.
// let introShownThisLoad = false;

router.beforeEach((to) => {
  const token = localStorage.getItem('voxspend-auth-token');
  const isPublicRoute = to.meta.public === true;

  // 1. Splash — first navigation of every fresh load goes through the intro
  // if (!introShownThisLoad) {
  //   introShownThisLoad = true;
  //   if (to.name !== 'onboarding') return { name: 'onboarding' };
  // }

  // 2. Already signed in — don't show /auth again
  if (token && to.name === 'auth') {
    return { name: 'dashboard' };
  }

  // 3. Auth check — redirect unauthenticated users to /auth
  if (!token && !isPublicRoute) {
    return { name: 'auth' };
  }

  // 4. Setup check — signed in but hasn't configured profile yet
  if (token && !isPublicRoute) {
    const stored = localStorage.getItem('voxspend-user');
    let isSetup = false;
    try {
      if (stored) isSetup = JSON.parse(stored).onboardingComplete === true;
    } catch {
      /* ignore */
    }
    if (!isSetup && to.name !== 'setup') {
      return { name: 'setup' };
    }
  }

  if (to.meta.title) {
    document.title = to.meta.title as string;
  }
});

export default router;