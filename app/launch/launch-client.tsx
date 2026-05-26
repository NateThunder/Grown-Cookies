"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import { launchSiteAction, relockSiteAction } from "@/app/admin/actions";
import styles from "./page.module.css";

const CONFETTI_COLORS = ["#e74c3c", "#f39c12", "#9b59b6", "#3498db", "#2ecc71", "#e91e63"];
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const LAUNCH_AUDIO_SRC = "/grown-cookies-launch.mp3";

type LaunchClientProps = {
  initialSiteLockEnabled: boolean;
};

function shouldReduceMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

function fireConfetti() {
  if (shouldReduceMotion()) {
    return;
  }

  const duration = 4000;
  const end = Date.now() + duration;

  function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: CONFETTI_COLORS,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: CONFETTI_COLORS,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }

  frame();

  confetti({
    particleCount: 150,
    spread: 100,
    origin: { y: 0.6 },
    colors: CONFETTI_COLORS,
  });
}

export default function LaunchClient({ initialSiteLockEnabled }: LaunchClientProps) {
  const [siteLockEnabled, setSiteLockEnabled] = useState(initialSiteLockEnabled);
  const [launchedThisSession, setLaunchedThisSession] = useState(false);
  const [isCompletingLaunch, setIsCompletingLaunch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const launchAudioRef = useRef<HTMLAudioElement | null>(null);
  const launchSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launched = !siteLockEnabled;

  useEffect(() => {
    const audio = new Audio(LAUNCH_AUDIO_SRC);
    audio.preload = "auto";
    audio.load();
    launchAudioRef.current = audio;

    return () => {
      if (launchSuccessTimerRef.current) {
        clearTimeout(launchSuccessTimerRef.current);
      }
      audio.pause();
      launchAudioRef.current = null;
    };
  }, []);

  const playLaunchAudio = useCallback(() => {
    const audio = launchAudioRef.current ?? new Audio(LAUNCH_AUDIO_SRC);
    launchAudioRef.current = audio;
    audio.preload = "auto";
    audio.pause();
    audio.currentTime = 0;

    void audio.play().catch(() => {
      setActionError("Launch audio could not be played by this browser.");
    });
  }, []);

  const handleLaunch = useCallback(() => {
    if (launched || isSaving) {
      return;
    }

    setIsSaving(true);
    setActionError(null);
    playLaunchAudio();

    void launchSiteAction()
      .then((result) => {
        if (!result.ok) {
          setActionError(result.error);
          return;
        }

        setSiteLockEnabled(result.enabled);
        setIsCompletingLaunch(true);
        launchSuccessTimerRef.current = setTimeout(() => {
          setLaunchedThisSession(true);
          setIsCompletingLaunch(false);
          launchSuccessTimerRef.current = null;
        }, 300);
        fireConfetti();
      })
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : "The site could not be launched.");
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [isSaving, launched, playLaunchAudio]);

  const handleReset = useCallback(() => {
    if (isSaving) {
      return;
    }

    const confirmed = window.confirm(
      "Re-lock the public site? Visitors will see the private preview screen again.",
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setActionError(null);

    void relockSiteAction()
      .then((result) => {
        if (!result.ok) {
          setActionError(result.error);
          return;
        }

        if (launchSuccessTimerRef.current) {
          clearTimeout(launchSuccessTimerRef.current);
          launchSuccessTimerRef.current = null;
        }
        setSiteLockEnabled(result.enabled);
        setLaunchedThisSession(false);
        setIsCompletingLaunch(false);
        launchAudioRef.current?.pause();
      })
      .catch((error: unknown) => {
        setActionError(
          error instanceof Error ? error.message : "The site lock could not be enabled.",
        );
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [isSaving]);

  return (
    <section
      className={`${styles.launchSection} ${launched ? styles.launchSectionLive : ""}`}
      aria-labelledby="launch-eyebrow"
    >
      <div className={styles.launchStack}>
        <p id="launch-eyebrow" className={styles.eyebrow}>Site Launch</p>

        <div className={styles.launchSwitch} aria-live="polite">
          {!launchedThisSession ? (
            <div
              key="button"
              className={`${styles.launchState} ${isCompletingLaunch ? styles.launchStateExiting : ""}`}
            >
              <div className={styles.statusPanel}>
                <p className={styles.statusLabel}>Current Status</p>
                <div className={styles.statusLine}>
                  <span
                    className={`${styles.statusDot} ${launched ? styles.statusDotLive : styles.statusDotWaiting}`}
                    aria-hidden="true"
                  />
                  <span>{launched ? "Live" : "Not Live"}</span>
                </div>
                <p className={styles.statusNote}>
                  {launched ? "The public site is open." : "Your site is waiting to be launched."}
                </p>
              </div>

              <div className={styles.buttonStage}>
                <button
                  type="button"
                  className={`${styles.launchButton} ${launched ? styles.launchButtonLive : ""}`}
                  onClick={handleLaunch}
                  disabled={launched || isSaving}
                >
                  <span>{launched ? "Live" : "Launch"}</span>
                </button>

                {launched ? (
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={handleReset}
                    disabled={isSaving}
                  >
                    Re-lock Site
                  </button>
                ) : (
                  <p className={styles.hint}>Ready when you are.</p>
                )}
              </div>
            </div>
          ) : (
            <div key="success" className={`${styles.launchState} ${styles.successState}`}>
              <div className={styles.statusPanel}>
                <p className={styles.statusLabel}>Current Status</p>
                <div className={styles.statusLine}>
                  <span
                    className={`${styles.statusDot} ${styles.statusDotLive}`}
                    aria-hidden="true"
                  />
                  <span>Live</span>
                </div>
                <p className={styles.statusNote}>Just now</p>
              </div>

              <div className={styles.successMark} aria-hidden="true">!</div>
              <h2 className={styles.successTitle}>Congratulations!</h2>
              <p className={styles.successMessage}>
                Your site is now live and ready for the world to see.
              </p>
              <button
                type="button"
                className={styles.resetButton}
                onClick={handleReset}
                disabled={isSaving}
              >
                Re-lock Site
              </button>
            </div>
          )}

          {actionError ? (
            <p className={styles.actionError} role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
