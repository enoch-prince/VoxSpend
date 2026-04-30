import { defineStore } from 'pinia'
import { ref } from 'vue'

export type FeedbackType = 'bug' | 'feature' | 'improvement' | 'general'

export interface FeedbackData {
  type: FeedbackType
  message: string
  email?: string
  metadata: {
    version: string
    userAgent: string
    screenSize: string
    timestamp: string
  }
}

export const useFeedbackStore = defineStore('feedback', () => {
  const isSubmitting = ref(false)
  const lastError = ref<string | null>(null)
  const isSuccess = ref(false)

  async function submitFeedback(data: FeedbackData) {
    isSubmitting.value = true
    lastError.value = null
    isSuccess.value = false

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        let errorMessage = 'Failed to submit feedback'
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } else {
          errorMessage = `Server error: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      isSuccess.value = true
    } catch (err: any) {
      console.error('Feedback submission error:', err)
      lastError.value = err.message || 'An unexpected error occurred'
    } finally {
      isSubmitting.value = false
    }
  }

  function resetStatus() {
    isSuccess.value = false
    lastError.value = null
  }

  return {
    isSubmitting,
    lastError,
    isSuccess,
    submitFeedback,
    resetStatus
  }
})
