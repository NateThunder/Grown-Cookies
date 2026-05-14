"use client";

import { FormEvent, useId, useState } from "react";

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

const MAILING_LIST_FALLBACK_MESSAGE =
  "Mailing list signup is temporarily unavailable. Please try again later.";

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => ({}))) as { error?: string };
  }

  const text = await response.text().catch(() => "");
  return { error: text || undefined } as { error?: string };
}

export default function MailingListSignupForm() {
  const emailInputId = useId();
  const statusMessageId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/mailing-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          source: "footer",
        }),
      });

      const data = await readResponsePayload(response);

      if (!response.ok) {
        const errorMessage =
          response.status >= 500
            ? MAILING_LIST_FALLBACK_MESSAGE
            : data.error || "Unable to sign you up.";
        throw new Error(errorMessage);
      }

      setEmail("");
      setStatus("success");
      setMessage("Thanks for signing up.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : MAILING_LIST_FALLBACK_MESSAGE);
    }
  }

  return (
    <div className="site-footer-signup">
      <form className="site-footer-form" aria-label="Newsletter signup" onSubmit={handleSubmit}>
        <label htmlFor={emailInputId} className="sr-only">
          Email address
        </label>
        <input
          id={emailInputId}
          name="email"
          type="email"
          placeholder="Email address"
          className="site-footer-input"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={message ? statusMessageId : undefined}
          disabled={status === "submitting"}
          required
        />
        <button type="submit" className="site-footer-button" disabled={status === "submitting"}>
          {status === "submitting" ? "Signing up..." : "Sign up"}
        </button>
      </form>

      {message ? (
        <p
          id={statusMessageId}
          className={`site-footer-status ${
            status === "error" ? "site-footer-status-error" : ""
          }`.trim()}
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
