// ============================================
// Voice Store (Recording + On-Device AI)
// ============================================

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useVoiceRecorder } from '@/services/voiceRecorder';
import { transcribeAudio, parseExpense } from '@/services/groqService';
import { useUserStore } from './user';
import { useExpensesStore } from './expenses';
import { useCategoriesStore } from './categories';
import { db, now } from '@/services/database';
import { convex, api } from '@/services/convexClient';
import type { ParsedExpense } from '@/types';

export type VoiceState =
  | 'idle'
  | 'recording'
  | 'downloading'
  | 'processing'
  | 'confirm'
  | 'error'
  | 'offline-saved';

export const useVoiceStore = defineStore('voice', () => {
  const state = ref<VoiceState>('idle');
  const transcript = ref('');
  const parsedExpenses = ref<ParsedExpense[]>([]);
  const errorMessage = ref('');
  const downloadProgress = ref(0);
  const pendingCount = ref(0);

  const recorder = useVoiceRecorder();

  async function updatePendingCount() {
    pendingCount.value = await db.pendingVoiceNotes.count();
  }
  // ---- Actions ----
  async function startRecording() {
    try {
      state.value = 'recording';
      errorMessage.value = '';
      transcript.value = '';
      parsedExpenses.value = [];
      downloadProgress.value = 0;
      await recorder.startRecording();
    } catch (err) {
      state.value = 'error';
      errorMessage.value = err instanceof Error ? err.message : 'Microphone access denied';
    }
  }

  async function stopAndProcess() {
    state.value = 'processing';
    let blob: Blob | null = null;

    try {
      blob = await recorder.stopRecording();

      if (!navigator.onLine) {
        // Save to IndexedDB if offline
        await db.pendingVoiceNotes.add({ audio: blob, createdAt: now() });
        await updatePendingCount();
        state.value = 'offline-saved';
        setTimeout(() => reset(), 3000);
        return;
      }

      const userStore = useUserStore();
      const categoriesStore = useCategoriesStore();

      if (userStore.profile.groqApiKey) {
        // Use direct service if user provided their own key
        const text = await transcribeAudio(blob, userStore.profile.groqApiKey);
        transcript.value = text;
        await processTranscript(text);
      } else {
        // Use Convex action (does both transcription and parsing)
        const base64Audio = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob!);
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
        });

        const data: any = await convex.action(api.voice.transcribeAndParse, {
          audioBase64: base64Audio,
          categories: categoriesStore.categoryNames,
        });

        transcript.value = data.transcript;

        parsedExpenses.value = (data.result.results || []).map((res: any) => ({
          ...res,
          amount: Math.abs(res.amount || 0),
          currency: res.currency || 'GHS',
          type: res.type === 'income' ? 'income' : 'expense',
          category: res.category || 'Other',
          merchant: res.merchant || 'Unknown',
          note: res.note || data.transcript,
          date: res.date || new Date().toISOString().split('T')[0],
        }));

        if (parsedExpenses.value.length === 0) {
          throw new Error('No expenses found in audio.');
        }

        state.value = 'confirm';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isNetworkError =
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('failed to connect') ||
        !navigator.onLine;

      if (isNetworkError && blob) {
        // Internet dropped mid-processing — save audio to queue silently
        try {
          await db.pendingVoiceNotes.add({ audio: blob, createdAt: now() });
          await updatePendingCount();
          state.value = 'offline-saved';
          setTimeout(() => reset(), 3000);
        } catch {
          state.value = 'error';
          errorMessage.value = 'No internet. Failed to save recording locally.';
        }
      } else {
        state.value = 'error';
        errorMessage.value = err instanceof Error ? err.message : 'Processing failed';
      }
    }
  }

  async function processTranscript(text: string) {
    if (!text || text.trim().length < 2) {
      state.value = 'error';
      errorMessage.value = 'Could not understand the audio. Please try again.';
      return;
    }

    const userStore = useUserStore();
    const categoriesStore = useCategoriesStore();

    try {
      state.value = 'processing';

      const result = await parseExpense(
        text,
        userStore.profile.groqApiKey,
        categoriesStore.categoryNames
      );

      parsedExpenses.value = (result.results || []).map((res: any) => ({
        ...res,
        amount: Math.abs(res.amount || 0),
        currency: res.currency || 'GHS',
        type: res.type === 'income' ? 'income' : 'expense',
        category: res.category || 'Other',
        merchant: res.merchant || 'Unknown',
        note: res.note || text,
        date: res.date || new Date().toISOString().split('T')[0],
      }));

      if (parsedExpenses.value.length === 0) {
        throw new Error('No expenses found in audio.');
      }

      state.value = 'confirm';
    } catch (err) {
      state.value = 'error';
      errorMessage.value = 'Failed to parse expense details. You can edit them manually.';
      // Fallback: show the confirm screen with one empty expense
      parsedExpenses.value = [
        {
          amount: 0,
          currency: 'GHS',
          type: 'expense',
          category: 'Other',
          merchant: 'Unknown',
          note: text,
          date: new Date().toISOString().split('T')[0],
        },
      ];
      state.value = 'confirm';
    }
  }

  async function confirmExpense() {
    if (parsedExpenses.value.length === 0) return;

    const expensesStore = useExpensesStore();
    for (const exp of parsedExpenses.value) {
      await expensesStore.addExpense({
        amount: exp.amount,
        currency: exp.currency,
        type: exp.type,
        category: exp.category,
        merchant: exp.merchant,
        note: exp.note,
        date: exp.date,
      });
    }

    reset();
  }

  function updateParsed(index: number, updates: Partial<ParsedExpense>) {
    if (parsedExpenses.value[index]) {
      parsedExpenses.value[index] = { ...parsedExpenses.value[index], ...updates };
    }
  }

  function removeParsed(index: number) {
    parsedExpenses.value.splice(index, 1);
    if (parsedExpenses.value.length === 0) {
      reset();
    }
  }

  function reset() {
    state.value = 'idle';
    transcript.value = '';
    parsedExpenses.value = [];
    errorMessage.value = '';
    downloadProgress.value = 0;
    if (recorder.isRecording.value) {
      recorder.cancelRecording();
    }
  }

  function cancel() {
    recorder.cancelRecording();
    reset();
  }

  // ---- Helpers ----

  async function syncPendingNotes() {
    if (!navigator.onLine) return;

    const pendingNotes = await db.pendingVoiceNotes.toArray();
    if (pendingNotes.length === 0) return;

    const userStore = useUserStore();
    const categoriesStore = useCategoriesStore();
    const expensesStore = useExpensesStore();

    for (const note of pendingNotes) {
      try {
        let results: any[] = [];

        if (userStore.profile.groqApiKey) {
          const transcriptText = await transcribeAudio(note.audio, userStore.profile.groqApiKey);
          const parsedResult = await parseExpense(
            transcriptText,
            userStore.profile.groqApiKey,
            categoriesStore.categoryNames
          );
          results = (parsedResult.results || []).map((res: any) => ({
            ...res,
            note: res.note || transcriptText,
          }));
        } else {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(note.audio);
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
          });

          const data: any = await convex.action(api.voice.transcribeAndParse, {
            audioBase64: base64Audio,
            categories: categoriesStore.categoryNames,
          });

          results = (data.result.results || []).map((res: any) => ({
            ...res,
            note: res.note || data.transcript,
          }));
        }

        for (const res of results) {
          await expensesStore.addExpense({
            amount: Math.abs(res.amount || 0),
            currency: res.currency || 'GHS',
            type: res.type === 'income' ? 'income' : 'expense',
            category: res.category || 'Other',
            merchant: res.merchant || 'Unknown',
            note: res.note,
            date: res.date || note.createdAt.split('T')[0],
          });
        }

        if (note.id) {
          await db.pendingVoiceNotes.delete(note.id);
        }
      } catch (err) {
        console.error('Failed to sync offline voice note', err);
      }
    }

    await updatePendingCount();
  }

  return {
    state,
    transcript,
    parsedExpenses,
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
    removeParsed,
    reset,
    cancel,
    updatePendingCount,
    syncPendingNotes,
  };
});
