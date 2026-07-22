import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb, user, session, account, verification } from "@scenes/db";

// Server-side auth instance. Owns email/password and (when configured) Google.
// Needs DATABASE_URL + BETTER_AUTH_SECRET at runtime; BETTER_AUTH_URL is the
// canonical origin (http://localhost:3000 in dev, https://scenes.badoz.org in staging).
const db = createDb();

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
  socialProviders: google,
});
