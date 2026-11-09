export interface RoomRecord {
  id: number;
  roomNumber: string;
  building: string;
  floor: number;
  roomType: string;
  capacity: number;
  monthlyRent: string | number;
  description: string | null;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
  assignments?: Array<{ id: number; tenantId: number; roomId: number }>;
}

export interface RoomPayload {
  roomNumber: string;
  building?: string;
  floor?: number;
  roomType?: string;
  capacity: number;
  monthlyRent: number;
  description?: string;
  status?: RoomRecord["status"];
}

export const roomService = {
  list: () => useApi().request<RoomRecord[]>("/rooms"),
  get: (id: number) => useApi().request<RoomRecord>(`/rooms/${id}`),
  create: (payload: RoomPayload) =>
    useApi().request<RoomRecord>("/rooms", { method: "POST", body: payload }),
  update: (id: number, payload: Partial<RoomPayload>) =>
    useApi().request<RoomRecord>(`/rooms/${id}`, {
      method: "PATCH",
      body: payload,
    }),
  remove: (id: number) =>
    useApi().request<RoomRecord>(`/rooms/${id}`, { method: "DELETE" }),
};
