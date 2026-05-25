import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    return await ctx.db
      .query('categories')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(200);
  },
});

// Idempotent create — see expenses.upsert for the rationale.
export const upsert = mutation({
  args: {
    clientId: v.string(),
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    isCustom: v.boolean(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    const existing = await ctx.db
      .query('categories')
      .withIndex('by_user_and_client', (q) =>
        q.eq('userId', userId).eq('clientId', args.clientId),
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert('categories', { ...args, userId });
  },
});

export const update = mutation({
  args: {
    clientId: v.string(),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    const existing = await ctx.db
      .query('categories')
      .withIndex('by_user_and_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
      .unique();
    if (!existing) return;
    await ctx.db.patch(existing._id, fields);
  },
});

export const remove = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    const existing = await ctx.db
      .query('categories')
      .withIndex('by_user_and_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
      .unique();
    if (!existing) return;
    if (!existing.isCustom) throw new Error('Cannot delete default categories');
    await ctx.db.delete(existing._id);
  },
});
