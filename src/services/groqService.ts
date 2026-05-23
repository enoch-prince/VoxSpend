// ============================================
// Groq AI Service (Whisper + Llama)
// ============================================

import type { ParsedExpense } from '@/types';
import { buildTranscriptionPrompt, buildGroqSystemPrompt, parseGroqResponse } from './groqHelpers';

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

/**
 * Transcribe audio blob using Groq Whisper
 */
export async function transcribeAudio(blob: Blob, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  // formData.append('model', 'whisper-large-v3-turbo')
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'en');
  formData.append('response_format', 'text');
  formData.append('prompt', buildTranscriptionPrompt());

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Groq API Key is missing. Please add it in Settings.');
  }

  const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Transcription failed: ${error}`);
  }

  return (await response.text()).trim();
}

/**
 * Parse a natural language expense description into structured data
 */
export async function parseExpense(
  transcript: string,
  apiKey: string,
  categories: string[]
): Promise<{ results: ParsedExpense[] }> {
  const today = new Date().toISOString().split('T')[0];
  // const categoryList = categories.join(', ');

  const systemPrompt = buildGroqSystemPrompt(transcript, categories);

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Groq API Key is missing. Please add it in Settings.');
  }

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
      temperature: 0.1,
      max_tokens: 256,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Parsing failed: ${error}`);
  }

  const data = await response.json();
  const parsed = parseGroqResponse(data);

  return {
    results: parsed.results.map((item) => ({
      ...item,
      note: item.note || transcript,
      date: item.date || today,
    })),
  };
}
