export type MaintenanceStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CANCELLED";
export type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface MaintenanceStatusUpdate {
  status: MaintenanceStatus;
  isPublic?: boolean;
  createdAt: string;
  note?: string | null;
  changedBy?: { fullName: string } | null;
}

export interface MaintenanceRequest {
  id: number;
  tenantId: number;
  roomId: number;
  issue: string;
  description: string;
  priority: MaintenancePriority;
  requestDate: string;
  status: MaintenanceStatus;
  updatedAt?: string;
  announcementTitle?: string | null;
  announcementDescription?: string | null;
  publicLocation?: string | null;
  tenantName?: string;
  tenantEmail?: string;
  tenantContactNumber?: string | null;
  roomNumber?: string;
  building?: string;
  history?: MaintenanceStatusUpdate[];
}

export interface PublicMaintenanceAnnouncement {
  title: string;
  description: string;
  location: string;
  status: Extract<MaintenanceStatus, "APPROVED" | "IN_PROGRESS" | "RESOLVED">;
  createdAt: string;
  updatedAt: string;
  updates: Array<{
    status: Extract<
      MaintenanceStatus,
      "APPROVED" | "IN_PROGRESS" | "RESOLVED"
    >;
    createdAt: string;
  }>;
}
