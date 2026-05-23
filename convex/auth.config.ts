// Configure your JWT auth provider here.
// See: https://docs.convex.dev/auth
//
// Example for Clerk:
//   {
//     domain: "https://your-clerk-domain.clerk.accounts.dev",
//     applicationID: "convex",
//   }
//
// Once a provider is added, change the `console.warn` lines in voice.ts and
// subscriptions.ts to `throw new Error('Unauthorized')` to start enforcing.
export default {
  providers: [],
};