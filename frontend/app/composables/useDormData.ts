import type { Room, RoomInput } from "~/types/room";
import type { Tenant, TenantInput } from "~/types/tenant";
import type { RoomAssignment } from "~/types/room-assignment";
import type { RoomInvitation } from "~/types/room-invitation";

interface ApiRoom {
  id: number;
  roomNumber: string;
  building: string;
  floor: number;
  roomType: Room["roomType"];
  capacity: number;
  monthlyRent: string | number;
  description?: string | null;
  status: string;
}

interface ApiAssignment {
  id: number;
  tenantId: number;
  roomId: number;
  moveInDate: string;
  moveOutDate?: string | null;
  status: string;
  createdAt: string;
}

interface ApiTenant {
  id: number;
  user: { fullName: string; email: string };
  contactNumber?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  createdAt: string;
  assignments: Array<{ room: { id: number } }>;
}

interface ApiInvitation {
  id: number;
  roomId: number;
  tenantId?: number | null;
  code: string;
  createdAt: string;
  expiresAt: string;
  status: RoomInvitation["status"];
  room?: { roomNumber: string; building: string };
  tenant?: { user: { fullName: string; email: string } } | null;
}

interface ApiInvitationLookup {
  code: string;
  status: RoomInvitation["status"];
  expiresAt: string;
  room: Omit<ApiRoom, "id"> & { currentOccupants: number };
}

function mapAssignment(assignment: ApiAssignment): RoomAssignment {
  return {
    id: assignment.id,
    tenantId: assignment.tenantId,
    roomId: assignment.roomId,
    assignmentDate: assignment.createdAt.slice(0, 10),
    moveInDate: assignment.moveInDate.slice(0, 10),
    moveOutDate: assignment.moveOutDate?.slice(0, 10) ?? null,
    status: (assignment.status === "CANCELLED"
      ? "COMPLETED"
      : assignment.status) as RoomAssignment["status"],
  };
}

function mapRoom(room: ApiRoom, assignments: RoomAssignment[]): Room {
  const currentOccupants = assignments.filter(
    (assignment) =>
      assignment.roomId === room.id && assignment.status === "ACTIVE",
  ).length;
  return {
    id: room.id,
    roomNumber: room.roomNumber,
    building: room.building,
    floor: room.floor,
    roomType: room.roomType,
    capacity: room.capacity,
    currentOccupants,
    monthlyRate: Number(room.monthlyRent),
    status:
      room.status === "MAINTENANCE"
        ? "MAINTENANCE"
        : currentOccupants >= room.capacity && room.capacity > 0
          ? "FULL"
          : currentOccupants
            ? "OCCUPIED"
            : "AVAILABLE",
    description: room.description || "",
  };
}

function mapInvitationRoom(room: ApiInvitationLookup["room"]): Room {
  return {
    id: 0,
    roomNumber: room.roomNumber,
    building: room.building,
    floor: room.floor,
    roomType: room.roomType,
    capacity: room.capacity,
    currentOccupants: room.currentOccupants,
    monthlyRate: Number(room.monthlyRent),
    status:
      room.status === "MAINTENANCE"
        ? "MAINTENANCE"
        : room.currentOccupants >= room.capacity && room.capacity > 0
          ? "FULL"
          : room.currentOccupants
            ? "OCCUPIED"
            : "AVAILABLE",
    description: room.description || "",
  };
}

function mapInvitation(invitation: ApiInvitation): RoomInvitation {
  return {
    id: invitation.id,
    roomId: invitation.roomId,
    tenantId: invitation.tenantId ?? null,
    code: invitation.code,
    createdDate: invitation.createdAt.slice(0, 10),
    expirationDate: invitation.expiresAt.slice(0, 10),
    status: invitation.status,
    tenantName: invitation.tenant?.user.fullName ?? null,
    tenantEmail: invitation.tenant?.user.email ?? null,
    roomNumber: invitation.room?.roomNumber ?? null,
    building: invitation.room?.building ?? null,
  };
}

