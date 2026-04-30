// ============================================
// Voice Store (Recording + AI Pipeline)
// ============================================

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useVoiceRecorder } from '@/services/voiceRecorder'
import { transcribeAudio, parseExpense } from '@/services/groqService'
import { useUserStore } from './user'
import { useExpensesStore } from './expenses'
import { useCategoriesStore } from './categories'
import type { ParsedExpense } from '@/types'

export type VoiceState = 'idle' | 'recording' | 'processing' | 'confirm' | 'error'

export const useVoiceStore = defineStore('voice', () => {
  const state = ref<VoiceState>('idle')
  const transcript = ref('')
  const parsedExpense = ref<ParsedExpense | null>(null)
  const errorMessage = ref('')

  const recorder = useVoiceRecorder()

  async function startRecording() {
    try {
      state.value = 'recording'
      errorMessage.value = ''
      transcript.value = ''
      parsedExpense.value = null
      await recorder.startRecording()
    } catch (err) {
      state.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : 'Microphone access denied'
    }
  }

  async function stopAndProcess() {
    const userStore = useUserStore()
    const categoriesStore = useCategoriesStore()

    // Removed strict check. We will use proxy if no key exists.

    try {
      state.value = 'processing'
      const blob = await recorder.stopRecording()

      if (!userStore.hasApiKey) {
        // --- USE PROXY ---
        const base64Audio = await blobToBase64(blob)
        const response = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: base64Audio,
            categories: categoriesStore.categoryNames
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Proxy processing failed')
        }

        const data = await response.json()
        transcript.value = data.transcript
        parsedExpense.value = {
          ...data.result,
          amount: Math.abs(data.result.amount || 0),
          currency: data.result.currency || 'GHS',
          type: data.result.type === 'income' ? 'income' : 'expense',
          category: data.result.category || 'Other',
          merchant: data.result.merchant || 'Unknown',
          note: data.result.note || data.transcript,
          date: data.result.date || new Date().toISOString().split('T')[0]
        }
      } else {
        // --- USE DIRECT GROQ ---
        transcript.value = await transcribeAudio(blob, userStore.profile.groqApiKey)

        if (!transcript.value || transcript.value.trim().length === 0) {
          state.value = 'error'
          errorMessage.value = 'Could not understand the audio. Please try again.'
          return
        }

        parsedExpense.value = await parseExpense(
          transcript.value,
          userStore.profile.groqApiKey,
          categoriesStore.categoryNames
        )
      }

      state.value = 'confirm'
    } catch (err) {
      state.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : 'Processing failed'
    }
  }

  async function confirmExpense() {
    if (!parsedExpense.value) return

    const expensesStore = useExpensesStore()
    await expensesStore.addExpense({
      amount: parsedExpense.value.amount,
      currency: parsedExpense.value.currency,
      type: parsedExpense.value.type,
      category: parsedExpense.value.category,
      merchant: parsedExpense.value.merchant,
      note: parsedExpense.value.note,
      date: parsedExpense.value.date
    })

    reset()
  }

  function updateParsed(updates: Partial<ParsedExpense>) {
    if (parsedExpense.value) {
      parsedExpense.value = { ...parsedExpense.value, ...updates }
    }
  }

  function reset() {
    state.value = 'idle'
    transcript.value = ''
    parsedExpense.value = null
    errorMessage.value = ''
    if (recorder.isRecording.value) {
      recorder.cancelRecording()
    }
  }

  function cancel() {
    recorder.cancelRecording()
    reset()
  }

  // Helper: Convert Blob to Base64 string
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1]
        resolve(base64String)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  return {
    state,
    transcript,
    parsedExpense,
    errorMessage,
    isRecording: recorder.isRecording,
    duration: recorder.duration,
    audioLevel: recorder.audioLevel,
    formatDuration: recorder.formatDuration,
    startRecording,
    stopAndProcess,
    confirmExpense,
    updateParsed,
    reset,
    cancel
  }
})
