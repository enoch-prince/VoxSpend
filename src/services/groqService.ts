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
  // GEOGRAPHIC TUNING: Help Whisper recognize local Ghanaian terms
  formData.append('prompt', 'GHS, Cedis, Cedi, Pesewas, MoMo, MTN, Telecel, AirtelTigo, Waakye, Trotro, Kelewele, Kenkey, Papaye, Melcom.')

  const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
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
  - If the user says "cedis", "cedi", "pesewas", or just a number, it is GHS.
  - "MoMo" refers to Mobile Money.
  - Today is: ${today}

  RULES:
  - Pick the best matching category from: ${categoryList}
  - merchant should be the specific shop, person, or service (e.g., "Melcom", "Momo Transfer", "Waakye Seller").
  - note should capture any extra detail from the speech
  
  Return ONLY JSON: {"amount": number, "currency": "GHS", "type": "expense"|"income", "category": "string", "merchant": "string", "note": "string", "date": "YYYY-MM-DD"}`

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
