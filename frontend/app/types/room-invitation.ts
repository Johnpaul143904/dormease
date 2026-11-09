export type InvitationStatus =
  "ACTIVE" | "USED" | "EXPIRED" | "REVOKED" | "REJECTED";

export interface RoomInvitation {
  id: number;
  roomId: number;
  code: string;
  createdDate: string;
  expirationDate: string;
  status: InvitationStatus;
}