export function useDormData() {
  const rooms = useState<Room[]>("dorm-rooms", () => []);
  const tenants = useState<Tenant[]>("dorm-tenants", () => []);
  const assignments = useState<RoomAssignment[]>("dorm-assignments", () => []);
  const invitations = useState<RoomInvitation[]>("dorm-invitations", () => []);
  const myRoomRequests = useState<RoomInvitation[]>(
    "dorm-my-room-requests",
    () => [],
  );
  const currentTenantId = useState<number | null>(
    "current-tenant-id",
    () => null,
  );
  const api = useApi();
  const auth = useDormEaseAuth();
  const loading = useState("dorm-data-loading", () => false);
  const error = useState("dorm-data-error", () => "");

  async function loadFromApi() {
    loading.value = true;
    error.value = "";
    try {
      const [apiRooms, apiTenants, apiAssignments] = await Promise.all([
        api.request<ApiRoom[]>("/rooms"),
        api.request<ApiTenant[]>("/tenants"),
        api.request<ApiAssignment[]>("/assignments"),
      ]);
      assignments.value = apiAssignments.map(mapAssignment);
      rooms.value = apiRooms.map((room) => mapRoom(room, assignments.value));
      tenants.value = apiTenants.map((tenant) => ({
        id: tenant.id,
        fullName: tenant.user.fullName,
        email: tenant.user.email,
        contactNumber: tenant.contactNumber || "",
        address: tenant.address || "",
        emergencyContact: tenant.emergencyContact || "",
        assignedRoomId: tenant.assignments[0]?.room.id ?? null,
        registrationDate: tenant.createdAt.slice(0, 10),
        status: tenant.assignments.length ? "ACTIVE" : "PENDING",
      }));
      currentTenantId.value =
        tenants.value.find((tenant) => tenant.email === auth.user.value?.email)
          ?.id ?? null;
    } catch (caught) {
      error.value =
        caught instanceof Error
          ? caught.message
          : "Unable to load dormitory data.";
    } finally {
      loading.value = false;
    }
  }

  async function loadTenantData() {
    loading.value = true;
    error.value = "";
    try {
      const tenant = await api.request<{
        id: number;
        user: { fullName: string; email: string };
        contactNumber?: string | null;
        address?: string | null;
        emergencyContact?: string | null;
        createdAt: string;
        assignments: Array<ApiAssignment & { room: ApiRoom }>;
      }>("/tenants/me");
      currentTenantId.value = tenant.id;
      assignments.value = tenant.assignments.map(mapAssignment);
      tenants.value = [
        {
          id: tenant.id,
          fullName: tenant.user.fullName,
          email: tenant.user.email,
          contactNumber: tenant.contactNumber || "",
          address: tenant.address || "",
          emergencyContact: tenant.emergencyContact || "",
          assignedRoomId:
            tenant.assignments.find(
              (assignment) => assignment.status === "ACTIVE",
            )?.roomId ?? null,
          registrationDate: tenant.createdAt.slice(0, 10),
          status: tenant.assignments.some(
            (assignment) => assignment.status === "ACTIVE",
          )
            ? "ACTIVE"
            : "PENDING",
        },
      ];
      rooms.value = [
        ...new Map(
          tenant.assignments.map((assignment) => [
            assignment.room.id,
            mapRoom(assignment.room, assignments.value),
          ]),
        ).values(),
      ];
    } catch (caught) {
      error.value =
        caught instanceof Error
          ? caught.message
          : "Unable to load tenant data.";
    } finally {
      loading.value = false;
    }
  }

  async function createRoom(input: RoomInput) {
    await api.request("/rooms", {
      method: "POST",
      body: {
        roomNumber: input.roomNumber,
        building: input.building,
        floor: input.floor,
        roomType: input.roomType,
        capacity: input.capacity,
        monthlyRent: input.monthlyRate,
        description: input.description,
        status: input.status === "FULL" ? "OCCUPIED" : input.status,
      },
    });
    await loadFromApi();
  }

  async function updateRoom(id: number, input: RoomInput) {
    await api.request(`/rooms/${id}`, {
      method: "PATCH",
      body: {
        roomNumber: input.roomNumber,
        building: input.building,
        floor: input.floor,
        roomType: input.roomType,
        capacity: input.capacity,
        monthlyRent: input.monthlyRate,
        description: input.description,
        status: input.status === "FULL" ? "OCCUPIED" : input.status,
      },
    });
    await loadFromApi();
  }

  async function deleteRoom(id: number) {
    await api.request(`/rooms/${id}`, { method: "DELETE" });
    await loadFromApi();
  }

  async function createTenant(input: TenantInput) {
    await api.request("/tenants", {
      method: "POST",
      body: {
        ...input,
        email: input.email.trim(),
        fullName: input.fullName.trim(),
      },
    });
    await loadFromApi();
  }

  async function updateTenant(id: number, input: TenantInput) {
    await api.request(`/tenants/${id}`, {
      method: "PATCH",
      body: {
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        contactNumber: input.contactNumber,
        address: input.address,
        emergencyContact: input.emergencyContact,
      },
    });
    await loadFromApi();
  }

  async function deleteTenant(id: number) {
    await api.request(`/tenants/${id}`, { method: "DELETE" });
    await loadFromApi();
  }

  async function assignTenant(
    tenantId: number,
    roomId: number,
    moveInDate: string,
  ) {
    await api.request("/assignments", {
      method: "POST",
      body: { tenantId, roomId, moveInDate },
    });
    await loadFromApi();
  }

  async function terminateAssignment(id: number) {
    await api.request(`/assignments/${id}/terminate`, { method: "PATCH" });
    await loadFromApi();
  }

  async function loadInvitations() {
    const items = await api.request<ApiInvitation[]>("/room-invitations");
    invitations.value = items.map(mapInvitation);
  }

  async function loadMyRoomRequests() {
    const items = await api.request<ApiInvitation[]>("/room-invitations/me");
    myRoomRequests.value = items.map(mapInvitation);
  }

  async function createInvitation(roomId: number) {
    const invitation = await api.request<ApiInvitation>("/room-invitations", {
      method: "POST",
      body: { roomId },
    });
    invitations.value.unshift(mapInvitation(invitation));
  }

  async function revokeInvitation(id: number) {
    await api.request(`/room-invitations/${id}/revoke`, { method: "POST" });
    const invitation = invitations.value.find((item) => item.id === id);
    if (invitation) invitation.status = "REVOKED";
  }

  async function submitJoinRequest(code: string) {
    return api.request<ApiInvitation>(
      `/room-invitations/${encodeURIComponent(code.trim())}/request`,
      { method: "POST" },
    );
  }

  async function approveInvitation(id: number) {
    await api.request(`/room-invitations/${id}/approve`, { method: "POST" });
    const invitation = invitations.value.find((item) => item.id === id);
    if (invitation) invitation.status = "APPROVED";
  }

  async function rejectInvitation(id: number) {
    await api.request(`/room-invitations/${id}/reject`, { method: "POST" });
    const invitation = invitations.value.find((item) => item.id === id);
    if (invitation) invitation.status = "REJECTED";
  }

  async function joinWithInvitation(code: string) {
    try {
      const invitation = await api.request<ApiInvitationLookup>(
        `/room-invitations/${encodeURIComponent(code.trim())}`,
      );
      if (invitation.status !== "ACTIVE") {
        const messages: Record<RoomInvitation["status"], string> = {
          ACTIVE: "",
          PENDING: "Your room request is waiting for Admin approval.",
          APPROVED: "This room request was approved.",
          EXPIRED: "This invitation has expired.",
          REVOKED: "This invitation is no longer available.",
          USED: "This invitation has already been accepted.",
          REJECTED: "This invitation is no longer available.",
        };
        return {
          ok: false as const,
          status: invitation.status,
          message: messages[invitation.status],
        };
      }
      return {
        ok: true as const,
        code: invitation.code,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        room: mapInvitationRoom(invitation.room),
      };
    } catch (caught) {
      return {
        ok: false as const,
        message:
          typeof caught === "object" &&
          caught !== null &&
          "statusCode" in caught &&
          caught.statusCode === 404
            ? "Invalid invitation link."
            : caught instanceof Error
              ? caught.message
              : "Unable to validate invitation.",
        status: "INVALID" as const,
      };
    }
  }

  return {
    rooms,
    tenants,
    assignments,
    invitations,
    myRoomRequests,
    currentTenantId,
    loading,
    error,
    loadFromApi,
    loadTenantData,
    loadInvitations,
    loadMyRoomRequests,
    createRoom,
    updateRoom,
    deleteRoom,
    createTenant,
    updateTenant,
    deleteTenant,
    assignTenant,
    terminateAssignment,
    createInvitation,
    revokeInvitation,
    joinWithInvitation,
    submitJoinRequest,
    approveInvitation,
    rejectInvitation,
  };
}
