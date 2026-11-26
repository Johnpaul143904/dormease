import { dashboardRouteForRole, roleRouteRedirect } from "~/types/auth";

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
  const isLoginPage = to.path === "/login";
  if (
    [
      "/register",
      "/forgot-password",
      "/reset-password",
      "/auth/complete",
    ].includes(to.path) ||
    to.path.startsWith("/register/")
  ) {
    return;
  }
  if (/^\/invitations\/accept\/[^/]+$/.test(to.path)) return;
  if (import.meta.server) return;

  const vueApp = useNuxtApp().vueApp;
  const { clerkAuth, auth } = vueApp.runWithContext(() => ({
    clerkAuth: useAuth(),
    auth: useDormEaseAuth(),
  }));
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
    if (isLoginPage) return;
    return navigateTo(
      { path: "/login", query: { redirect: to.fullPath } },
      { replace: true },
    );
  }

  try {
    const restored = await auth.restoreSession();
    if (!restored || !auth.isAuthenticated.value || !auth.role.value) {
      if (isLoginPage) return;
      return navigateTo("/login", { replace: true });
    }
  } catch (error) {
    const status = getErrorStatus(error);
    if (isLoginPage) {
      if (to.query.authError) return;
      return navigateTo(
        {
          path: "/login",
          query: {
            authError: status === 403 ? "verify-email" : "session",
          },
        },
        { replace: true },
      );
    }
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

  if (isLoginPage) {
    return navigateTo(dashboardRouteForRole(auth.role.value), {
      replace: true,
    });
  }

  const redirect = roleRouteRedirect(to.path, auth.role.value);
  if (redirect) return navigateTo(redirect, { replace: true });
});
