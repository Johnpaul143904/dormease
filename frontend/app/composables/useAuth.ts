import type { AuthResponse, UserRole } from "~/types/auth";

export const useAuth = () => {
  const isAuthenticated = useState("is-authenticated", () => false);
  const role = useState<UserRole | null>("auth-role", () => null);
  const user = useState<AuthResponse["user"] | null>("auth-user", () => null);
  function applySession(response: AuthResponse, _remember = true) {
    user.value = response.user;
    role.value = response.user.role;
    isAuthenticated.value = true;
  }

  async function restoreSession() {
    if (isAuthenticated.value && user.value && role.value === user.value.role) {
      return true;
    }
    try {
      const response = await useAuthApi().profile();
      user.value = response.user;
      role.value = response.user.role;
      isAuthenticated.value = true;
      return true;
    } catch {
      user.value = null;
      role.value = null;
      isAuthenticated.value = false;
      return false;
    }
  }

  async function logout() {
    try {
      await useAuthApi().logout();
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
    applySession,
    restoreSession,
    logout,
  };
};
