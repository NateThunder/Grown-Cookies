"use client";

import Script from "next/script";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import styles from "@/app/contact/page.module.css";

type SubmissionStatus = "idle" | "submitting" | "success" | "error";
type TurnstileWidgetId = string;

type TurnstileRenderOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  "error-callback"?: (errorCode?: string) => void;
  "expired-callback"?: () => void;
};

type TurnstileApi = {
  ready?: (callback: () => void) => void;
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => TurnstileWidgetId;
  reset: (widgetId?: TurnstileWidgetId) => void;
  remove: (widgetId: TurnstileWidgetId) => void;
  getResponse?: (widgetId?: TurnstileWidgetId) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const CONTACT_FALLBACK_MESSAGE =
  "The enquiry form is temporarily unavailable. Please email orders@growncookies.co.uk directly.";
const TURNSTILE_VERIFICATION_MESSAGE = "Complete the verification check and try again.";

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => ({}))) as { error?: string; notice?: string };
  }

  const text = await response.text().catch(() => "");
  return { error: text || undefined } as { error?: string; notice?: string };
}

type ContactOrderFormProps = {
  turnstileSiteKey: string;
};

export default function ContactOrderForm({ turnstileSiteKey }: ContactOrderFormProps) {
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const [turnstileUnavailable, setTurnstileUnavailable] = useState(!turnstileSiteKey);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<TurnstileWidgetId | null>(null);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken("");

    if (turnstileWidgetIdRef.current) {
      window.turnstile?.reset(turnstileWidgetIdRef.current);
    }
  }, []);

  const renderTurnstile = useCallback(() => {
    const turnstile = window.turnstile;

    if (
      !turnstile ||
      !turnstileSiteKey ||
      !turnstileContainerRef.current ||
      turnstileWidgetIdRef.current
    ) {
      return;
    }

    turnstileWidgetIdRef.current = turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token) => {
        setTurnstileToken(token);
      },
      "error-callback": () => {
        setTurnstileToken("");
      },
      "expired-callback": () => {
        setTurnstileToken("");
      },
    });
  }, [turnstileSiteKey]);

  useEffect(() => {
    if (!turnstileScriptReady) {
      return;
    }

    const turnstile = window.turnstile;

    if (!turnstile) {
      return;
    }

    if (turnstile.ready) {
      turnstile.ready(renderTurnstile);
      return;
    }

    renderTurnstile();
  }, [renderTurnstile, turnstileScriptReady]);

  useEffect(() => {
    return () => {
      if (turnstileWidgetIdRef.current) {
        window.turnstile?.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      subject: String(formData.get("subject") ?? "").trim(),
      message: String(formData.get("message") ?? "").trim(),
      turnstileToken:
        turnstileToken ||
        (turnstileWidgetIdRef.current
          ? window.turnstile?.getResponse?.(turnstileWidgetIdRef.current) ?? ""
          : ""),
    };

    setStatus("submitting");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!turnstileSiteKey || turnstileUnavailable) {
        throw new Error(CONTACT_FALLBACK_MESSAGE);
      }

      if (!payload.turnstileToken) {
        throw new Error(TURNSTILE_VERIFICATION_MESSAGE);
      }

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readResponsePayload(response);

      if (!response.ok) {
        const message =
          response.status >= 500 ? CONTACT_FALLBACK_MESSAGE : data.error || "Unable to send your message.";
        throw new Error(message);
      }

      form.reset();
      setStatus("success");
      setSuccessMessage(
        data.notice ?? "Thanks. Your message has been sent and we will reply by email.",
      );
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to send your message.");
    } finally {
      resetTurnstile();
    }
  }

  return (
    <>
      {turnstileSiteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => {
            setTurnstileScriptReady(true);
          }}
          onError={() => {
            setTurnstileUnavailable(true);
            setStatus("error");
            setErrorMessage(CONTACT_FALLBACK_MESSAGE);
          }}
        />
      ) : null}

      <form className={`${styles.contactForm} whiteFrame`} onSubmit={handleSubmit} autoComplete="on">
        <div className={styles.formRow}>
          <input
            type="text"
            name="name"
            placeholder="Name"
            aria-label="Name"
            className={styles.input}
            autoComplete="name"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            aria-label="Email"
            className={styles.input}
            autoComplete="email"
            inputMode="email"
            required
          />
        </div>

        <div className={styles.formRow}>
          <input
            type="tel"
            name="phone"
            placeholder="Phone"
            aria-label="Phone"
            className={styles.input}
            autoComplete="tel"
            inputMode="tel"
          />
          <input
            type="text"
            name="subject"
            placeholder="Order type or subject"
            aria-label="Order type or subject"
            className={styles.input}
            autoComplete="off"
          />
        </div>

        <textarea
          name="message"
          placeholder="Tell us what you need, quantities, dates, flavours, delivery details, or event notes."
          aria-label="Message"
          className={styles.textarea}
          autoComplete="off"
          required
        />

        {turnstileSiteKey ? (
          <div ref={turnstileContainerRef} aria-label="Verification check" />
        ) : (
          <p className={styles.formError}>{CONTACT_FALLBACK_MESSAGE}</p>
        )}

        {status === "error" ? <p className={styles.formError}>{errorMessage}</p> : null}
        {status === "success" ? <p className={styles.formSuccess}>{successMessage}</p> : null}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={status === "submitting" || !turnstileSiteKey}
        >
          {status === "submitting" ? "Sending..." : "Send enquiry"}
        </button>
      </form>
    </>
  );
}
