import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireVerifiedUser } from './authHelpers';

const providerValidator = v.union(
  v.literal('mtn'),
  v.literal('telecel'),
  v.literal('airteltigo'),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    return await ctx.db
      .query('momoAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(50);
  },
});

export const upsert = mutation({
  args: {
    clientId: v.string(),
    provider: providerValidator,
    phoneNumber: v.string(),
    nickname: v.string(),
    linkedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db
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
    clientId: v.string(),
    provider: v.optional(providerValidator),
    phoneNumber: v.optional(v.string()),
    nickname: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, ...fields }) => {
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db
      .query('momoAccounts')
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
      .query('momoAccounts')
      .withIndex('by_user_and_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
      .unique();
    if (!existing) return;
    await ctx.db.delete(existing._id);
  },
});
