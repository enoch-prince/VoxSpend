// ============================================
// Voice Store (Recording + On-Device AI)
// ============================================

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useVoiceRecorder } from '@/services/voiceRecorder'
import { parseExpense } from '@/services/groqService'
import { useUserStore } from './user'
import { useExpensesStore } from './expenses'
import { useCategoriesStore } from './categories'
import type { ParsedExpense } from '@/types'

export type VoiceState = 'idle' | 'recording' | 'downloading' | 'processing' | 'confirm' | 'error'

export const useVoiceStore = defineStore('voice', () => {
  const state = ref<VoiceState>('idle')
  const transcript = ref('')
  const parsedExpense = ref<ParsedExpense | null>(null)
  const errorMessage = ref('')
  const downloadProgress = ref(0)

  const recorder = useVoiceRecorder()
  let worker: Worker | null = null

  // ---- Worker Initialization ----
  function getWorker() {
    if (!worker) {
      worker = new Worker(
        new URL('@/workers/transcriptionWorker.ts', import.meta.url),
        { type: 'module' }
      )
      
      worker.onmessage = (e) => {
        const { status, progress, transcript: text, error } = e.data
        
        if (status === 'progress') {
          state.value = 'downloading'
          if (progress.status === 'progress') {
            downloadProgress.value = progress.progress
          }
        } else if (status === 'ready') {
          // Ready but no audio sent yet
        } else if (status === 'processing') {
          state.value = 'processing'
        } else if (status === 'success') {
          transcript.value = text
          processTranscript(text)
        } else if (status === 'error') {
          state.value = 'error'
          errorMessage.value = error || 'Transcription failed'
        }
      }
    }
    return worker
  }

  // ---- Actions ----
  async function startRecording() {
    try {
      state.value = 'recording'
      errorMessage.value = ''
      transcript.value = ''
      parsedExpense.value = null
      downloadProgress.value = 0
      await recorder.startRecording()
    } catch (err) {
      state.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : 'Microphone access denied'
    }
  }

  async function stopAndProcess() {
    try {
      state.value = 'processing'
      const blob = await recorder.stopRecording()
      
      // 1. Decode audio to 16kHz Float32Array (required by Whisper)
      const audioData = await decodeAudio(blob)
      
      // 2. Send to worker for on-device transcription
      const transcriptionWorker = getWorker()
      transcriptionWorker.postMessage({ audio: audioData })
      
    } catch (err) {
      state.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : 'Processing failed'
    }
  }

  async function processTranscript(text: string) {
    if (!text || text.trim().length < 2) {
      state.value = 'error'
      errorMessage.value = 'Could not understand the audio. Please try again.'
      return
    }

    const userStore = useUserStore()
    const categoriesStore = useCategoriesStore()

    try {
      state.value = 'processing'
      
      // We still use Groq/Llama for the text -> JSON parsing because it's lightweight 
      // and highly accurate for local terminology, while keeping raw audio private.
      const result = await parseExpense(
        text,
        userStore.profile.groqApiKey, // Use user key if available, service will handle proxy if not
        categoriesStore.categoryNames
      )

      parsedExpense.value = {
        ...result,
        amount: Math.abs(result.amount || 0),
        currency: result.currency || 'GHS',
        type: result.type === 'income' ? 'income' : 'expense',
        category: result.category || 'Other',
        merchant: result.merchant || 'Unknown',
        note: result.note || text,
        date: result.date || new Date().toISOString().split('T')[0]
      }

      state.value = 'confirm'
    } catch (err) {
      state.value = 'error'
      errorMessage.value = 'Failed to parse expense details. You can edit them manually.'
      // Fallback: show the confirm screen with whatever we have
      parsedExpense.value = {
        amount: 0,
        currency: 'GHS',
        type: 'expense',
        category: 'Other',
        merchant: 'Unknown',
        note: text,
        date: new Date().toISOString().split('T')[0]
      }
      state.value = 'confirm'
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
    downloadProgress.value = 0
    if (recorder.isRecording.value) {
      recorder.cancelRecording()
    }
  }

  function cancel() {
    recorder.cancelRecording()
    reset()
  }

  // ---- Helpers ----
  async function decodeAudio(blob: Blob): Promise<Float32Array> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    return audioBuffer.getChannelData(0)
  }

  return {
    state,
    transcript,
    parsedExpense,
    errorMessage,
    downloadProgress,
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
