<template>
  <div class="onboarding h-full flex flex-col">
    <div class="onboarding__slides flex-1 flex items-center justify-center px-lg">
      <transition name="page" mode="out-in">
        <div :key="currentSlide" class="onboarding__slide">
          <div class="onboarding__icon-wrap" :style="{ background: slides[currentSlide].bg }">
            <span class="material-symbols-rounded" style="font-size:48px;color:#fff;">
              {{ slides[currentSlide].icon }}
            </span>
          </div>
          <h2 class="text-xl font-bold mt-lg">{{ slides[currentSlide].title }}</h2>
          <p class="text-sm text-secondary mt-sm" style="max-width:280px;">
            {{ slides[currentSlide].desc }}
          </p>
        </div>
      </transition>
    </div>

    <!-- Dots -->
    <div class="onboarding__dots flex justify-center gap-sm mb-lg">
      <div
        v-for="(_, i) in slides"
        :key="i"
        class="onboarding__dot"
        :class="{ 'onboarding__dot--active': i === currentSlide }"
        @click="currentSlide = i"
      ></div>
    </div>

    <!-- Actions -->
    <div class="onboarding__actions px-lg mb-md">
      <button
        v-if="currentSlide < slides.length - 1"
        class="neo-button neo-button--primary w-full"
        style="padding:16px;font-size:16px;"
        @click="currentSlide++"
      >
        Next
      </button>
      <button
        v-else
        class="neo-button neo-button--primary w-full"
        style="padding:16px;font-size:16px;"
        @click="$router.push('/setup')"
      >
        Get Started
      </button>
      <button
        v-if="currentSlide < slides.length - 1"
        class="neo-button neo-button--ghost w-full mt-sm"
        @click="$router.push('/setup')"
      >
        Skip
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const currentSlide = ref(0)

const slides = [
  {
    icon: 'mic',
    title: 'Track with your voice',
    desc: 'Just speak naturally — "I spent 20 cedis on lunch at Papaye" — and VoxSpend handles the rest.',
    bg: 'linear-gradient(135deg, #2D7FF9, #5B9DFC)'
  },
  {
    icon: 'psychology',
    title: 'AI-powered parsing',
    desc: 'Groq AI instantly transcribes and structures your expenses into categories, amounts, and merchants.',
    bg: 'linear-gradient(135deg, #8B5CF6, #A78BFA)'
  },
  {
    icon: 'cloud_off',
    title: 'Works offline',
    desc: 'Your data is stored locally first. Everything syncs when you\'re back online. No data loss, ever.',
    bg: 'linear-gradient(135deg, #10B981, #34D399)'
  }
]
</script>

<style lang="scss">
.onboarding {
  background: var(--bg);

  &__slide {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  &__icon-wrap {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 30px rgba(45, 127, 249, 0.25);
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
    cursor: pointer;
    transition: all $transition-fast;

    &--active {
      width: 24px;
      border-radius: 4px;
      background: $primary;
    }
  }
}
</style>
