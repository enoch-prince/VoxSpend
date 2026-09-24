import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireVerifiedUser } from './authHelpers';

const currencyValidator = v.union(
  v.literal('GHS'),
  v.literal('USD'),
  v.literal('EUR'),
  v.literal('GBP'),
);

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

async function getOwnedAccount(ctx: any, userId: string, accountId: string) {
  const account = await ctx.db.get('expenseAccounts', accountId);
  if (!account || account.userId !== userId) throw new Error('Account not found.');
  return account;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    return await ctx.db
      .query('expenseAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('archivedAt'), undefined))
      .order('asc')
      .collect();
  },
});

export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db
      .query('expenseAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('archivedAt'), undefined))
      .collect();
    const timestamp = new Date().toISOString();
    const account = existing[0]
      ? existing[0]
      : await ctx.db.insert('expenseAccounts', {
          userId,
          name: 'Personal',
          currency: 'GHS',
          createdAt: timestamp,
          updatedAt: timestamp,
        });

    const accountId = typeof account === 'string' ? account : account._id;
    const legacyExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('accountId'), undefined))
      .collect();
    for (const row of legacyExpenses) await ctx.db.patch(row._id, { accountId });

    const legacyCategories = await ctx.db
      .query('categories')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('accountId'), undefined))
      .collect();
    for (const row of legacyCategories) await ctx.db.patch(row._id, { accountId });

    const legacyMomoAccounts = await ctx.db
      .query('momoAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('accountId'), undefined))
      .collect();
    for (const row of legacyMomoAccounts) await ctx.db.patch(row._id, { accountId });

    return accountId;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    currency: currencyValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error('Account name cannot be empty.');

    const existing = await ctx.db
      .query('expenseAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('archivedAt'), undefined))
      .collect();
    if (existing.some((account) => normalizeName(account.name) === normalizeName(name))) {
      throw new Error('An account with that name already exists.');
    }

    const timestamp = new Date().toISOString();
    return await ctx.db.insert('expenseAccounts', {
      userId,
      name,
      currency: args.currency,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const update = mutation({
  args: {
    accountId: v.id('expenseAccounts'),
    name: v.optional(v.string()),
    currency: v.optional(currencyValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    const account = await getOwnedAccount(ctx, userId, args.accountId);
    if (account.archivedAt) throw new Error('Archived accounts cannot be updated.');

    const name = args.name?.trim();
    if (args.name !== undefined && !name) throw new Error('Account name cannot be empty.');
    if (name !== undefined) {
      const existing = await ctx.db
        .query('expenseAccounts')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .filter((q) => q.eq(q.field('archivedAt'), undefined))
        .collect();
      if (
        existing.some(
          (candidate) =>
            candidate._id !== account._id && normalizeName(candidate.name) === normalizeName(name),
        )
      ) {
        throw new Error('An account with that name already exists.');
      }
    }

    await ctx.db.patch(account._id, {
      ...(name !== undefined ? { name } : {}),
      ...(args.currency !== undefined ? { currency: args.currency } : {}),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const archive = mutation({
  args: { accountId: v.id('expenseAccounts') },
  handler: async (ctx, { accountId }) => {
    const userId = await requireVerifiedUser(ctx);
    const account = await getOwnedAccount(ctx, userId, accountId);
    if (account.archivedAt) return;

    const activeAccounts = await ctx.db
      .query('expenseAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('archivedAt'), undefined))
      .collect();
    if (activeAccounts.length <= 1) {
      throw new Error('At least one active account is required.');
    }

    const timestamp = new Date().toISOString();
    await ctx.db.patch(account._id, { archivedAt: timestamp, updatedAt: timestamp });
  },
});
