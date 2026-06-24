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
//
// ============================================
// Auth repair migration
// ============================================
//
// Run this if users cannot register or login due to orphaned authAccounts:
//
//   npx convex run migrations:repairOrphanedAuthAccounts
//
// This finds all authAccounts rows whose userId no longer exists in the
// users table (e.g. after an accidental data clear) and recreates the
// missing users document, restoring the ability to sign in.

import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

const TABLES = ['expenses', 'categories', 'momoAccounts'] as const;
const BATCH_SIZE = 100;

export const backfillClientIds = internalMutation({
  args: {
    tableName: v.optional(
      v.union(v.literal('expenses'), v.literal('categories'), v.literal('momoAccounts')),
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const table = args.tableName ?? TABLES[0];
    const page = await ctx.db.query(table).paginate(args.paginationOpts);

    let patched = 0;
    for (const row of page.page) {
      if (!('clientId' in row) || !row.clientId) {
        await ctx.db.patch(row._id, { clientId: crypto.randomUUID() });
        patched += 1;
      }
    }

    if (page.continueCursor) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillClientIds, {
        tableName: table,
        paginationOpts: { numItems: BATCH_SIZE, cursor: page.continueCursor },
      });
    } else {
      const nextIndex = TABLES.indexOf(table) + 1;
      if (nextIndex < TABLES.length) {
        await ctx.scheduler.runAfter(0, internal.migrations.backfillClientIds, {
          tableName: TABLES[nextIndex],
          paginationOpts: { numItems: BATCH_SIZE, cursor: null },
        });
      }
    }

    return { table, patched, continueCursor: page.continueCursor ?? null };
  },
});
