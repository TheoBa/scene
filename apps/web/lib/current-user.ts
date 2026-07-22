// TEMPORARY fake login. The onboarding flow needs "who is the user", but auth
// (better-auth) isn't wired yet. This hardcoded user lets the whole flow run
// end-to-end now; it gets replaced by the real session later — the onboarding
// UI won't change, it'll just receive a real user instead of this stub.
export interface CurrentUser {
  id: string;
  pseudo: string | null;
}

export function getCurrentUser(): CurrentUser {
  return { id: "stub-user", pseudo: null };
}
