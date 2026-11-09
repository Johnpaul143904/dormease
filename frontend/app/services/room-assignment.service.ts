export interface RoomAssignmentRecord {
  id: number;
  tenantId: number;
  roomId: number;
  moveInDate: string;
  moveOutDate: string | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  tenant?: { id: number; user: { fullName: string; email: string } };
  room?: { id: number; roomNumber: string; building: string };
}

export interface CreateAssignmentPayload {
  tenantId: number;
  roomId: number;
  moveInDate: string;
}

export const roomAssignmentService = {
  list: () => useApi().request<RoomAssignmentRecord[]>("/assignments"),
  create: (payload: CreateAssignmentPayload) =>
    useApi().request<RoomAssignmentRecord>("/assignments", {
      method: "POST",
      body: payload,
    }),
  terminate: (id: number) =>
    useApi().request<RoomAssignmentRecord>(`/assignments/${id}/terminate`, {
      method: "PATCH",
    }),
};
