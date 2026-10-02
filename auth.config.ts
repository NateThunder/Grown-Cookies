import { betterAuth } from "better-auth";
import { lastLoginMethod } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import Database from "better-sqlite3";
import { authUserAdditionalFields } from "./lib/auth/schema";

export const auth = betterAuth({
  ...withCloudflare(
    {
      autoDetectIpAddress: false,
      geolocationTracking: false,
    },
    {
      baseURL: "http://localhost:3000",
      user: {
        additionalFields: authUserAdditionalFields,
      },
      rateLimit: {
        enabled: true,
        storage: "database",
      },
      plugins: [
        lastLoginMethod({
          storeInDatabase: true,
          beforeStoreCookie: () => false,
        }),
      ],
    },
  ),
  database: new Database(".auth-schema.sqlite"),
});
