import { mutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

// Returns every enabled push subscription in a single query result.
// Bounded by Convex's per-query limits (16k docs / 8MB). At ~400 bytes per
// row this comfortably fits well past any realistic install base; revisit
// with chunking only if active subs approach ~10k.
export const getActiveSubscriptions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_enabled', (q) => q.eq('enabled', true))
      .collect();
  },
});

export const saveSubscription = mutation({
  args: {
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (existing) {
      // Update keys if they changed and ensure it's enabled
      await ctx.db.patch(existing._id, { keys: args.keys, enabled: true });
    } else {
      await ctx.db.insert('pushSubscriptions', {
        endpoint: args.endpoint,
        keys: args.keys,
        enabled: true,
      });
    }
  },
});

export const removeSubscription = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: false });
    }
  },
});
