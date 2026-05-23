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

export const add = mutation({
  args: {
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    isCustom: v.boolean(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    return await ctx.db.insert('categories', { ...args, userId });
  },
});

export const update = mutation({
  args: {
    id: v.id('categories'),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
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
  args: { id: v.id('categories') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error('Not found');
    if (!existing.isCustom) throw new Error('Cannot delete default categories');
    await ctx.db.delete(id);
  },
});

// Bulk-insert defaults (or migrate from local IndexedDB) on first sign-in
export const bulkAdd = mutation({
  args: {
    categories: v.array(
      v.object({
        name: v.string(),
        icon: v.string(),
        color: v.string(),
        isCustom: v.boolean(),
        createdAt: v.string(),
      })
    ),
  },
  handler: async (ctx, { categories }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');
    for (const cat of categories) {
      await ctx.db.insert('categories', { ...cat, userId });
    }
  },
});