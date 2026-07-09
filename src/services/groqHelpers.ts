export type GroqParseItem = {
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  category: string;
  merchant: string;
  note: string;
  date: string;
};

export type GroqParseResponse = {
  results: GroqParseItem[];
};

export function buildTranscriptionPrompt(): string {
  return 'GHS, Cedis, Cedi, Pesewas, MoMo, MTN, Telecel, AirtelTigo, Waakye, Trotro, Troski, Kelewele, Kenkey, Papaye, Melcom, Chop, Chale, Abeg, Kraa, Mo.';
}

export function buildGroqSystemPrompt(categories: string[]): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const categoryList = categories.length > 0 ? categories.join(', ') : 'Other';

  return `You are a financial data extractor for Ghanaian users. Parse the voice transcript in the user message and return one record per expense or income item mentioned.

CURRENCY & AMOUNTS
- Default currency: GHS. "Cedis", "CDs", "gunna CDs" all mean GHS.
- Pesewas: "50 pesewas" or "50p" = 0.50 GHS.
- Word-form numbers: "a hundred and fifty thousand" = 150000.
- "MoMo" = Mobile Money transfer.

DATES — today is ${todayStr}, yesterday is ${yesterdayStr}
- Output format: YYYY-MM-DD.
- Resolve relative terms: "yesterday", "this morning/evening" = today, "last Monday" = calculate from today.
- Default to today if no date is stated.

TYPE
- expense (default): bought, paid, spent, topped up, transferred out, sent.
- income: received, sold, got paid, salary, profit, MoMo received, collected.

CATEGORIES — pick the closest match from: ${categoryList}. Use "Other" if nothing fits.

MERCHANT — the specific shop, person, or service (e.g. "Melcom", "Uncle Ato", "MTN MoMo"). Use "Unknown" only if truly unidentifiable.

OUTPUT RULES
- Extract EVERY item as its own object — never merge multiple purchases into one.
- Always output a numeric amount. Use 0 if the amount is genuinely unclear, and describe it in note.
- note: any extra context from the speech not captured by the other fields.

Return ONLY valid JSON with no markdown or explanation:
{"results":[{"amount":number,"currency":"GHS","type":"expense"|"income","category":"string","merchant":"string","note":"string","date":"YYYY-MM-DD"}]}`;
}

export function parseGroqResponse(data: any): GroqParseResponse {
  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text;
  if (!content) {
    throw new Error('No content in LLM response');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error('LLM response was not valid JSON');
  }

  const results = Array.isArray(parsed.results) ? parsed.results : [];
  return {
    results: results.map((item: any) => ({
      amount: Math.abs(Number(item.amount) || 0),
      currency: item.currency || 'GHS',
      type: item.type === 'income' ? 'income' : 'expense',
      category: item.category || 'Other',
      merchant: item.merchant || 'Unknown',
      note: item.note || '',
      date: item.date || new Date().toISOString().split('T')[0],
    })),
  };
}

export function buildMultipartFormData(
  fields: Record<string, string>,
  file: { name: string; filename: string; contentType: string; data: Buffer }
) {
  const boundary = `----VoxSpendBoundary${Math.random().toString(16).slice(2)}`;
  const CRLF = '\r\n';
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`
      )
    );
  }

  parts.push(
    Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"${CRLF}Content-Type: ${file.contentType}${CRLF}${CRLF}`
    )
  );
  parts.push(file.data);
  parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));

  return {
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(parts),
  };
}
