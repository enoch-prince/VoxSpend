import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Schedule the reminder to run every day at 18:00 (6:00 PM) UTC
// crons.daily(
//   "daily-expense-reminder",
//   { hourUTC: 18, minuteUTC: 0 },
//   internal.push.sendReminders
// );

// Schedule the reminder to run every day at 12:00 & 18:00 (6:00 PM) UTC
crons.cron('daily-expense-reminder', '0 12,18 * * *', internal.push.sendReminders, {});

export default crons;
