export type AppAuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: "customer" | "admin" | null;
  lastLoginMethod?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function getAuthUserDisplayName(user: AppAuthUser | null | undefined) {
  if (!user) {
    return "";
  }

  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.name.trim() ||
    user.email
  );
}
export function isAdminAuthUser(user: AppAuthUser | null | undefined) {
  return (
    user?.role === "admin" &&
    user.email.trim().toLowerCase() === "orders@growncookies.co.uk"
  );
}
