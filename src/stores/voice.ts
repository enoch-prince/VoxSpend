// ============================================
// Voice Store (Recording + On-Device AI)
// ============================================

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useVoiceRecorder } from '@/services/voiceRecorder'
import { transcribeAudio, parseExpense } from '@/services/groqService'
import { useUserStore } from './user'
import { useExpensesStore } from './expenses'
import { useCategoriesStore } from './categories'
import { db, now } from '@/services/database'
import { convex, api } from '@/services/convexClient'
import type { ParsedExpense } from '@/types'

export type VoiceState = 'idle' | 'recording' | 'downloading' | 'processing' | 'confirm' | 'error' | 'offline-saved'

export const useVoiceStore = defineStore('voice', () => {
  const state = ref<VoiceState>('idle')
  const transcript = ref('')
  const parsedExpense = ref<ParsedExpense | null>(null)
  const errorMessage = ref('')
  const downloadProgress = ref(0)
  const pendingCount = ref(0)

  const recorder = useVoiceRecorder()

  async function updatePendingCount() {
    pendingCount.value = await db.pendingVoiceNotes.count()
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
      
      if (!navigator.onLine) {
        // Save to IndexedDB if offline
        await db.pendingVoiceNotes.add({
          audio: blob,
          createdAt: now()
        })
        await updatePendingCount()
        state.value = 'offline-saved'
        setTimeout(() => reset(), 3000) // Auto-reset after showing the offline message
        return
      }

      const userStore = useUserStore()
      const categoriesStore = useCategoriesStore()

      if (userStore.profile.groqApiKey) {
        // Use direct service if user provided their own key
        const text = await transcribeAudio(blob, userStore.profile.groqApiKey)
        transcript.value = text
        await processTranscript(text)
      } else {
        // Use Vercel proxy (does both transcription and parsing)
        const base64Audio = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.readAsDataURL(blob)
          reader.onloadend = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject
        })

        const data: any = await convex.action(api.voice.transcribeAndParse, {
          audioBase64: base64Audio,
          categories: categoriesStore.categoryNames
        })

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
        state.value = 'confirm'
      }
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
  
  async function syncPendingNotes() {
    if (!navigator.onLine) return
    
    const pendingNotes = await db.pendingVoiceNotes.toArray()
    if (pendingNotes.length === 0) return

    const userStore = useUserStore()
    const categoriesStore = useCategoriesStore()
    const expensesStore = useExpensesStore()

    for (const note of pendingNotes) {
      try {
        let transcriptText = ''
        let parsedResult: ParsedExpense | null = null

        if (userStore.profile.groqApiKey) {
          transcriptText = await transcribeAudio(note.audio, userStore.profile.groqApiKey)
          parsedResult = await parseExpense(transcriptText, userStore.profile.groqApiKey, categoriesStore.categoryNames)
        } else {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(note.audio)
            reader.onloadend = () => resolve((reader.result as string).split(',')[1])
            reader.onerror = reject
          })

          const data: any = await convex.action(api.voice.transcribeAndParse, {
            audioBase64: base64Audio,
            categories: categoriesStore.categoryNames
          })
          
          transcriptText = data.transcript
          parsedResult = {
            ...data.result,
            amount: Math.abs(data.result.amount || 0),
            currency: data.result.currency || 'GHS',
            type: data.result.type === 'income' ? 'income' : 'expense',
            category: data.result.category || 'Other',
            merchant: data.result.merchant || 'Unknown',
            note: data.result.note || data.transcript,
            date: data.result.date || note.createdAt.split('T')[0]
          }
        }

        if (parsedResult) {
          await expensesStore.addExpense({
            amount: parsedResult.amount,
            currency: parsedResult.currency,
            type: parsedResult.type,
            category: parsedResult.category,
            merchant: parsedResult.merchant,
            note: parsedResult.note,
            date: parsedResult.date
          })
          
          if (note.id) {
            await db.pendingVoiceNotes.delete(note.id)
          }
        }
      } catch (err) {
        console.error('Failed to sync offline voice note', err)
      }
    }
    
    await updatePendingCount()
  }

  return {
    state,
    transcript,
    parsedExpense,
    errorMessage,
    downloadProgress,
    pendingCount,
    isRecording: recorder.isRecording,
    duration: recorder.duration,
    audioLevel: recorder.audioLevel,
    formatDuration: recorder.formatDuration,
    startRecording,
    stopAndProcess,
    confirmExpense,
    updateParsed,
    reset,
    cancel,
    updatePendingCount,
    syncPendingNotes
  }
})
