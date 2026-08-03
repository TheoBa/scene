"use client";

import { createAuthClient } from "better-auth/react";

// Talks to the /api/auth handler on the current origin.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;

// Only true when the server has the matching provider's credentials wired
// (see lib/auth.ts). Lets the UI hide each social button until its OAuth
// client exists.
export const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";
export const facebookEnabled = process.env.NEXT_PUBLIC_FACEBOOK_ENABLED === "true";
export const appleEnabled = process.env.NEXT_PUBLIC_APPLE_ENABLED === "true";
