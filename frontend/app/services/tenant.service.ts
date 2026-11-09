import type { TenantInput } from "~/types/tenant";

export interface TenantRecord {
  id: number;
  userId: number;
  contactNumber: string | null;
  address: string | null;
  emergencyContact: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: number; fullName: string; email: string; role: "TENANT" };
  assignments: Array<{
    id: number;
    tenantId: number;
    roomId: number;
    moveInDate: string;
    moveOutDate: string | null;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    room: { id: number; roomNumber: string; building: string };
  }>;
}

export const tenantService = {
  list: () => useApi().request<TenantRecord[]>("/tenants"),
  get: (id: number) => useApi().request<TenantRecord>(`/tenants/${id}`),
  create: (payload: TenantInput & { password: string }) =>
    useApi().request<TenantRecord>("/tenants", {
      method: "POST",
      body: payload,
    }),
  update: (id: number, payload: Partial<Omit<TenantInput, "password">>) =>
    useApi().request<TenantRecord>(`/tenants/${id}`, {
      method: "PATCH",
      body: payload,
    }),
  delete: (id: number) =>
    useApi().request<{ id: number }>(`/tenants/${id}`, { method: "DELETE" }),
};
