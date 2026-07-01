// DEPRECATED: legacy voice transcription proxy. Voice transcription and parsing now run through Convex.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildGroqSystemPrompt,
  buildMultipartFormData,
  buildTranscriptionPrompt,
  parseGroqResponse,
} from '../src/services/groqHelpers';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  const { audio, categories } = request.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return response.status(500).json({ message: 'Server is not configured with an API key' });
  }

  try {
    // 1. Convert Base64 back to Buffer for Groq
    const buffer = Buffer.from(audio, 'base64');
    const { headers: formHeaders, body: formBody } = buildMultipartFormData(
      {
        model: 'whisper-large-v3',
        response_format: 'text',
        prompt: buildTranscriptionPrompt(),
      },
      {
        name: 'file',
        filename: 'recording.webm',
        contentType: 'audio/webm',
        data: buffer,
      }
    );

    // 2. Transcribe
    const transcriptionRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        ...formHeaders,
      },
      body: formBody,
    });

    if (!transcriptionRes.ok) {
      throw new Error('Transcription failed at proxy');
    }

    const transcript = (await transcriptionRes.text()).trim();

    // 3. Parse with Llama
    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = buildGroqSystemPrompt(transcript, categories);

    const parseRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen3.6-27b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const parseData = await parseRes.json();
    const result = parseGroqResponse(parseData);

    return response.status(200).json({ transcript, result });
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return response.status(500).json({ message: error.message || 'Processing failed' });
  }
}
