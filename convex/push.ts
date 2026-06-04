'use node';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import webPush from 'web-push';

// These need to be set in the Convex Dashboard
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'missing';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'missing';

if (publicVapidKey !== 'missing' && privateVapidKey !== 'missing') {
  webPush.setVapidDetails('mailto:example@voxspend.com', publicVapidKey, privateVapidKey);
}

export const sendReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    if (publicVapidKey === 'missing') {
      console.warn('VAPID keys not configured in Convex environment.');
      return;
    }

    const pageSize = 100;
    let cursor: string | null = null;
    const notificationPayload = JSON.stringify({
      title: 'Expense Reminder',
      body: 'Did you spend anything today? Keep your budget accurate by logging it now!',
      url: '/',
    });

    do {
      const result = await ctx.runQuery(internal.subscriptions.getActiveSubscriptions, {
        paginationOpts: { numItems: pageSize, cursor },
      });

      const subs = result.page;
      cursor = result.continueCursor;

      for (const sub of subs) {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            notificationPayload
          );
        } catch (error: any) {
          console.error('Error sending push to', sub.endpoint, error);
          // Typically, if status is 410 (Gone), the subscription is expired/unsubscribed
        }
      }
    } while (cursor);
  },
});
