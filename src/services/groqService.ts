// ============================================
// Groq AI Service (Whisper + Llama)
// ============================================

import type { ParsedExpense } from '@/types'

const GROQ_API_BASE = 'https://api.groq.com/openai/v1'

/**
 * Transcribe audio blob using Groq Whisper
 */
export async function transcribeAudio(blob: Blob, apiKey: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', blob, 'recording.webm')
  formData.append('model', 'whisper-large-v3-turbo')
  formData.append('language', 'en')
  formData.append('response_format', 'text')
  // GEOGRAPHIC TUNING: Conversational prompt helps Whisper understand the accent, flow, and local vocabulary.
  formData.append('prompt', 'Chale, I just spent 50 Ghana Cedis on Waakye and Kelewele. I paid my Trotro fare with 10 GHS. Abeg, record this MoMo transfer of 200 CDs to Ama. The price at Melcom was high kraa.')

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Groq API Key is missing. Please add it in Settings.')
  }

  const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: formData
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Transcription failed: ${error}`)
  }

  return (await response.text()).trim()
}

/**
 * Parse a natural language expense description into structured data
 */
export async function parseExpense(
  transcript: string,
  apiKey: string,
  categories: string[]
): Promise<ParsedExpense> {
  const today = new Date().toISOString().split('T')[0]
  const categoryList = categories.join(', ')

  const systemPrompt = `You are a Ghanaian expense parser. Extract structured data from: "${transcript}"
  
  LOCAL CONTEXT:
  - Primary currency: GHS (Ghana Cedis).
  - People often say "CDs" which means "Cedis". If you see "100 CDs", the amount is 100.
  - If the user says "cedis", "cedi", "CDs", "pesewas", or just a number, it is GHS.
  - "MoMo" refers to Mobile Money.
  - Today is: ${today}

  RULES:
  - ALWAYS extract a numerical amount. If you see "100 CDs", amount is 100.
  - Pick the best matching category from: ${categoryList}
  - merchant should be the specific shop, person, or service (e.g., "Melcom", "Momo Transfer", "Uncle Ato").
  - note should capture any extra detail from the speech
  
  Return ONLY JSON: {"amount": number, "currency": "GHS", "type": "expense"|"income", "category": "string", "merchant": "string", "note": "string", "date": "YYYY-MM-DD"}`

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Groq API Key is missing. Please add it in Settings.')
  }

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript }
      ],
      temperature: 0.1,
      max_tokens: 256,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Parsing failed: ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content in LLM response')
  }

  const parsed: ParsedExpense = JSON.parse(content)

  // Validate and sanitize
  return {
    amount: Math.abs(parsed.amount || 0),
    currency: parsed.currency || 'GHS',
    type: parsed.type === 'income' ? 'income' : 'expense',
    category: parsed.category || 'Other',
    merchant: parsed.merchant || 'Unknown',
    note: parsed.note || transcript,
    date: parsed.date || today
  }
}
