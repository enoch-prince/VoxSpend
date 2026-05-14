import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const convexUrl = import.meta.env.VITE_CONVEX_URL || "";
export const convex = new ConvexHttpClient(convexUrl);
export { api };
