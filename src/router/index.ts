// ============================================
// Vue Router Configuration
// ============================================

import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
      meta: { title: 'Welcome — VoxSpend', hideNav: true },
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

// Navigation guard: redirect to onboarding if not setup
router.beforeEach((to) => {
  const stored = localStorage.getItem('voxspend-user');
  let isSetup = false;
  try {
    if (stored) {
      isSetup = JSON.parse(stored).onboardingComplete === true;
    }
  } catch {
    /* ignore */
  }

  if (!isSetup && to.name !== 'onboarding' && to.name !== 'setup') {
    return { name: 'onboarding' };
  }

  // Update page title
  if (to.meta.title) {
    document.title = to.meta.title as string;
  }
});

export default router;
