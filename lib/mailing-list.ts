import {
  executeCloudflareD1,
  hasCloudflareD1Config,
  queryCloudflareD1,
} from "@/lib/cloudflare-d1";

const MAILING_LIST_UNAVAILABLE_MESSAGE = "Mailing list storage is unavailable.";

let schemaReadyPromise: Promise<void> | null = null;

type MailingListSubscriberRow = {
  id: number;
  email: string;
  source: string;
  status: string;
  subscribed_at: string;
  created_at: string;
  updated_at: string;
};

export type MailingListSubscriber = {
  id: number;
  email: string;
  source: string;
  status: string;
  subscribedAt: string;
  createdAt: string;
  updatedAt: string;
};

export class MailingListStorageError extends Error {
  constructor() {
    super(MAILING_LIST_UNAVAILABLE_MESSAGE);
    this.name = "MailingListStorageError";
  }
}

export class MailingListDuplicateSubscriberError extends Error {
  constructor() {
    super("Email already on the mailing list.");
    this.name = "MailingListDuplicateSubscriberError";
  }
}

export function normalizeMailingListEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidMailingListEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeSource(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized ? normalized.slice(0, 64) : "footer";
}

async function ensureMailingListSchema() {
  if (!hasCloudflareD1Config()) {
    throw new MailingListStorageError();
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await executeCloudflareD1(
        `CREATE TABLE IF NOT EXISTS mailing_list_subscribers (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           email TEXT NOT NULL,
           email_normalized TEXT NOT NULL UNIQUE,
           source TEXT NOT NULL DEFAULT 'footer',
           status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
           subscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      );

      await executeCloudflareD1(
        `CREATE INDEX IF NOT EXISTS idx_mailing_list_subscribers_status
         ON mailing_list_subscribers(status)`,
      );

      await executeCloudflareD1(
        `CREATE INDEX IF NOT EXISTS idx_mailing_list_subscribers_subscribed_at
         ON mailing_list_subscribers(subscribed_at)`,
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

export async function subscribeToMailingList({
  email,
  source = "footer",
}: {
  email: string;
  source?: string;
}) {
  const normalizedEmail = normalizeMailingListEmail(email);

  if (!isValidMailingListEmail(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  await ensureMailingListSchema();

  const result = await executeCloudflareD1(
    `INSERT OR IGNORE INTO mailing_list_subscribers (
       email,
       email_normalized,
       source,
       status,
       subscribed_at,
       updated_at
     )
     VALUES (?, ?, ?, 'subscribed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [email.trim(), normalizedEmail, normalizeSource(source)],
  );

  const changedRows = Number(result.meta.changes ?? 0);

  if (!Number.isFinite(changedRows) || changedRows < 1) {
    throw new MailingListDuplicateSubscriberError();
  }
}

export async function getMailingListSubscribers(): Promise<MailingListSubscriber[]> {
  await ensureMailingListSchema();

  const rows = await queryCloudflareD1<MailingListSubscriberRow>(
    `SELECT
       id,
       email,
       source,
       status,
       subscribed_at,
       created_at,
       updated_at
     FROM mailing_list_subscribers
     WHERE status = 'subscribed'
     ORDER BY subscribed_at DESC, id DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    source: row.source,
    status: row.status,
    subscribedAt: row.subscribed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function deleteMailingListSubscriber(subscriberId: number) {
  if (!Number.isInteger(subscriberId) || subscriberId <= 0) {
    throw new Error("The subscriber record could not be found.");
  }

  await ensureMailingListSchema();

  const result = await executeCloudflareD1(
    `DELETE FROM mailing_list_subscribers
     WHERE id = ?`,
    [subscriberId],
  );
  const changedRows = Number(result.meta.changes ?? 0);

  if (!Number.isFinite(changedRows) || changedRows < 1) {
    throw new Error("The subscriber record could not be found.");
  }
}
