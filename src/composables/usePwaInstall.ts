// ============================================
// PWA Install Composable
// ============================================

import { ref, onMounted, onUnmounted } from 'vue'

export function usePwaInstall() {
  const deferredPrompt = ref<any>(null)
  const canInstall = ref(false)

  const handleBeforeInstallPrompt = (e: Event) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault()
    // Stash the event so it can be triggered later.
    deferredPrompt.value = e
    // Update UI notify the user they can install the PWA
    canInstall.value = true
  }

  const promptInstall = async () => {
    if (!deferredPrompt.value) return

    // Show the install prompt
    deferredPrompt.value.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.value.userChoice

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
    } else {
      console.log('User dismissed the install prompt')
    }

    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt.value = null
    canInstall.value = false
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  })

  return { canInstall, promptInstall }
}
