export type GroqParseItem = {
  amount: number
  currency: string
  type: 'expense' | 'income'
  category: string
  merchant: string
  note: string
  date: string
}

export type GroqParseResponse = {
  results: GroqParseItem[]
}

export function buildTranscriptionPrompt(): string {
  return 'GHS, Cedis, Cedi, Pesewas, MoMo, MTN, Telecel, AirtelTigo, Waakye, Trotro, Troski, Kelewele, Kenkey, Papaye, Melcom, Chop, Chale, Abeg, Kraa, Mo.'
}

export function buildGroqSystemPrompt(transcript: string, categories: string[]): string {
  const today = new Date().toISOString().split('T')[0]
  const categoryList = categories.length > 0 ? categories.join(', ') : 'Other'

  return `You are a Ghanaian expense parser. Extract structured data from: "${transcript}"
  
  LOCAL CONTEXT:
  - Primary currency: GHS (Ghana Cedis).
  - If you see "CDs" or "gunna CDs", treat it as "Cedis".
  - Handle word-form numbers: "a hundred and fifty thousand" = 150000.
  - "MoMo" refers to Mobile Money.
  - Common categories are similar to the user's category list.
  - Today is: ${today}

  RULES:
  - Extract ALL expenses or income mentioned. If multiple items are mentioned, return an array of objects.
  - ALWAYS extract a numerical amount for each item.
  - Pick the best matching category from: ${categoryList}
  - merchant should be the specific shop, person, or service (e.g., "Melcom", "Momo Transfer", "Uncle Ato").
  - note should capture any extra detail from the speech.
  - date should be in YYYY-MM-DD format.
  - If the user only mentions a number and a merchant, use that as the expense amount and merchant.

  Return ONLY valid JSON (no markdown, no explanation): {"results": [{"amount": number, "currency": "GHS", "type": "expense"|"income", "category": "string", "merchant": "string", "note": "string", "date": "YYYY-MM-DD"}]}`
}

export function parseGroqResponse(data: any): GroqParseResponse {
  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text
  if (!content) {
    throw new Error('No content in LLM response')
  }

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error('LLM response was not valid JSON')
  }

  const results = Array.isArray(parsed.results) ? parsed.results : []
  return {
    results: results.map((item: any) => ({
      amount: Math.abs(Number(item.amount) || 0),
      currency: item.currency || 'GHS',
      type: item.type === 'income' ? 'income' : 'expense',
      category: item.category || 'Other',
      merchant: item.merchant || 'Unknown',
      note: item.note || '',
      date: item.date || new Date().toISOString().split('T')[0]
    }))
  }
}

export function buildMultipartFormData(
  fields: Record<string, string>,
  file: { name: string; filename: string; contentType: string; data: Buffer }
) {
  const boundary = `----VoxSpendBoundary${Math.random().toString(16).slice(2)}`
  const CRLF = '\r\n'
  const parts: Buffer[] = []

  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`))
  }

  parts.push(
    Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"${CRLF}Content-Type: ${file.contentType}${CRLF}${CRLF}`
    )
  )
  parts.push(file.data)
  parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`))

  return {
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(parts),
  }
}
