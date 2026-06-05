import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireVerifiedUser } from './authHelpers';

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    return await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(500);
  },
});

// Idempotent create. `clientId` is a per-row UUID generated on the client;
// if a retry hits the server after the original already succeeded, we
// return the existing _id instead of inserting a duplicate.
export const upsert = mutation({
  args: {
    clientId: v.string(),
    amount: v.number(),
    currency: v.string(),
    type: v.union(v.literal('expense'), v.literal('income')),
    category: v.string(),
    merchant: v.string(),
    note: v.string(),
    date: v.string(),
    momoAccountId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_client', (q) =>
        q.eq('userId', userId).eq('clientId', args.clientId),
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert('expenses', { ...args, userId });
  },
});

// Update by clientId so the queue never needs to remember the server _id.
export const update = mutation({
  args: {
    clientId: v.string(),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    type: v.optional(v.union(v.literal('expense'), v.literal('income'))),
    category: v.optional(v.string()),
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
    date: v.optional(v.string()),
    momoAccountId: v.optional(v.string()),
    updatedAt: v.string(),
  },
  handler: async (ctx, { clientId, ...fields }) => {
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
      .unique();
    if (!existing) return; // already deleted on another device, or never made it — drop silently
    await ctx.db.patch(existing._id, fields);
  },
});

export const remove = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
      .unique();
    if (!existing) return; // already gone — idempotent delete
    await ctx.db.delete(existing._id);
  },
});
