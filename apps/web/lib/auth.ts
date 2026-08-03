import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { user, session, account, verification } from "@scenes/db";
import { getDb } from "./db";

// Server-side auth instance. Owns email/password and (when configured)
// Google, Facebook, and Apple.
// Needs DATABASE_URL + BETTER_AUTH_SECRET at runtime; BETTER_AUTH_URL is the
// canonical origin (http://localhost:3000 in dev, https://scenes.badoz.org in staging).
const db = getDb();

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

const facebook =
  process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
    ? {
        facebook: {
          clientId: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        },
      }
    : undefined;

// Apple's "client secret" is a signed JWT (not a static string) that expires
// after at most 6 months — see docs/deployment-runbook.md for how to
// generate/rotate it.
const apple =
  process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
    ? {
        apple: {
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET,
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
  socialProviders: { ...google, ...facebook, ...apple },
});
