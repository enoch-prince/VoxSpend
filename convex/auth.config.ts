// @convex-dev/auth signs tokens using CONVEX_SITE_URL as the issuer.
// This tells Convex to trust JWTs issued by the auth system.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};