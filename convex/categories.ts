import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireVerifiedUser } from './authHelpers';

function normalizeCategoryName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    const rows = await ctx.db
      .query('categories')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(200);
    const unique = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = normalizeCategoryName(row.name);
      const existing = unique.get(key);
      if (!existing || row._creationTime < existing._creationTime) {
        unique.set(key, row);
      }
    }
    return [...unique.values()];
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
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db
      .query('categories')
      .withIndex('by_user_and_client', (q) =>
        q.eq('userId', userId).eq('clientId', args.clientId),
      )
      .unique();
    if (existing) return existing._id;

    const name = args.name.trim();
    if (!name) throw new Error('Category name cannot be empty');
    const categories = await ctx.db
      .query('categories')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(200);
    const sameName = categories.find(
      (category) => normalizeCategoryName(category.name) === normalizeCategoryName(name),
    );
    if (sameName) return sameName._id;

    return await ctx.db.insert('categories', { ...args, name, userId });
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
    const userId = await requireVerifiedUser(ctx);
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
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db
      .query('categories')
      .withIndex('by_user_and_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
      .unique();
    if (!existing) return;
    if (!existing.isCustom) throw new Error('Cannot delete default categories');
    await ctx.db.delete(existing._id);
  },
});
