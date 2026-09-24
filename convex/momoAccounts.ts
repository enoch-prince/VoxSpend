import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireOwnedAccount, requireVerifiedUser } from './authHelpers';

const providerValidator = v.union(
  v.literal('mtn'),
  v.literal('telecel'),
  v.literal('airteltigo'),
);

export const list = query({
  args: { accountId: v.optional(v.id('expenseAccounts')) },
  handler: async (ctx, { accountId }) => {
    const userId = await requireVerifiedUser(ctx);
    if (accountId) await requireOwnedAccount(ctx, userId, accountId);
    return accountId
      ? await ctx.db
          .query('momoAccounts')
          .withIndex('by_user_and_account', (q) => q.eq('userId', userId).eq('accountId', accountId))
          .take(50)
      : await ctx.db
          .query('momoAccounts')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(50);
  },
});

export const upsert = mutation({
  args: {
    accountId: v.optional(v.id('expenseAccounts')),
    clientId: v.string(),
    provider: providerValidator,
    phoneNumber: v.string(),
    nickname: v.string(),
    linkedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    if (args.accountId) await requireOwnedAccount(ctx, userId, args.accountId);
    const existing = args.accountId
      ? await ctx.db
          .query('momoAccounts')
          .withIndex('by_user_and_account_and_client', (q) =>
            q.eq('userId', userId).eq('accountId', args.accountId).eq('clientId', args.clientId),
          )
          .unique()
      : await ctx.db
          .query('momoAccounts')
          .withIndex('by_user_and_client', (q) =>
            q.eq('userId', userId).eq('clientId', args.clientId),
          )
          .unique();
    if (existing) return existing._id;
    return await ctx.db.insert('momoAccounts', { ...args, userId });
  },
});

export const update = mutation({
  args: {
    accountId: v.optional(v.id('expenseAccounts')),
    clientId: v.string(),
    provider: v.optional(providerValidator),
    phoneNumber: v.optional(v.string()),
    nickname: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, accountId, ...fields }) => {
    const userId = await requireVerifiedUser(ctx);
    if (accountId) await requireOwnedAccount(ctx, userId, accountId);
    const existing = accountId
      ? await ctx.db
          .query('momoAccounts')
          .withIndex('by_user_and_account_and_client', (q) =>
            q.eq('userId', userId).eq('accountId', accountId).eq('clientId', clientId),
          )
          .unique()
      : await ctx.db
          .query('momoAccounts')
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
          .query('momoAccounts')
          .withIndex('by_user_and_account_and_client', (q) =>
            q.eq('userId', userId).eq('accountId', accountId).eq('clientId', clientId),
          )
          .unique()
      : await ctx.db
          .query('momoAccounts')
          .withIndex('by_user_and_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
          .unique();
    if (!existing) return;
    await ctx.db.delete(existing._id);
  },
});
