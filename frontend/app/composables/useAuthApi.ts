import type { LoginPayload, RegistrationPayload } from "~/types/auth";

export function useAuthApi() {
  const api = useApi();

  return {
    endpoints: {
      login: "/auth/login",
      register: "/auth/register",
    },
    createLoginPayload(email: string, password: string): LoginPayload {
      return {
        email: email.trim(),
        password,
      };
    },
    createRegistrationPayload(
      fullName: string,
      email: string,
      password: string,
      accountType: "ADMIN" | "TENANT",
      invitationCode?: string,
    ): RegistrationPayload {
      return {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        accountType,
        invitationCode,
      };
    },
    login(payload: LoginPayload) {
      return api.request<import("~/types/auth").AuthResponse>("/auth/login", {
        method: "POST",
        body: payload,
      });
    },
    register(payload: RegistrationPayload) {
      return api.request<import("~/types/auth").AuthResponse>(
        "/auth/register",
        {
          method: "POST",
          body: payload,
        },
      );
    },
    profile() {
      return api.request<{ user: import("~/types/auth").AuthResponse["user"] }>(
        "/auth/profile",
      );
    },
    updateProfile(
      payload: Pick<
        import("~/types/auth").AuthResponse["user"],
        "fullName" | "email" | "contactNumber" | "address" | "emergencyContact"
      >,
    ) {
      return api.request<{ user: import("~/types/auth").AuthResponse["user"] }>(
        "/auth/profile",
        {
          method: "PATCH",
          body: payload,
        },
      );
    },
    logout() {
      return api.request("/auth/logout", { method: "POST" });
    },
  };
}
