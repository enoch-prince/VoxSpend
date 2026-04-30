<template>
  <div class="feedback-view overflow-y-auto h-full">
    <div class="px-lg py-md">
      <header class="mb-lg flex items-center gap-md">
        <button class="neo-button neo-button--ghost" style="padding: 8px;" @click="$router.back()">
          <span class="material-symbols-rounded">arrow_back</span>
        </button>
        <h1 class="text-xl font-bold">Send Feedback</h1>
      </header>

      <div v-if="feedbackStore.isSuccess" class="neo-card flex flex-col items-center text-center py-xl">
        <div class="success-icon mb-lg">
          <span class="material-symbols-rounded text-success" style="font-size: 64px;">check_circle</span>
        </div>
        <h2 class="text-lg font-bold mb-sm">Thank You!</h2>
        <p class="text-secondary text-sm mb-lg">
          Your feedback has been submitted as a GitHub Issue. We'll look into it soon!
        </p>
        <button class="neo-button neo-button--primary w-full" @click="$router.back()">
          Back to Profile
        </button>
      </div>

      <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-lg">
        <!-- Category Selection -->
        <div class="flex flex-col gap-sm">
          <label class="text-xs font-semibold text-secondary uppercase px-xs">I want to report a...</label>
          <div class="flex flex-wrap gap-sm">
            <button 
              type="button"
              v-for="cat in categories" 
              :key="cat.id"
              class="neo-chip"
              :class="{ 'neo-chip--active': form.type === cat.id }"
              @click="form.type = cat.id"
            >
              <span class="material-symbols-rounded icon-sm">{{ cat.icon }}</span>
              {{ cat.name }}
            </button>
          </div>
        </div>

        <!-- Message -->
        <div class="flex flex-col gap-sm">
          <label class="text-xs font-semibold text-secondary uppercase px-xs">Message</label>
          <textarea 
            v-model="form.message"
            class="neo-input" 
            rows="5" 
            placeholder="Tell us what's on your mind..."
            required
          ></textarea>
        </div>

        <!-- Email -->
        <div class="flex flex-col gap-sm">
          <label class="text-xs font-semibold text-secondary uppercase px-xs">Email (Optional)</label>
          <input 
            v-model="form.email"
            type="email" 
            class="neo-input" 
            placeholder="your@email.com"
          />
          <p class="text-xs text-tertiary px-xs">Provide an email if you'd like us to follow up with you.</p>
        </div>

        <!-- Metadata Info -->
        <div class="neo-card-flat">
          <p class="text-xs text-tertiary mb-xs flex items-center gap-xs">
            <span class="material-symbols-rounded icon-sm">info</span>
            The following info will be sent to help us debug:
          </p>
          <p class="text-xs text-tertiary">
            App Version: v0.1.0 • {{ getDeviceInfo() }}
          </p>
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          class="neo-button neo-button--primary py-md mt-md"
          :disabled="feedbackStore.isSubmitting || !form.message.trim()"
        >
          <span v-if="feedbackStore.isSubmitting">Submitting...</span>
          <span v-else>Submit Feedback</span>
        </button>

        <p v-if="feedbackStore.lastError" class="text-xs text-danger text-center font-medium">
          {{ feedbackStore.lastError }}
        </p>
      </form>

      <div style="height: 40px;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFeedbackStore, type FeedbackType } from '@/stores/feedback'

const feedbackStore = useFeedbackStore()

const categories: { id: FeedbackType; name: string; icon: string }[] = [
  { id: 'bug', name: 'Bug Report', icon: 'bug_report' },
  { id: 'feature', name: 'Feature Request', icon: 'add_circle' },
  { id: 'improvement', name: 'Improvement', icon: 'auto_awesome' },
  { id: 'general', name: 'General', icon: 'chat' }
]

const form = reactive({
  type: 'bug' as FeedbackType,
  message: '',
  email: ''
})

onMounted(() => {
  feedbackStore.resetStatus()
})

function getDeviceInfo() {
  const ua = navigator.userAgent
  let device = 'Unknown Device'
  if (/android/i.test(ua)) device = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) device = 'iOS'
  else if (/windows/i.test(ua)) device = 'Windows'
  else if (/macintosh/i.test(ua)) device = 'MacOS'
  
  return `${device} • ${window.innerWidth}x${window.innerHeight}`
}

async function handleSubmit() {
  if (!form.message.trim()) return

  await feedbackStore.submitFeedback({
    type: form.type,
    message: form.message,
    email: form.email,
    metadata: {
      version: '0.1.0',
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString()
    }
  })
}
</script>

<style lang="scss" scoped>
.feedback-view {
  textarea {
    resize: none;
  }
}

.success-icon {
  animation: scaleUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes scaleUp {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
