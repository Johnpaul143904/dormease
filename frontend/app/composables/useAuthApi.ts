import type {
  AuthResponse,
  AuthUser,
  RegistrationPayload,
} from "~/types/auth";

export function useAuthApi() {
  const api = useApi();

  return {
    register(payload: RegistrationPayload = { accountType: "TENANT" }) {
      return api.request<AuthResponse>("/auth/register", {
        method: "POST",
        body: payload,
      });
    },
    profile() {
      return api.request<AuthResponse>("/auth/profile");
    },
    updateProfile(
      payload: Partial<
        Pick<
          AuthUser,
          | "fullName"
          | "email"
          | "contactNumber"
          | "address"
          | "emergencyContact"
        >
      >,
    ) {
      return api.request<AuthResponse>("/auth/profile", {
        method: "PATCH",
        body: payload,
      });
    },
  };
}
