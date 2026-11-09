export type PaymentStatus =
  "PAID" | "PENDING" | "PARTIAL" | "OVERDUE" | "CANCELLED";

export interface Payment {
  id: number;
  tenantId: number;
  description: string;
  amount: number;
  amountPaid: number;
  dueDate: string | null;
  paymentDate: string | null;
  paymentMethod: string;
  status: PaymentStatus;
  referenceNumber?: string | null;
  submissions: PaymentSubmission[];
}

export type PaymentSubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface PaymentSubmission {
  id: number;
  paymentId: number;
  tenantId: number;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber: string;
  proofFileName: string;
  proofMimeType: string;
  proofSize: number;
  status: PaymentSubmissionStatus;
  rejectionRemarks: string | null;
  verifiedAt: string | null;
  createdAt: string;
  verifiedBy?: { id: number; fullName: string } | null;
  tenant?: {
    id: number;
    contactNumber: string | null;
    user: { fullName: string; email: string };
  };
  payment?: {
    id: number;
    amount: number;
    amountPaid: number;
    paymentStatus: PaymentStatus;
    dueDate: string | null;
    description: string | null;
    tenantId: number;
  };
  auditTrail?: Array<{
    status: PaymentSubmissionStatus;
    remarks: string | null;
    createdAt: string;
    changedBy?: { fullName: string } | null;
  }>;
}
