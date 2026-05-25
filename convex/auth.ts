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
