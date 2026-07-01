'use node';
import { action } from './_generated/server';
import { v } from 'convex/values';
import {
  buildMultipartFormData,
  buildGroqSystemPrompt,
  buildTranscriptionPrompt,
  parseGroqResponse,
} from '../src/services/groqHelpers';

export const transcribeAndParse = action({
  args: {
    audioBase64: v.string(),
    categories: v.array(v.string()),
    userGroqKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    // Use user-provided key, or fallback to server env key
    const GROQ_API_KEY = args.userGroqKey || process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      throw new Error('Server is not configured with a Groq API key and no user key was provided.');
    }

    try {
      // 1. Convert Base64 to Buffer for Groq
      const buffer = Buffer.from(args.audioBase64, 'base64');
      const { headers: transcriptionHeaders, body: transcriptionBody } = buildMultipartFormData(
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
          ...transcriptionHeaders,
        },
        body: transcriptionBody,
      });

      if (!transcriptionRes.ok) {
        throw new Error('Transcription failed at proxy');
      }

      const transcript = (await transcriptionRes.text()).trim();

      // 3. Parse with Llama
      const systemPrompt = buildGroqSystemPrompt(transcript, args.categories);

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

      return { transcript, result };
    } catch (error: any) {
      console.error('Convex Proxy Error:', error);
      throw new Error(error.message || 'Processing failed');
    }
  },
});
