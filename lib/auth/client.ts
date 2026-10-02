"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, lastLoginMethodClient } from "better-auth/client/plugins";
import { authUserAdditionalFields } from "./schema";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: authUserAdditionalFields,
    }),
    lastLoginMethodClient(),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
