"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "../lib/auth-client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await signOut();
      router.push("/shows");
      router.refresh(); // re-render server components so the header updates
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        className ??
        "text-sm text-black/50 transition hover:text-black disabled:opacity-50"
      }
    >
      {pending ? "…" : "Se déconnecter"}
    </button>
  );
}
