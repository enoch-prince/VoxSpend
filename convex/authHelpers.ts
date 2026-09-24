import { getAuthUserId } from '@convex-dev/auth/server';

export async function requireUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

export async function requireVerifiedUser(ctx: any) {
  const userId = await requireUserId(ctx);
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .unique();

  if (!profile?.emailVerified) {
    throw new Error('Email verification is required.');
  }

  return userId;
}

export async function requireOwnedAccount(ctx: any, userId: string, accountId: string) {
  const account = await ctx.db.get('expenseAccounts', accountId);
  if (!account || account.userId !== userId || account.archivedAt) {
    throw new Error('Account not found.');
  }
  return account;
}
