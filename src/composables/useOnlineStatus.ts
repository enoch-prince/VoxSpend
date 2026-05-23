// ============================================
// Online Status Composable
// ============================================

import { ref, onMounted, onUnmounted } from 'vue';

export function useOnlineStatus() {
  const isOnline = ref(navigator.onLine);
  const lastOnline = ref<Date | null>(navigator.onLine ? new Date() : null);

  const handleOnline = () => {
    isOnline.value = true;
    lastOnline.value = new Date();
  };

  const handleOffline = () => {
    isOnline.value = false;
  };

  onMounted(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  });

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });

  return { isOnline, lastOnline };
}
