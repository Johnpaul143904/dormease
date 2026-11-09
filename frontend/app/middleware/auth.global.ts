import { roleRouteRedirect } from "~/types/auth";

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login" || to.path === "/register") return;
  if (/^\/invitations\/accept\/[^/]+$/.test(to.path)) return;

  const auth = useAuth();
  const restored = await auth.restoreSession();

  if (!restored || !auth.isAuthenticated.value || !auth.role.value) {
    return navigateTo("/login", { replace: true });
  }

  const redirect = roleRouteRedirect(to.path, auth.role.value);
  if (redirect) return navigateTo(redirect, { replace: true });
});
