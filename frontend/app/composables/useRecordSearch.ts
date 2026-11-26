interface RecordSearchResult {
  title: string;
  detail: string;
  path: string;
  searchTerm: string;
  category: string;
}

export function useRecordSearch() {
  const dormData = useDormData();
  const operations = useOperations();
  const loaded = useState("global-record-search-loaded", () => false);
  const loading = useState("global-record-search-loading", () => false);

  function clearCache() {
    loaded.value = false;
    loading.value = false;
  }

  async function searchRecords(
    query: string,
  ): Promise<RecordSearchResult[]> {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length < 2) return [];

    if (!loaded.value && !loading.value) {
      loading.value = true;
      try {
        await Promise.all([
          dormData.loadFromApi(),
          dormData.loadInvitations(),
          operations.loadFromApi(),
        ]);
        if (dormData.error.value || operations.error.value) {
          throw new Error(
            [dormData.error.value, operations.error.value]
              .filter(Boolean)
              .join(" "),
          );
        }
        loaded.value = true;
      } finally {
        loading.value = false;
      }
    } else {
      while (loading.value) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      if (!loaded.value) {
        return searchRecords(query);
      }
    }

    const matches = (values: Array<string | number | null | undefined>) =>
      values.some((value) =>
        String(value ?? "")
          .toLocaleLowerCase()
          .includes(normalized),
      );
    const tenantName = (id: number) =>
      dormData.tenants.value.find((tenant) => tenant.id === id)?.fullName ??
      "Tenant unavailable";
    const roomLabel = (id: number) => {
      const room = dormData.rooms.value.find((item) => item.id === id);
      return room ? `${room.roomNumber} · ${room.building}` : "Room unavailable";
    };
    const results: RecordSearchResult[] = [];

    dormData.rooms.value.forEach((room) => {
      if (
        matches([
          room.roomNumber,
          room.building,
          room.floor,
          room.roomType,
          room.status,
          room.description,
        ])
      ) {
        results.push({
          title: `Room ${room.roomNumber}`,
          detail: `${room.building} · Floor ${room.floor} · ${room.status}`,
          path: "/rooms",
          searchTerm: query.trim(),
          category: "Room",
        });
      }
    });
    dormData.tenants.value.forEach((tenant) => {
      if (
        matches([
          tenant.fullName,
          tenant.email,
          tenant.contactNumber,
          tenant.status,
          tenant.address,
          tenant.emergencyContact,
          tenant.assignedRoomId ? roomLabel(tenant.assignedRoomId) : "",
        ])
      ) {
        results.push({
          title: tenant.fullName,
          detail: `${tenant.email} · ${tenant.status}`,
          path: "/tenants",
          searchTerm: query.trim(),
          category: "Tenant",
        });
      }
    });
    dormData.assignments.value.forEach((assignment) => {
      const tenant = tenantName(assignment.tenantId);
      const room = roomLabel(assignment.roomId);
      if (
        matches([
          tenant,
          room,
          assignment.status,
          assignment.assignmentDate,
          assignment.moveInDate,
          assignment.moveOutDate,
        ])
      ) {
        results.push({
          title: tenant,
          detail: `${room} · ${assignment.status}`,
          path: "/assignments",
          searchTerm: query.trim(),
          category: "Assignment",
        });
      }
    });
    operations.payments.value.forEach((payment) => {
      const tenant = tenantName(payment.tenantId);
      if (
        matches([
          tenant,
          payment.description,
          payment.referenceNumber,
          payment.amount,
          payment.paymentMethod,
          payment.paymentDate,
          payment.dueDate,
          payment.status,
        ])
      ) {
        results.push({
          title: tenant,
          detail: `${payment.description} · ₱${payment.amount.toLocaleString()} · ${payment.status}`,
          path: "/payments",
          searchTerm: query.trim(),
          category: "Payment",
        });
      }
    });
    operations.maintenance.value.forEach((item) => {
      const tenant = tenantName(item.tenantId);
      const room = roomLabel(item.roomId);
      if (
        matches([
          tenant,
          item.issue,
          room,
          item.priority,
          item.status,
          item.requestDate,
        ])
      ) {
        results.push({
          title: item.issue,
          detail: `${tenant} · ${room} · ${item.status}`,
          path: "/maintenance",
          searchTerm: query.trim(),
          category: "Maintenance",
        });
      }
    });
    dormData.invitations.value.forEach((invitation) => {
      const room = roomLabel(invitation.roomId);
      if (
        matches([
          invitation.code,
          room,
          invitation.status,
          invitation.expirationDate,
        ])
      ) {
        results.push({
          title: invitation.code,
          detail: `${room} · ${invitation.status} · expires ${invitation.expirationDate}`,
          path: "/invitations",
          searchTerm: query.trim(),
          category: "Invitation",
        });
      }
    });
    return results.slice(0, 10);
  }

  return { searchRecords, clearCache };
}
