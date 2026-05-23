import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// Validation constants — keep in sync with src/stores/feedback.ts FeedbackType
// ---------------------------------------------------------------------------
const ALLOWED_TYPES = ['bug', 'feature', 'improvement', 'general'] as const;
type FeedbackType = (typeof ALLOWED_TYPES)[number];
const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// In-memory rate limiter (best-effort for serverless; replaced by DB when
// this handler is migrated to a Convex action).
// ---------------------------------------------------------------------------
const ipTimestamps = new Map<string, number[]>();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  ipTimestamps.set(ip, recent);
  return false;
}

// ---------------------------------------------------------------------------
// Escape markdown special characters so user content cannot inject headings,
// links, or other formatting into the GitHub issue body.
// ---------------------------------------------------------------------------
function escapeMd(text: string): string {
  return text.replace(/[`_*[\]()#~>|\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Core logic extracted as a plain function so it can be reused verbatim
// inside a Convex action when this endpoint is migrated.
// ---------------------------------------------------------------------------
export interface FeedbackPayload {
  type: FeedbackType;
  message: string;
  email?: string;
  metadata: {
    version: string;
    userAgent: string;
    screenSize: string;
    timestamp: string;
  };
}

export function validateFeedback(body: unknown): { error: string } | { data: FeedbackPayload } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body' };
  }
  const b = body as Record<string, unknown>;

  if (!ALLOWED_TYPES.includes(b.type as FeedbackType)) {
    return { error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` };
  }
  if (typeof b.message !== 'string' || b.message.trim().length === 0) {
    return { error: 'message is required' };
  }
  if (b.message.length > MAX_MESSAGE_LENGTH) {
    return { error: `message must be under ${MAX_MESSAGE_LENGTH} characters` };
  }
  if (b.email !== undefined && b.email !== '' && !EMAIL_RE.test(b.email as string)) {
    return { error: 'email format is invalid' };
  }
  if (!b.metadata || typeof b.metadata !== 'object') {
    return { error: 'metadata is required' };
  }

  return { data: b as unknown as FeedbackPayload };
}

export function buildIssueBody(data: FeedbackPayload): { title: string; body: string; label: string } {
  const labelMap: Record<FeedbackType, string> = {
    bug: 'bug',
    feature: 'enhancement',
    improvement: 'improvement',
    general: 'feedback',
  };

  const preview = data.message.length > 50 ? `${data.message.substring(0, 50)}…` : data.message;

  const body = `## Feedback Details
**Category:** ${escapeMd(data.type)}
**User Email:** ${data.email ? escapeMd(data.email) : 'Not provided'}

### Message
\`\`\`
${data.message}
\`\`\`

---
### Metadata
- **App Version:** ${escapeMd(String(data.metadata.version ?? ''))}
- **User Agent:** ${escapeMd(String(data.metadata.userAgent ?? ''))}
- **Screen Size:** ${escapeMd(String(data.metadata.screenSize ?? ''))}
- **Timestamp:** ${escapeMd(String(data.metadata.timestamp ?? ''))}
`;

  return {
    title: `[Feedback] ${data.type.toUpperCase()}: ${preview}`,
    body,
    label: labelMap[data.type],
  };
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.includes('application/json')) {
    return response.status(415).json({ message: 'Content-Type must be application/json' });
  }

  // Rate limit by IP
  const ip =
    (Array.isArray(request.headers['x-forwarded-for'])
      ? request.headers['x-forwarded-for'][0]
      : request.headers['x-forwarded-for']) ??
    request.socket?.remoteAddress ??
    'unknown';

  if (isRateLimited(ip)) {
    return response.status(429).json({ message: 'Too many requests. Please try again later.' });
  }

  // Validate
  const validation = validateFeedback(request.body);
  if ('error' in validation) {
    return response.status(400).json({ message: validation.error });
  }
  const { data } = validation;

  // GitHub config
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  let GITHUB_REPO = process.env.GITHUB_REPO;
  if (GITHUB_REPO?.includes('github.com/')) {
    GITHUB_REPO = GITHUB_REPO.split('github.com/')[1].replace('.git', '');
  }
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.error('[feedback] Missing GitHub environment variables');
    return response.status(500).json({ message: 'Server configuration error' });
  }

  const { title, body, label } = buildIssueBody(data);

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'VoxSpend-App',
      },
      body: JSON.stringify({ title, body, labels: [label] }),
    });

    if (!res.ok) {
      console.error('[feedback] GitHub API error:', res.status);
      return response.status(502).json({ message: 'Failed to submit feedback. Please try again later.' });
    }

    const issueData = await res.json();
    return response.status(201).json({ message: 'Feedback submitted successfully', url: issueData.html_url });
  } catch (error) {
    console.error('[feedback] Unexpected error:', error);
    return response.status(500).json({ message: 'Internal Server Error' });
  }
}