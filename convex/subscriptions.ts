import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const saveSubscription = mutation({
  args: {
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing) {
      // Update keys if they changed and ensure it's enabled
      await ctx.db.patch(existing._id, { keys: args.keys, enabled: true });
    } else {
      await ctx.db.insert("pushSubscriptions", {
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
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: false });
    }
  },
});
