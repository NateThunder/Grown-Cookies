"use client";

import { FormEvent, useState } from "react";
import styles from "@/app/contact/page.module.css";

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

const CONTACT_FALLBACK_MESSAGE =
  "The enquiry form is temporarily unavailable. Please email orders@growncookies.co.uk directly.";

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => ({}))) as { error?: string; notice?: string };
  }

  const text = await response.text().catch(() => "");
  return { error: text || undefined } as { error?: string; notice?: string };
}

export default function ContactOrderForm() {
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
    };

    setStatus("submitting");
    setErrorMessage("");
    setSuccessMessage("");

    try {
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
    }
  }

  return (
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

        {status === "error" ? <p className={styles.formError}>{errorMessage}</p> : null}
        {status === "success" ? <p className={styles.formSuccess}>{successMessage}</p> : null}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Sending..." : "Send enquiry"}
        </button>
      </form>
  );
}
