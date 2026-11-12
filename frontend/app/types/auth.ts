export type UserRole = "ADMIN" | "STAFF" | "TENANT";

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  contactNumber?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
}

const dashboardRoutes: Record<UserRole, string> = {
  ADMIN: "/admin/dashboard",
  STAFF: "/staff/dashboard",
  TENANT: "/tenant/dashboard",
};

export const dashboardRouteForRole = (role: UserRole) => dashboardRoutes[role];

const adminRoutes = [
  "/rooms",
  "/tenants",
  "/assignments",
  "/invitations",
  "/payments",
  "/maintenance",
];

export function roleRouteRedirect(path: string, role: UserRole): string | null {
  const home = dashboardRouteForRole(role);
  if (path === "/" || path === "/dashboard") return home;

  const isTenantRoute = path === "/tenant" || path.startsWith("/tenant/");
  const isStaffRoute = path === "/staff" || path.startsWith("/staff/");
  const isAdminRoute =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    adminRoutes.some((base) => path === base || path.startsWith(`${base}/`));

  if (isTenantRoute && role !== "TENANT") return home;
  if (isStaffRoute && role !== "STAFF") return home;
  if (isAdminRoute && role === "TENANT") return home;
  if (path === "/admin/dashboard" && role === "STAFF") return home;
  return null;
}

export interface RegistrationPayload {
  accountType?: "ADMIN" | "TENANT";
  invitationCode?: string;
}

export interface AuthResponse {
  user: AuthUser;
}
