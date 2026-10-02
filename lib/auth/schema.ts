import type { DBFieldAttribute } from "@better-auth/core/db";

export const authUserAdditionalFields = {
  firstName: {
    type: "string",
    required: false,
  },
  lastName: {
    type: "string",
    required: false,
  },
  role: {
    type: ["customer", "admin"],
    required: false,
    defaultValue: "customer",
    input: false,
  },
} satisfies Record<string, DBFieldAttribute>;
