import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const ADMIN_EMAIL = "orders@growncookies.co.uk";

function parseCsv(source) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...dataRows] = rows.filter((candidate) => candidate.some(Boolean));
  if (!headers) return [];

  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function parseJsonValue(value, fallback) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sql(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function stableId(prefix, ...parts) {
  const digest = createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
  return `${prefix}_${digest}`;
}

function normalizeDate(value, fallback) {
  const date = value ? new Date(value) : new Date(fallback);
  if (Number.isNaN(date.getTime())) return new Date(fallback).toISOString();
  return date.toISOString();
}

function text(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized.toLowerCase() === "null" || normalized === "\\N" ? "" : normalized;
}

function identityProviderId(identity) {
  const identityData = parseJsonValue(identity.identity_data ?? identity.identityData, {});
  return text(identity.provider_id ?? identity.providerId) || text(identityData.sub);
}

const inputPath = resolve(process.argv[2] || "migration-private/supabase-auth-users.csv");
const outputPath = resolve(process.argv[3] || "migration-private/better-auth-import.sql");
const source = await readFile(inputPath, "utf8");
const parsed = extname(inputPath).toLowerCase() === ".json" ? JSON.parse(source) : parseCsv(source);
const rows = Array.isArray(parsed) ? parsed : parsed.users;

if (!Array.isArray(rows)) {
  throw new Error("Expected a CSV export or a JSON array of Supabase auth users.");
}

const now = new Date();
const seenEmails = new Set();
const statements = [
  "-- Contains password hashes. Keep this file private and delete it after cutover.",
  "PRAGMA foreign_keys = ON;",
  "BEGIN TRANSACTION;",
];
const skipped = [];
let importedUsers = 0;
let importedPasswords = 0;
let importedGoogleAccounts = 0;

for (const row of rows) {
  const id = text(row.id);
  const email = text(row.email).toLowerCase();
  const deletedAt = text(row.deleted_at ?? row.deletedAt);
  const bannedUntil = text(row.banned_until ?? row.bannedUntil);
  const bannedDate = bannedUntil ? new Date(bannedUntil) : null;

  if (!id || !email) {
    skipped.push({ id: id || "(missing)", email: email || "(missing)", reason: "missing id or email" });
    continue;
  }
  if (deletedAt) {
    skipped.push({ id, email, reason: "deleted account" });
    continue;
  }
  if (bannedDate && !Number.isNaN(bannedDate.getTime()) && bannedDate > now) {
    skipped.push({ id, email, reason: "currently banned account" });
    continue;
  }
  if (seenEmails.has(email)) {
    throw new Error(`Duplicate normalized email in export: ${email}`);
  }
  seenEmails.add(email);

  const metadata = parseJsonValue(row.raw_user_meta_data ?? row.rawUserMetaData, {});
  const firstName = text(metadata.first_name ?? metadata.firstName ?? metadata.given_name);
  const lastName = text(metadata.last_name ?? metadata.lastName ?? metadata.family_name);
  const name = text(metadata.full_name ?? metadata.name) || [firstName, lastName].filter(Boolean).join(" ") || email;
  const createdAt = normalizeDate(row.created_at ?? row.createdAt, now);
  const updatedAt = normalizeDate(row.updated_at ?? row.updatedAt, createdAt);
  const emailVerified = Boolean(text(row.email_confirmed_at ?? row.emailConfirmedAt ?? row.confirmed_at));
  const role = email === ADMIN_EMAIL ? "admin" : "customer";

  statements.push(
    `INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "lastLoginMethod", "firstName", "lastName", "role") VALUES (${[
      id,
      name,
      email,
      emailVerified ? 1 : 0,
      text(metadata.avatar_url ?? metadata.picture) || null,
      createdAt,
      updatedAt,
      null,
      firstName || null,
      lastName || null,
      role,
    ].map(sql).join(", ")});`,
  );

  const encryptedPassword = text(row.encrypted_password ?? row.encryptedPassword);
  if (encryptedPassword) {
    statements.push(
      `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt") VALUES (${[
        stableId("credential", id),
        id,
        "credential",
        id,
        encryptedPassword,
        createdAt,
        updatedAt,
      ].map(sql).join(", ")});`,
    );
    importedPasswords += 1;
  }

  const identities = parseJsonValue(row.identities, []);
  if (Array.isArray(identities)) {
    for (const identity of identities) {
      if (text(identity.provider).toLowerCase() !== "google") continue;
      const providerAccountId = identityProviderId(identity);
      if (!providerAccountId) continue;
      const identityCreatedAt = normalizeDate(identity.created_at ?? identity.createdAt, createdAt);
      const identityUpdatedAt = normalizeDate(identity.updated_at ?? identity.updatedAt, updatedAt);
      statements.push(
        `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES (${[
          stableId("google", id, providerAccountId),
          providerAccountId,
          "google",
          id,
          identityCreatedAt,
          identityUpdatedAt,
        ].map(sql).join(", ")});`,
      );
      importedGoogleAccounts += 1;
    }
  }

  importedUsers += 1;
}

statements.push(
  "COMMIT;",
  "",
  "-- Post-import validation",
  'SELECT COUNT(*) AS imported_users FROM "user";',
  'SELECT COUNT(*) AS imported_password_accounts FROM "account" WHERE "providerId" = \'credential\';',
  'SELECT COUNT(*) AS imported_google_accounts FROM "account" WHERE "providerId" = \'google\';',
  `SELECT COUNT(*) AS admin_users FROM "user" WHERE "role" = 'admin' AND lower("email") = '${ADMIN_EMAIL}';`,
  `SELECT COUNT(*) AS unexpected_admins FROM "user" WHERE "role" = 'admin' AND lower("email") <> '${ADMIN_EMAIL}';`,
  "",
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, statements.join("\n"), { mode: 0o600 });

console.log(`Prepared ${importedUsers} users, ${importedPasswords} password accounts, and ${importedGoogleAccounts} Google accounts.`);
console.log(`Skipped ${skipped.length} users.`);
for (const entry of skipped) console.log(`- ${entry.email}: ${entry.reason}`);
console.log(`Private SQL written to ${outputPath}`);
