import { httpRouter } from 'convex/server';
import { auth } from './auth';

const http = httpRouter();

// Registers /api/auth/signin/:provider, /api/auth/signout, /api/auth/callback/:provider
auth.addHttpRoutes(http);

export default http;