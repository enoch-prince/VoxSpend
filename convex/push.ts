"use node";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import webPush from "web-push";

// These need to be set in the Convex Dashboard
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || "missing";
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || "missing";

if (publicVapidKey !== "missing" && privateVapidKey !== "missing") {
  webPush.setVapidDetails(
    "mailto:example@voxspend.com",
    publicVapidKey,
    privateVapidKey
  );
}

export const sendReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    if (publicVapidKey === "missing") {
      console.warn("VAPID keys not configured in Convex environment.");
      return;
    }

    const subs = await ctx.runQuery(internal.subscriptions.getActiveSubscriptions);
    
    const notificationPayload = JSON.stringify({
      title: "Expense Reminder",
      body: "Did you spend anything today? Keep your budget accurate by logging it now!",
      url: "/"
    });

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
        console.error("Error sending push to", sub.endpoint, error);
        // Typically, if status is 410 (Gone), the subscription is expired/unsubscribed
      }
    }
  },
});
