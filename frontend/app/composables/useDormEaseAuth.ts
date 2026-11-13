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

  function applyProfile(response: AuthResponse) {
    user.value = response.user;
    role.value = response.user.role;
    isAuthenticated.value = true;
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
      user.value = null;
      role.value = null;
      isAuthenticated.value = false;
      return false;
    }

    let payload: RegistrationPayload = { ...registration };
    if (!payload.accountType || payload.accountType === "TENANT") {
      const unsafe = clerkUser.user.value?.unsafeMetadata as
        | Record<string, unknown>
        | undefined;
      if (
        unsafe &&
        (unsafe.accountType === "TENANT" || unsafe.accountType === "ADMIN")
      ) {
        payload = {
          accountType: unsafe.accountType,
          ...(typeof unsafe.invitationCode === "string" && unsafe.invitationCode.trim()
            ? { invitationCode: unsafe.invitationCode.trim() }
            : {}),
        };
      }
    }

    let response: AuthResponse;
    try {
      response = await authApi.profile();
    } catch (error) {
      if (getErrorStatus(error) !== 401) throw error;
      await authApi.register(payload);
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
  }

  async function logout() {
    try {
      await clerkAuth.signOut.value();
    } finally {
      user.value = null;
      role.value = null;
      isAuthenticated.value = false;
      await navigateTo("/login");
    }
  }

  return {
    isAuthenticated,
    role,
    user,
    applyProfile,
    restoreSession,
    logout,
  };
};
