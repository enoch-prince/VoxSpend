import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

function requireAuth(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  return getAuthUserId(ctx as Parameters<typeof getAuthUserId>[0]);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    return await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(500);
  },
});

export const add = mutation({
  args: {
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    return await ctx.db.insert('expenses', { ...args, userId });
  },
});

export const update = mutation({
  args: {
    id: v.id('expenses'),
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
  handler: async (ctx, { id, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error('Not found');
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id('expenses') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error('Not found');
    await ctx.db.delete(id);
  },
});

// Bulk-insert for migrating existing local IndexedDB data on first sign-in
export const bulkAdd = mutation({
  args: {
    expenses: v.array(
      v.object({
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
      })
    ),
  },
  handler: async (ctx, { expenses }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    for (const expense of expenses) {
      await ctx.db.insert('expenses', { ...expense, userId });
    }
  },
});