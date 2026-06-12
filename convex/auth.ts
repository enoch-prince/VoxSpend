import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';
import { query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});

// Returns the signed-in user's _id (or null). The client uses this to scope
// Dexie data by userId so multiple accounts on the same browser stay isolated.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId ?? null;
  },
});

// Single round-trip auth+verification state for the client. Replaces a pair
// of separate calls (`auth.me` + `verification.emailVerificationStatus`) that
// the client previously made together on every refresh / sign-in.
export const session = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { userId: null, emailVerified: false, email: null };
    }
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    return {
      userId,
      emailVerified: profile?.emailVerified === true,
      email: profile?.email ?? null,
    };
  },
});
