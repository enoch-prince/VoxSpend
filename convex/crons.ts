import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Once-daily at 18:00 UTC. The 18:00 fire (~7pm West Africa, ~2pm Eastern)
// best catches the end-of-day "did you spend today" intent.
crons.cron('daily-expense-reminder', '0 18 * * *', internal.push.sendReminders, {});

export default crons;
