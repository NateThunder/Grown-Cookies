import { getAuthenticatedUser } from "@/lib/auth/server";

export async function getAuthenticatedAccountUser(request: Request) {
  return getAuthenticatedUser(request);
}
