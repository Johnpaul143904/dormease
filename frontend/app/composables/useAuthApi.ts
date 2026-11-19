import type {
  AuthResponse,
  AuthUser,
  RegistrationPayload,
} from "~/types/auth";

export function useAuthApi() {
  const api = useApi();

  return {
    register(payload: RegistrationPayload = {}) {
      const normalizedPayload: RegistrationPayload = {
        accountType: payload.accountType ?? "TENANT",
        ...(payload.invitationCode
          ? { invitationCode: payload.invitationCode }
          : {}),
      };
      return api.request<AuthResponse>("/auth/register", {
        method: "POST",
        body: normalizedPayload,
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
