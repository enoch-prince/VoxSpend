import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    '[VoxSpend] VITE_CONVEX_URL is not set. Add it to your .env.local or Vercel environment variables.'
  );
}
export const convex = new ConvexHttpClient(convexUrl);
export { api };
