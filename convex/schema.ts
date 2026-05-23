import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

export default defineSchema({
  ...authTables,

  expenses: defineTable({
    userId: v.id('users'),
    amount: v.number(),
    currency: v.string(),
    type: v.union(v.literal('expense'), v.literal('income')),
    category: v.string(),
    merchant: v.string(),
    note: v.string(),
    date: v.string(),
    momoAccountId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_date', ['userId', 'date']),

  categories: defineTable({
    userId: v.id('users'),
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    isCustom: v.boolean(),
    createdAt: v.string(),
  }).index('by_user', ['userId']),

  pushSubscriptions: defineTable({
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
    enabled: v.boolean(),
  }).index('by_endpoint', ['endpoint']),
});