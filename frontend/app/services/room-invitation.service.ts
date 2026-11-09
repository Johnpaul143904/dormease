export interface RoomInvitationRecord {
  id: number;
  roomId: number;
  tenantId: number | null;
  code: string;
  status: "ACTIVE" | "USED" | "EXPIRED" | "REVOKED" | "REJECTED";
  createdAt: string;
  expiresAt: string;
  room?: { id: number; roomNumber: string; building: string };
}

export const roomInvitationService = {
  list: () => useApi().request<RoomInvitationRecord[]>("/room-invitations"),
  create: (roomId: number) =>
    useApi().request<RoomInvitationRecord>("/room-invitations", {
      method: "POST",
      body: { roomId },
    }),
  revoke: (id: number) =>
    useApi().request<RoomInvitationRecord>(`/room-invitations/${id}/revoke`, {
      method: "POST",
    }),
};
