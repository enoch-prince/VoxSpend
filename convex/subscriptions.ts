import { mutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const getActiveSubscriptions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('pushSubscriptions')
      .filter((q) => q.eq(q.field('enabled'), true))
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
    // Auth guard — enforces identity once auth.config.ts has a provider configured.
    // TODO: Replace console.warn with `throw new Error('Unauthorized')` when auth is enabled.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.warn('[subscriptions] Unauthenticated call to saveSubscription');
    }

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
    // Auth guard — enforces identity once auth.config.ts has a provider configured.
    // TODO: Replace console.warn with `throw new Error('Unauthorized')` when auth is enabled.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.warn('[subscriptions] Unauthenticated call to removeSubscription');
    }

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: false });
    }
  },
});
