import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireOwnedAccount, requireVerifiedUser } from './authHelpers';

function normalizeCategoryName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export const list = query({
  args: { accountId: v.optional(v.id('expenseAccounts')) },
  handler: async (ctx, { accountId }) => {
    const userId = await requireVerifiedUser(ctx);
    if (accountId) await requireOwnedAccount(ctx, userId, accountId);
    const rows = accountId
      ? await ctx.db
          .query('categories')
          .withIndex('by_user_and_account', (q) => q.eq('userId', userId).eq('accountId', accountId))
          .take(200)
      : await ctx.db
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
    accountId: v.optional(v.id('expenseAccounts')),
    clientId: v.string(),
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    isCustom: v.boolean(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    if (args.accountId) await requireOwnedAccount(ctx, userId, args.accountId);
    const existing = args.accountId
      ? await ctx.db
          .query('categories')
          .withIndex('by_user_and_account_and_client', (q) =>
            q.eq('userId', userId).eq('accountId', args.accountId).eq('clientId', args.clientId),
          )
          .unique()
      : await ctx.db
          .query('categories')
          .withIndex('by_user_and_client', (q) =>
            q.eq('userId', userId).eq('clientId', args.clientId),
          )
          .unique();
    if (existing) return existing._id;

    const name = args.name.trim();
    if (!name) throw new Error('Category name cannot be empty');
    const categories = args.accountId
      ? await ctx.db
          .query('categories')
          .withIndex('by_user_and_account', (q) => q.eq('userId', userId).eq('accountId', args.accountId))
          .take(200)
      : await ctx.db
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
    accountId: v.optional(v.id('expenseAccounts')),
    clientId: v.string(),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, accountId, ...fields }) => {
    const userId = await requireVerifiedUser(ctx);
    if (accountId) await requireOwnedAccount(ctx, userId, accountId);
    const existing = accountId
      ? await ctx.db
          .query('categories')
          .withIndex('by_user_and_account_and_client', (q) =>
            q.eq('userId', userId).eq('accountId', accountId).eq('clientId', clientId),
          )
          .unique()
      : await ctx.db
          .query('categories')
          .withIndex('by_user_and_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
          .unique();
    if (!existing) return;
    await ctx.db.patch(existing._id, fields);
  },
});

export const remove = mutation({
  args: { clientId: v.string(), accountId: v.optional(v.id('expenseAccounts')) },
  handler: async (ctx, { clientId, accountId }) => {
    const userId = await requireVerifiedUser(ctx);
    if (accountId) await requireOwnedAccount(ctx, userId, accountId);
    const existing = accountId
      ? await ctx.db
          .query('categories')
          .withIndex('by_user_and_account_and_client', (q) =>
            q.eq('userId', userId).eq('accountId', accountId).eq('clientId', clientId),
          )
          .unique()
      : await ctx.db
          .query('categories')
          .withIndex('by_user_and_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
          .unique();
    if (!existing) return;
    if (!existing.isCustom) throw new Error('Cannot delete default categories');
    await ctx.db.delete(existing._id);
  },
});
