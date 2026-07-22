"use client";

import { createAuthClient } from "better-auth/react";

// Talks to the /api/auth handler on the current origin.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;

// Only true when the server has Google credentials wired (see lib/auth.ts).
// Lets the UI hide the Google button until the OAuth client exists.
export const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";
