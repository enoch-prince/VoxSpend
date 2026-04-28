<template>
  <div class="bottom-nav-wrapper">
    <nav class="bottom-nav glass">
    <div class="bottom-nav__items">
      <router-link
        v-for="item in navItems"
        :key="item.route"
        :to="item.route"
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isActive(item.route) }"
      >
        <span class="material-symbols-rounded">{{ item.icon }}</span>
        <span class="bottom-nav__label">{{ item.label }}</span>
      </router-link>

    </div>
    </nav>

    <!-- Center FAB (Voice) -->
    <button
      class="bottom-nav-fab neo-fab"
      :class="{ 'neo-fab--recording': voiceStore.isRecording }"
      @click="handleFabClick"
      id="voice-fab"
      aria-label="Add by voice"
    >
      <span class="material-symbols-rounded">
        {{ voiceStore.isRecording ? 'stop' : 'mic' }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useVoiceStore } from '@/stores/voice'

const route = useRoute()
const voiceStore = useVoiceStore()

const navItems = [
  { route: '/', icon: 'account_balance_wallet', label: 'Home' },
  { route: '/expenses', icon: 'bar_chart', label: 'Stats' },
  // FAB goes here visually (center)
  { route: '/history', icon: 'history', label: 'History' },
  { route: '/profile', icon: 'account_circle', label: 'Profile' }
]

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function handleFabClick() {
  if (voiceStore.state === 'idle') {
    console.log("Starting recording...");
    voiceStore.startRecording()
  } else if (voiceStore.state === 'recording') {
    voiceStore.stopAndProcess()
    console.log("Processing...")
  }
}
</script>

<style lang="scss">
.bottom-nav-wrapper {
  position: fixed;
  bottom: -3.5rem;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: calc(#{$max-app-width} - 32px);
  z-index: 100;
  overflow: visible;
}

.bottom-nav {
  position: relative;
  width: 100%;
  height: var(--bottom-nav-height);
  padding: 0 $space-sm;
  border-radius: 28px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);

  &__items {
    display: flex;
    align-items: center;
    height: 100%;
    position: relative;
    max-width: 100%;
    overflow: visible;
  }
  
  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-decoration: none;
    color: var(--text-tertiary);
    font-size: $font-size-xs;
    transition: all $transition-fast;
    height: 100%;
    position: relative;
    padding-top: 8px; // Push icons down slightly to clear the notch area if needed
    
    .material-symbols-rounded {
      font-size: 24px;
      transition: transform $transition-fast;
    }

    &--active {
      color: $primary;
      
      .material-symbols-rounded {
        transform: scale(1.1);
      }
    }

    // Create a gap for the center FAB
    &:nth-child(2) {
      margin-right: 40px;
    }
    &:nth-child(3) {
      margin-left: 40px;
    }
  }

  &__label {
    font-weight: 500;
  }


}

.bottom-nav-fab {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -150%);
  z-index: 110;
  width: 64px !important;
  height: 64px !important;
  border: 1.5px solid var(--bg) !important;
  box-shadow: 0 10px 25px rgba($primary, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.3) !important;
  background: linear-gradient(135deg, $primary, $primary-light) !important;
  display: flex !important;
  // align-items: center;
  // justify-content: center;
  
  .material-symbols-rounded {
    font-size: 32px !important;
  }
}

// Add the notch to the glass bar
.bottom-nav.glass {
  -webkit-mask-image: radial-gradient(circle at 50% 0, transparent 48px, black 49px);
  mask-image: radial-gradient(circle at 50% 0, transparent 48px, black 49px);
}
</style>
