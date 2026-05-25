// ============================================
// Friendly error mapping for Convex / network failures
// ============================================
//
// Convex serializes server errors with a wrapper that looks like:
//   "[Request ID: 9fd97c…] Server Error\nUncaught Error: InvalidSecret"
//   "Uncaught ConvexError: SomeCode"
// Surfaced raw, those strings leak request IDs and internal symbols into
// the UI. `toFriendlyError` peels off the wrapping, matches known codes
// (auth provider, authorization, validation, network) and returns a plain
// Error whose `message` is safe to render directly.

const AUTH_RULES: Array<[RegExp, string]> = [
  [/InvalidSecret/i, 'Incorrect email or password.'],
  [/InvalidAccountId|account.*not.*found/i, "We couldn't find an account with that email."],
  [
    /already exists|already taken|duplicate|UNIQUE constraint/i,
    'An account with this email already exists. Try signing in instead.',
  ],
  [/password.*(short|weak|invalid)|InvalidPassword/i, 'Password must be at least 8 characters.'],
  [/invalid.*email|email.*invalid/i, 'That email address looks invalid.'],
];

const GENERIC_RULES: Array<[RegExp, string]> = [
  [/Unauthorized|not authenticated|missing.*identity/i, "You're signed out. Please sign in again."],
  [/Not found|does not exist/i, "We couldn't find what you were looking for."],
  [/ArgumentValidationError|validator|validation/i, 'Some of the details look invalid.'],
  [
    /network|failed to fetch|fetch.*failed|timeout|offline/i,
    'Network issue — check your connection and try again.',
  ],
  [/rate.?limit|too many requests/i, 'Too many requests. Please wait a moment and try again.'],
];

function extractTail(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Split off "[Request ID: …] Server Error\nUncaught …Error: <real>"
  const afterPrefix = raw.split(/Uncaught (?:Convex)?Error:\s*/i).pop() ?? raw;
  return afterPrefix.split('\n')[0].trim();
}

/**
 * Convert any thrown value into a user-facing Error.
 *
 * @param err      The original error caught from a Convex call (or anywhere).
 * @param fallback Action-specific copy to show when no known code matches.
 *                 Example: "Couldn't save your expense."
 */
export function toFriendlyError(err: unknown, fallback?: string): Error {
  const tail = extractTail(err);

  for (const [pattern, message] of AUTH_RULES) {
    if (pattern.test(tail)) return new Error(message);
  }
  for (const [pattern, message] of GENERIC_RULES) {
    if (pattern.test(tail)) return new Error(message);
  }

  return new Error(fallback ?? 'Something went wrong. Please try again.');
}
