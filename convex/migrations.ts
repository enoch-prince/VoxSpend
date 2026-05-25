// ============================================
// One-shot data migrations
// ============================================
//
// Run these once after the local-first sync layer is deployed:
//
//   npx convex run migrations:backfillClientIds
//
// They patch a `crypto.randomUUID()` onto every existing row that lacks
// a `clientId`. Idempotent — re-running is a no-op.

import { internalMutation } from './_generated/server';

const TABLES = ['expenses', 'categories', 'momoAccounts'] as const;

export const backfillClientIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const summary: Record<string, number> = {};
    for (const table of TABLES) {
      let patched = 0;
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        if (!('clientId' in row) || !row.clientId) {
          // crypto.randomUUID is available in the Convex V8 runtime.
          await ctx.db.patch(row._id, { clientId: crypto.randomUUID() });
          patched += 1;
        }
      }
      summary[table] = patched;
    }
    return summary;
  },
});
