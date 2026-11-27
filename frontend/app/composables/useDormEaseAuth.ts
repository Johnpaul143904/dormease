import type { AuthResponse, RegistrationPayload, UserRole } from "~/types/auth";

export const useDormEaseAuth = () => {
  const nuxtApp = useNuxtApp();
  const { clerkAuth, clerkUser } = nuxtApp.vueApp.runWithContext(() => ({
    clerkAuth: useAuth(),
    clerkUser: useUser(),
  }));
  const authApi = useAuthApi();
  const user = useState<AuthResponse["user"] | null>("auth-user", () => null);
  const role = useState<UserRole | null>("auth-role", () => null);
  const isAuthenticated = useState("is-authenticated", () => false);
  const logoutError = useState("auth-logout-error", () => "");

  function clearApplicationState() {
    user.value = null;
    role.value = null;
    isAuthenticated.value = false;
    nuxtApp.runWithContext(() => {
      useDormData().clearCache();
      useOperations().clearCache();
      useRecordSearch().clearCache();
    });
  }

  function applyProfile(response: AuthResponse) {
    user.value = response.user;
    role.value = response.user.role;
    isAuthenticated.value = true;
    logoutError.value = "";
  }

  async function waitForClerk() {
    if (clerkAuth.isLoaded.value) return;
    await new Promise<void>((resolve) => {
      const stop = watch(clerkAuth.isLoaded, (isLoaded) => {
        if (isLoaded) {
          stop();
          resolve();
        }
      });
    });
  }

  async function restoreSession() {
    await waitForClerk();
    if (!clerkAuth.isSignedIn.value) {
      clearApplicationState();
      return false;
    }

    try {
      let response: AuthResponse = await authApi.profile();

      const primaryEmail = clerkUser.user.value?.primaryEmailAddress;
      const verifiedEmail =
        primaryEmail?.verification?.status === "verified"
          ? primaryEmail.emailAddress.trim().toLowerCase()
          : null;
      if (verifiedEmail && verifiedEmail !== response.user.email.toLowerCase()) {
        response = await authApi.updateProfile({ email: verifiedEmail });
      }

      applyProfile(response);
      return true;
    } catch (error) {
      clearApplicationState();
      throw error;
    }
  }

  async function provisionSession(registration: RegistrationPayload = {}) {
    await waitForClerk();
    if (!clerkAuth.isSignedIn.value) {
      clearApplicationState();
      return false;
    }

    try {
      await authApi.register(registration);
      return await restoreSession();
    } catch (error) {
      clearApplicationState();
      throw error;
    }
  }

  async function logout() {
    logoutError.value = "";
    let signedOut = false;
    try {
      await clerkAuth.signOut.value();
      signedOut = true;
    } catch (error) {
      logoutError.value =
        error instanceof Error ? error.message : "Unable to sign out.";
    } finally {
      clearApplicationState();
    }

    if (signedOut) {
      await navigateTo("/login", { replace: true });
    }
  }

  return {
    isAuthenticated,
    role,
    user,
    logoutError,
    applyProfile,
    restoreSession,
    provisionSession,
    logout,
  };
};
