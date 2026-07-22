import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// All better-auth endpoints (sign-in, sign-up, session, OAuth callbacks) live
// under /api/auth/*.
export const { GET, POST } = toNextJsHandler(auth);
