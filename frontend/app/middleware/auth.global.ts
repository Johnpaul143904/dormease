import { roleRouteRedirect } from "~/types/auth";

function getErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }
  return undefined;
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (
    [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/auth/complete",
    ].includes(to.path)
  ) {
    return;
  }
  if (/^\/invitations\/accept\/[^/]+$/.test(to.path)) return;
  if (import.meta.server) return;

  const clerkAuth = useAuth();
  if (!clerkAuth.isLoaded.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(clerkAuth.isLoaded, (isLoaded) => {
        if (isLoaded) {
          stop();
          resolve();
        }
      });
    });
  }

  if (!clerkAuth.isSignedIn.value) {
    return navigateTo(
      { path: "/login", query: { redirect: to.fullPath } },
      { replace: true },
    );
  }

  const auth = useDormEaseAuth();
  try {
    const restored = await auth.restoreSession();
    if (!restored || !auth.isAuthenticated.value || !auth.role.value) {
      return navigateTo("/login", { replace: true });
    }
  } catch (error) {
    const status = getErrorStatus(error);
    return navigateTo(
      {
        path: "/login",
        query: {
          redirect: to.fullPath,
          authError: status === 403 ? "verify-email" : "session",
        },
      },
      { replace: true },
    );
  }

  const redirect = roleRouteRedirect(to.path, auth.role.value);
  if (redirect) return navigateTo(redirect, { replace: true });
});
