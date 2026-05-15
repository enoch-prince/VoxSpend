"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

export const transcribeAndParse = action({
  args: {
    audioBase64: v.string(),
    categories: v.array(v.string()),
    userGroqKey: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Use user-provided key, or fallback to server env key
    const GROQ_API_KEY = args.userGroqKey || process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      throw new Error("Server is not configured with a Groq API key and no user key was provided.");
    }

    try {
      // 1. Convert Base64 to Buffer/Blob
      const buffer = Buffer.from(args.audioBase64, "base64");
      const formData = new FormData();
      const file = new Blob([buffer], { type: "audio/webm" });
      formData.append("file", file, "recording.webm");
      formData.append("model", "whisper-large-v3");
      formData.append("response_format", "text");
      formData.append("prompt", "GHS, Cedis, Cedi, Pesewas, MoMo, MTN, Telecel, AirtelTigo, Waakye, Trotro, Troski, Kelewele, Kenkey, Papaye, Melcom, Chop, Chale, Abeg, Kraa, Mo.");
      
      // 2. Transcribe
      const transcriptionRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: formData as any // standard FormData is fine, TS type might complain
      });

      if (!transcriptionRes.ok) {
        throw new Error("Transcription failed at proxy");
      }

      const transcript = (await transcriptionRes.text()).trim();

      // 3. Parse with Llama
      const today = new Date().toISOString().split("T")[0];
      const systemPrompt = `You are a Ghanaian expense parser. The user may mention multiple purchases. Extract ONLY the FIRST expense mentioned from: "${transcript}"
      
      LOCAL CONTEXT:
      - Primary currency: GHS (Ghana Cedis).
      - "CDs" or "gunna CDs" means "Cedis". Example: "100 CDs" = 100 GHS.
      - Handle word-form numbers: "a hundred and fifty thousand" = 150000.
      - "MoMo" refers to Mobile Money.
      - Common categories: Food, Transport (Trotro/Taxi), Utilities, Family, Health, Shopping, Other.
      - Today is: ${today}

      RULES:
      - ALWAYS extract a single, numerical amount. Never return 0 unless explicitly stated.
      - If multiple expenses are mentioned, extract ONLY the FIRST one.
      - Pick the best matching category from: ${args.categories.join(", ")}
      - merchant should be the specific shop, person, or service (e.g., "Melcom", "Momo Transfer", "Uncle Ato").
      - You MUST return valid JSON with a numeric amount field.
      
      Return ONLY valid JSON (no markdown, no explanation): {"amount": number, "currency": "GHS", "type": "expense"|"income", "category": "string", "merchant": "string", "note": "string", "date": "YYYY-MM-DD"}`

      const parseRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: transcript }],
          response_format: { type: "json_object" }
        })
      });

      const parseData = await parseRes.json();
      const result = JSON.parse(parseData.choices[0].message.content);

      return { transcript, result };
    } catch (error: any) {
      console.error("Convex Proxy Error:", error);
      throw new Error(error.message || "Processing failed");
    }
  },
});
