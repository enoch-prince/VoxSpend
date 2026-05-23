import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  pushSubscriptions: defineTable({
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
    enabled: v.boolean(),
    // Store user identifier if we add auth later. For now, an anonymous local-first PWA can just use the subscription endpoint as a unique key.
  }).index('by_endpoint', ['endpoint']),
});
