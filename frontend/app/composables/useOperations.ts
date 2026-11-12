import type {
  Payment,
  PaymentStatus,
  PaymentSubmission,
  PaymentSubmissionStatus,
} from "~/types/payment";
import type {
  MaintenanceRequest,
  MaintenanceStatus,
  PublicMaintenanceAnnouncement,
} from "~/types/maintenance";

export function useOperations() {
  const payments = useState<Payment[]>("payments", () => []);
  const paymentSubmissions = useState<PaymentSubmission[]>(
    "payment-submissions",
    () => [],
  );
  const maintenance = useState<MaintenanceRequest[]>("maintenance", () => []);
  const publicMaintenance = useState<PublicMaintenanceAnnouncement[]>(
    "public-maintenance",
    () => [],
  );
  const loading = useState("operations-loading", () => false);
  const error = useState("operations-error", () => "");
  const api = useApi();

  async function loadFromApi(forTenant = false) {
    loading.value = true;
    error.value = "";
    try {
      const [paymentsResult, maintenanceResult] = await Promise.allSettled([
        api.request<
          Array<{
            id: number;
            tenantId: number;
            amount: string | number;
            amountPaid?: string | number;
            paymentDate?: string | null;
            dueDate?: string | null;
            paymentMethod: string;
            paymentStatus: string;
            description?: string | null;
            referenceNumber?: string | null;
            submissions?: Array<{
              id: number;
              paymentId: number;
              tenantId: number;
              amount: string | number;
              paymentMethod: string;
              paymentDate: string;
              referenceNumber: string;
              proofFileName: string;
              proofMimeType: string;
              proofSize: number;
              status: PaymentSubmission["status"];
              rejectionRemarks: string | null;
              verifiedAt: string | null;
              createdAt: string;
              verifiedBy?: PaymentSubmission["verifiedBy"];
              auditTrail?: PaymentSubmission["auditTrail"];
            }>;
          }>
        >(forTenant ? "/payments/me" : "/payments"),
        api.request<
          Array<{
            id: number;
            tenantId: number;
            roomId: number;
            title: string;
            description: string;
            priority: MaintenanceRequest["priority"];
            status: string;
            isPublic: boolean;
            createdAt: string;
            updatedAt?: string;
            announcementTitle?: string | null;
            announcementDescription?: string | null;
            publicLocation?: string | null;
            tenant?: {
              contactNumber?: string | null;
              user?: { fullName: string; email: string };
            };
            room?: { roomNumber: string; building: string };
            statusHistory?: MaintenanceRequest["history"];
          }>
        >(forTenant ? "/maintenance/me" : "/maintenance"),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const errors: string[] = [];
      if (paymentsResult.status === "fulfilled") {
        payments.value = paymentsResult.value.map((payment) => {
          const dueDate = payment.dueDate?.slice(0, 10) || null;
          const isUnpaid = ["UNPAID", "PENDING", "PARTIAL"].includes(
            payment.paymentStatus,
          );
          const status =
            dueDate && dueDate < today && isUnpaid
              ? "OVERDUE"
              : payment.paymentStatus === "UNPAID"
                ? "PENDING"
                : payment.paymentStatus;
          return {
            id: payment.id,
            tenantId: payment.tenantId,
            description:
              payment.description ||
              payment.referenceNumber ||
              payment.paymentMethod,
            amount: Number(payment.amount),
            amountPaid: Number(payment.amountPaid || 0),
            dueDate,
            paymentDate: payment.paymentDate?.slice(0, 10) || null,
            paymentMethod: payment.paymentMethod,
            status: status as PaymentStatus,
            referenceNumber: payment.referenceNumber || null,
            submissions: (payment.submissions || []).map((submission) => ({
              ...submission,
              amount: Number(submission.amount),
            })),
          };
        });
      } else {
        errors.push(
          `Payments could not be loaded: ${paymentsResult.reason instanceof Error ? paymentsResult.reason.message : "Unexpected API error."}`,
        );
      }

      if (maintenanceResult.status === "fulfilled") {
        maintenance.value = maintenanceResult.value.map((request) => ({
          id: request.id,
          tenantId: request.tenantId,
          roomId: request.roomId,
          issue: request.title,
          description: request.description,
          priority: request.priority,
          requestDate: request.createdAt.slice(0, 10),
          status: request.status as MaintenanceStatus,
          isPublic: request.isPublic,
          updatedAt: request.updatedAt,
          announcementTitle: request.announcementTitle,
          announcementDescription: request.announcementDescription,
          publicLocation: request.publicLocation,
          tenantName: request.tenant?.user?.fullName,
          tenantEmail: request.tenant?.user?.email,
          tenantContactNumber: request.tenant?.contactNumber,
          roomNumber: request.room?.roomNumber,
          building: request.room?.building,
          history: request.statusHistory,
        }));
      } else {
        errors.push(
          `Maintenance requests could not be loaded: ${maintenanceResult.reason instanceof Error ? maintenanceResult.reason.message : "Unexpected API error."}`,
        );
      }
      error.value = errors.join(" ");
    } catch (caught) {
      error.value =
        caught instanceof Error
          ? caught.message
          : "Unable to load payment and maintenance records.";
    } finally {
      loading.value = false;
    }
  }

  async function updateMaintenanceStatus(
    id: number,
    status: Extract<MaintenanceStatus, "IN_PROGRESS" | "RESOLVED">,
  ) {
    await api.request(`/maintenance/${id}`, {
      method: "PATCH",
      body: { status },
    });
    await loadFromApi();
  }

  async function loadPublicMaintenance() {
    const records = await api.request<
      Array<{
        announcementTitle: string | null;
        announcementDescription: string | null;
        publicLocation: string | null;
        status: PublicMaintenanceAnnouncement["status"];
        createdAt: string;
        updatedAt: string;
        statusHistory: PublicMaintenanceAnnouncement["updates"];
      }>
    >("/maintenance/public");
    publicMaintenance.value = records.map((record) => ({
      title: record.announcementTitle || "Maintenance notice",
      description: record.announcementDescription || "",
      location: record.publicLocation || "Location not specified",
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      updates: record.statusHistory,
    }));
  }

  async function approveMaintenance(
    id: number,
    announcement: {
      announcementTitle?: string;
      announcementDescription?: string;
      publicLocation?: string;
    },
  ) {
    await api.request(`/maintenance/${id}/approve`, {
      method: "PATCH",
      body: announcement,
    });
    await loadFromApi();
  }

  async function rejectMaintenance(id: number, note?: string) {
    await api.request(`/maintenance/${id}/reject`, {
      method: "PATCH",
      body: { note },
    });
    await loadFromApi();
  }

  async function updateMaintenanceAnnouncement(
    id: number,
    announcement: {
      announcementTitle: string;
      announcementDescription: string;
      publicLocation: string;
    },
  ) {
    await api.request(`/maintenance/${id}`, {
      method: "PATCH",
      body: announcement,
    });
    await loadFromApi();
  }

  async function createPayment(payload: {
    tenantId: number;
    amount: number;
    paymentMethod: string;
    description?: string;
    paymentDate?: string;
    dueDate?: string;
    referenceNumber?: string;
  }) {
    await api.request("/payments", { method: "POST", body: payload });
    await loadFromApi();
  }

  async function loadPaymentSubmissions() {
    const records = await api.request<PaymentSubmission[]>(
      "/payments/submissions",
    );
    paymentSubmissions.value = records.map((record) => ({
      ...record,
      amount: Number(record.amount),
      payment: record.payment
        ? {
            ...record.payment,
            amount: Number(record.payment.amount),
            amountPaid: Number(record.payment.amountPaid),
          }
        : undefined,
    }));
  }

  async function submitPaymentProof(
    paymentId: number,
    formData: FormData,
  ) {
    await api.request(`/payments/${paymentId}/submissions`, {
      method: "POST",
      body: formData,
    });
    await loadFromApi(true);
  }

  async function verifyPaymentSubmission(
    id: number,
    status: Extract<PaymentSubmissionStatus, "APPROVED" | "REJECTED">,
    remarks?: string,
  ) {
    await api.request(`/payments/submissions/${id}/verify`, {
      method: "PATCH",
      body: { status, remarks },
    });
    await Promise.all([loadPaymentSubmissions(), loadFromApi()]);
  }

  async function createTenantMaintenanceRequest(payload: {
    title: string;
    description: string;
    priority: MaintenanceRequest["priority"];
  }) {
    await api.request("/maintenance/me", { method: "POST", body: payload });
    await loadFromApi(true);
  }

  return {
    payments,
    paymentSubmissions,
    maintenance,
    publicMaintenance,
    loading,
    error,
    loadFromApi,
    updateMaintenanceStatus,
    loadPublicMaintenance,
    approveMaintenance,
    rejectMaintenance,
    updateMaintenanceAnnouncement,
    createPayment,
    loadPaymentSubmissions,
    submitPaymentProof,
    verifyPaymentSubmission,
    createTenantMaintenanceRequest,
  };
}
