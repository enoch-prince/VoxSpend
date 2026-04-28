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

    if (!userStore.hasApiKey) {
      state.value = 'error'
      errorMessage.value = 'Please add your Groq API key in Settings'
      recorder.cancelRecording()
      return
    }

    try {
      state.value = 'processing'
      const blob = await recorder.stopRecording()

      // Step 1: Transcribe
      transcript.value = await transcribeAudio(blob, userStore.profile.groqApiKey)

      if (!transcript.value || transcript.value.trim().length === 0) {
        state.value = 'error'
        errorMessage.value = 'Could not understand the audio. Please try again.'
        return
      }

      // Step 2: Parse
      parsedExpense.value = await parseExpense(
        transcript.value,
        userStore.profile.groqApiKey,
        categoriesStore.categoryNames
      )

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
