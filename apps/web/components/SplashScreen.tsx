"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./SplashScreen.module.css";

const WORD = "SCENES";
const SESSION_KEY = "scenes_splash_seen";

// Black theatre-curtain intro. Shows once per browser session: the wordmark
// rises in letter by letter, then the panel lifts to reveal the app. Skipped
// on later navigations/reloads within the same session, and shortened for
// visitors who prefer reduced motion.
export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setVisible(false);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "true");

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Matches the CSS: curtain finishes ~2.7s (or a quick fade when reduced).
    const holdMs = reduced ? 900 : 2750;

    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => setVisible(false), holdMs);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.splash} aria-hidden>
      <span className={styles.wordmark}>
        {WORD.split("").map((letter, i) => (
          <span
            key={i}
            className={styles.letter}
            style={{ "--i": i } as CSSProperties}
          >
            {letter}
          </span>
        ))}
      </span>
      <span className={styles.rule} />
    </div>
  );
}
