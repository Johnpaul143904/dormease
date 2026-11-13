export type InvitationStatus =
  | "ACTIVE"
  | "PENDING"
  | "APPROVED"
  | "USED"
  | "EXPIRED"
  | "REVOKED"
  | "REJECTED";

export interface RoomInvitation {
  id: number;
  roomId: number;
  tenantId: number | null;
  code: string;
  createdDate: string;
  expirationDate: string;
  status: InvitationStatus;
  tenantName: string | null;
  tenantEmail: string | null;
  roomNumber: string | null;
  building: string | null;
}
