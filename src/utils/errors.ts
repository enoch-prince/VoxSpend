// ============================================
// Friendly error mapping for Convex / network failures
// ============================================
//
// Convex serializes server errors with a wrapper that looks like:
//   "[Request ID: 9fd97c…] Server Error\nUncaught Error: InvalidSecret"
//   "Uncaught ConvexError: SomeCode"
// Surfaced raw, those strings leak request IDs and internal symbols into
// the UI. `toFriendlyError` peels off the wrapping, matches known codes
// (auth provider, authorization, validation, network) and returns a
// `FriendlyError` whose `message` is safe to render directly and whose
// `field` hints which input (if any) is at fault.

export type ErrorField = 'email' | 'password' | 'code' | null;

export class FriendlyError extends Error {
  field: ErrorField;
  constructor(message: string, field: ErrorField = null) {
    super(message);
    this.name = 'FriendlyError';
    this.field = field;
  }
}

type Rule = [RegExp, string, ErrorField];

const AUTH_RULES: Rule[] = [
  // Convex Password provider returns InvalidSecret for both wrong email
  // and wrong password — we can't tell which, so flag both fields.
  [/InvalidSecret|invalid.*credential|wrong.*password/i, 'The email or password you entered is incorrect.', null],
  [/InvalidAccountId|account.*not.*found|no.*such.*user/i, "We couldn't find an account with that email. Try signing up instead.", 'email'],
  [
    /already exists|already taken|duplicate|UNIQUE constraint|email.*in use/i,
    'An account with this email already exists. Try signing in instead.',
    'email',
  ],
  [/password.*(short|weak|invalid)|InvalidPassword|weak.*password/i, 'Password must be at least 8 characters.', 'password'],
  [/invalid.*email|email.*invalid|malformed.*email/i, "That email address doesn't look right.", 'email'],
  [/invalid.*code|wrong.*code|code.*(invalid|incorrect|expired)|expired.*code/i, 'That code is invalid or has expired. Request a new one.', 'code'],
];

const GENERIC_RULES: Rule[] = [
  [/Unauthorized|not authenticated|missing.*identity/i, 'Your session has expired. Please sign in again.', null],
  [/Not found|does not exist/i, "We couldn't find what you were looking for.", null],
  [/ArgumentValidationError|validator|validation/i, 'Some of the details look invalid. Please check and try again.', null],
  [
    /network|failed to fetch|fetch.*failed|timeout|offline|ERR_INTERNET/i,
    "We can't reach the server. Check your connection and try again.",
    null,
  ],
  [/rate.?limit|too many requests|throttle/i, 'Too many attempts. Please wait a moment before trying again.', null],
];

function extractTail(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Split off "[Request ID: …] Server Error\nUncaught …Error: <real>"
  const afterPrefix = raw.split(/Uncaught (?:Convex)?Error:\s*/i).pop() ?? raw;
  return afterPrefix.split('\n')[0].trim();
}

/**
 * Convert any thrown value into a user-facing `FriendlyError`.
 *
 * @param err      The original error caught from a Convex call (or anywhere).
 * @param fallback Action-specific copy to show when no known code matches.
 *                 Example: "Couldn't save your expense."
 */
export function toFriendlyError(err: unknown, fallback?: string): FriendlyError {
  const tail = extractTail(err);

  for (const [pattern, message, field] of AUTH_RULES) {
    if (pattern.test(tail)) return new FriendlyError(message, field);
  }
  for (const [pattern, message, field] of GENERIC_RULES) {
    if (pattern.test(tail)) return new FriendlyError(message, field);
  }

  return new FriendlyError(fallback ?? 'Something went wrong. Please try again.');
}
