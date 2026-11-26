import type { AuthResponse, RegistrationPayload, UserRole } from "~/types/auth";

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

export const useDormEaseAuth = () => {
  const clerkAuth = useAuth();
  const clerkUser = useUser();
  const authApi = useAuthApi();
  const user = useState<AuthResponse["user"] | null>("auth-user", () => null);
  const role = useState<UserRole | null>("auth-role", () => null);
  const isAuthenticated = useState("is-authenticated", () => false);
  const logoutError = useState("auth-logout-error", () => "");
  const clearDormDataCache = useDormData().clearCache;
  const clearOperationsCache = useOperations().clearCache;
  const clearRecordSearchCache = useRecordSearch().clearCache;

  function clearApplicationState() {
    user.value = null;
    role.value = null;
    isAuthenticated.value = false;
    clearDormDataCache();
    clearOperationsCache();
    clearRecordSearchCache();
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

  async function restoreSession(registration: RegistrationPayload = {}) {
    await waitForClerk();
    if (!clerkAuth.isSignedIn.value) {
      clearApplicationState();
      return false;
    }

    try {
      let response: AuthResponse;
      try {
        response = await authApi.profile();
      } catch (error) {
        if (getErrorStatus(error) !== 401) throw error;
        await authApi.register(registration);
        response = await authApi.profile();
      }

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
    logout,
  };
};
