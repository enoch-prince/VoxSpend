import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' })
  }

  const { audio, categories } = request.body
  const GROQ_API_KEY = process.env.GROQ_API_KEY

  if (!GROQ_API_KEY) {
    return response.status(500).json({ message: 'Server is not configured with an API key' })
  }

  try {
    // 1. Convert Base64 back to Buffer/Blob for Groq
    const buffer = Buffer.from(audio, 'base64')
    const formData = new FormData()
    const file = new Blob([buffer], { type: 'audio/webm' })
    formData.append('file', file, 'recording.webm')
    // formData.append('model', 'whisper-large-v3-turbo')
    formData.append('model', 'whisper-large-v3')
    formData.append('response_format', 'text')
    // GEOGRAPHIC TUNING: Conversational prompt helps Whisper understand the accent, flow, and local vocabulary.
    // formData.append('prompt', 'Chale, I just spent 50 Ghana Cedis on Waakye and Kelewele. I paid my Trotro fare with 10 GHS. Abeg, record this MoMo transfer of 200 CDs to Ama. The price at Melcom was high kraa.')
    formData.append('prompt', 'GHS, Cedis, Cedi, Pesewas, MoMo, MTN, Telecel, AirtelTigo, Waakye, Trotro, Troski, Kelewele, Kenkey, Papaye, Melcom, Chop, Chale, Abeg, Kraa, Mo.')
    
    // 2. Transcribe
    const transcriptionRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: formData
    })

    if (!transcriptionRes.ok) {
      throw new Error('Transcription failed at proxy')
    }

    const transcript = (await transcriptionRes.text()).trim()

    // 3. Parse with Llama
    const today = new Date().toISOString().split('T')[0]
    const systemPrompt = `You are a Ghanaian expense parser. Extract structured data from: "${transcript}"
    
    LOCAL CONTEXT:
    - Primary currency: GHS (Ghana Cedis).
    - "CDs" or "gunna CDs" means "Cedis". Example: "100 CDs" = 100 GHS.
    - Handle word-form numbers: "a hundred and fifty thousand" = 150000.
    - "MoMo" refers to Mobile Money.
    - Common categories: Food, Transport (Trotro/Taxi), Utilities, Family, Health, Shopping, Other.
    - Today is: ${today}

    RULES:
    - ALWAYS extract a numerical amount. Convert words to numbers (e.g., "ten" to 10).
    - If the user mentions a large number like "a hundred thousand", ensure all zeros are captured.
    - Pick the best matching category from: ${categories.join(', ')}
    - merchant should be the specific shop, person, or service (e.g., "Melcom", "Momo Transfer", "Uncle Ato").
    
    Return ONLY JSON: {"amount": number, "currency": "GHS", "type": "expense"|"income", "category": "string", "merchant": "string", "note": "string", "date": "YYYY-MM-DD"}`

    const parseRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: transcript }],
        response_format: { type: 'json_object' }
      })
    })

    const parseData = await parseRes.json()
    const result = JSON.parse(parseData.choices[0].message.content)

    return response.status(200).json({ transcript, result })
  } catch (error: any) {
    console.error('Proxy Error:', error)
    return response.status(500).json({ message: error.message || 'Processing failed' })
  }
}
