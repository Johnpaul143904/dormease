<script setup lang="ts">
import AdminShell from "~/components/layout/AdminShell.vue";
import StatCard from "~/components/ui/StatCard.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";

const dormData = useDormData();
const { rooms, tenants, assignments } = dormData;
const operations = useOperations();
const auth = useDormEaseAuth();
const invitationNotice = ref("");
const invitationActionId = ref<number | null>(null);
onMounted(() => {
  void dormData.loadFromApi();
  void operations.loadFromApi();
  if (auth.role.value === "ADMIN") {
    void dormData.loadInvitations().catch((error: unknown) => {
      invitationNotice.value =
        error instanceof Error ? error.message : "Unable to load room requests.";
    });
  }
});
const payments = operations.payments;
const maintenance = operations.maintenance;
const roomJoinRequests = computed(() =>
  dormData.invitations.value.filter(
    (invitation) =>
      invitation.tenantId !== null &&
      ["PENDING", "APPROVED", "REJECTED", "USED"].includes(invitation.status),
  ),
);
const stats = computed(() => [
  {
    label: "Total rooms",
    value: rooms.value.length,
    detail: "Across all buildings",
    tone: "blue" as const,
  },
  {
    label: "Available rooms",
    value: rooms.value.filter((room) => room.status === "AVAILABLE").length,
    detail: "Ready for assignment",
    tone: "green" as const,
  },
  {
    label: "Occupied rooms",
    value: rooms.value.filter((room) => room.currentOccupants > 0).length,
    detail: "Currently in use",
    tone: "violet" as const,
  },
  {
    label: "Total tenants",
    value: tenants.value.length,
    detail: "Registered residents",
    tone: "blue" as const,
  },
  {
    label: "Pending payments",
    value: payments.value.filter((item) =>
      ["PENDING", "PARTIAL"].includes(item.status),
    ).length,
    detail: "Needs follow-up",
    tone: "amber" as const,
  },
  {
    label: "Paid payments",
    value: payments.value.filter((item) => item.status === "PAID").length,
    detail: "Recorded as paid",
    tone: "green" as const,
  },
  {
    label: "Overdue payments",
    value: payments.value.filter((item) => item.status === "OVERDUE").length,
    detail: "Past due date",
    tone: "rose" as const,
  },
  {
    label: "Active assignments",
    value: assignments.value.filter((item) => item.status === "ACTIVE").length,
    detail: "Current tenant placements",
    tone: "violet" as const,
  },
  {
    label: "Maintenance requests",
    value: maintenance.value.filter((item) =>
      ["PENDING", "IN_PROGRESS"].includes(item.status),
    ).length,
    detail: "Open requests",
    tone: "rose" as const,
  },
]);
const occupiedRooms = computed(
  () => rooms.value.filter((room) => room.currentOccupants > 0).length,
);
const occupancyRate = computed(() =>
  rooms.value.length
    ? Math.round((occupiedRooms.value / rooms.value.length) * 100)
    : 0,
);
const monthlyMovement = computed(() => {
  const now = new Date();
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 7 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: date.toLocaleString("en", { month: "short" }),
      joined: tenants.value.filter((tenant) =>
        tenant.registrationDate.startsWith(key),
      ).length,
      left: assignments.value.filter((assignment) =>
        assignment.moveOutDate?.startsWith(key),
      ).length,
    };
  });
});
const movementMax = computed(() =>
  Math.max(
    1,
    ...monthlyMovement.value.flatMap((month) => [month.joined, month.left]),
  ),
);
const activity = computed(() =>
  [...assignments.value]
    .sort((a, b) => b.assignmentDate.localeCompare(a.assignmentDate))
    .slice(0, 4)
    .map((assignment) => {
      const tenant = tenants.value.find(
        (item) => item.id === assignment.tenantId,
      );
      const room = rooms.value.find((item) => item.id === assignment.roomId);
      return {
        id: assignment.id,
        name: tenant?.fullName || "Tenant unavailable",
        room: room?.roomNumber || "Room unavailable",
        date: assignment.moveInDate,
        status: assignment.status,
      };
    }),
);
const tenantName = (id: number) =>
  tenants.value.find((tenant) => tenant.id === id)?.fullName ||
  "Tenant unavailable";

async function reviewRoomRequest(id: number, decision: "approve" | "reject") {
  const invitation = dormData.invitations.value.find((item) => item.id === id);
  if (!invitation || invitation.status !== "PENDING") return;
  const action = decision === "approve" ? "approve" : "reject";
  if (
    !window.confirm(
      `Are you sure you want to ${action} ${invitation.tenantName || "this tenant"}'s request for room ${invitation.roomNumber || invitation.roomId}?`,
    )
  ) {
    return;
  }

  invitationActionId.value = id;
  invitationNotice.value = "";
  let actionSucceeded = false;
  try {
    if (decision === "approve") {
      await dormData.approveInvitation(id);
    } else {
      await dormData.rejectInvitation(id);
    }
    actionSucceeded = true;
    invitationNotice.value = `Room request ${decision === "approve" ? "approved" : "rejected"}.`;
  } catch (error) {
    invitationNotice.value =
      error instanceof Error
        ? error.message
        : `Unable to ${action} the room request.`;
  } finally {
    invitationActionId.value = null;
    try {
      await dormData.loadInvitations();
    } catch (error) {
      if (actionSucceeded) {
        invitationNotice.value +=
          " The request was updated, but the list could not be refreshed.";
      } else if (!invitationNotice.value) {
        invitationNotice.value =
          error instanceof Error
            ? error.message
            : "Unable to refresh room requests.";
      }
    }
  }
}

async function refreshRoomRequests() {
  try {
    await dormData.loadInvitations();
    invitationNotice.value = "";
  } catch (error) {
    invitationNotice.value =
      error instanceof Error ? error.message : "Unable to refresh room requests.";
  }
}
</script>

<template>
  <AdminShell>
    <template #title>Dashboard overview</template>
    <div class="mx-auto max-w-[1400px] space-y-5">
      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p class="text-sm font-semibold text-brand-600">Overview</p>
          <h2
            class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Welcome back, {{ auth.user.value?.fullName || "Admin" }}
          </h2>
        </div>
        <p class="text-sm text-slate-500">
          Here’s what’s happening in your dormitory today.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard v-for="stat in stats" :key="stat.label" v-bind="stat" />
      </div>

      <section
        v-if="auth.role.value === 'ADMIN'"
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div
          class="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div>
            <h3 class="font-bold">Room join requests</h3>
            <p class="mt-1 text-sm text-slate-500">
              Review pending requests; processed requests remain visible here.
            </p>
          </div>
          <button
            type="button"
            class="self-start rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:self-auto"
            @click="refreshRoomRequests"
          >
            Refresh
          </button>
        </div>
        <p
          v-if="invitationNotice"
          class="mx-5 mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 sm:mx-6"
          role="status"
        >
          {{ invitationNotice }}
        </p>
        <div class="max-w-full overflow-x-auto">
          <table class="w-full min-w-[900px] text-left text-sm">
            <thead
              class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"
            >
              <tr>
                <th class="px-5 py-3">Tenant</th>
                <th class="px-5 py-3">Requested room</th>
                <th class="px-5 py-3">Invitation code</th>
                <th class="px-5 py-3">Request date</th>
                <th class="px-5 py-3">Status</th>
                <th class="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="request in roomJoinRequests"
                :key="request.id"
                class="align-top"
              >
                <td class="px-5 py-4">
                  <p class="font-semibold">
                    {{ request.tenantName || "Tenant unavailable" }}
                  </p>
                  <p class="text-xs text-slate-500">
                    {{ request.tenantEmail || "Email unavailable" }}
                  </p>
                </td>
                <td class="px-5 py-4">
                  {{ request.roomNumber || `Room ${request.roomId}` }}
                  <span v-if="request.building" class="text-slate-500">
                    · {{ request.building }}
                  </span>
                </td>
                <td class="px-5 py-4 font-mono">{{ request.code }}</td>
                <td class="px-5 py-4 text-slate-500">
                  {{ request.createdDate }}
                </td>
                <td class="px-5 py-4">
                  <span
                    class="rounded-full px-2.5 py-1 text-xs font-semibold"
                    :class="
                      request.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-700'
                        : request.status === 'APPROVED' || request.status === 'USED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                    "
                  >
                    {{ request.status }}
                  </span>
                </td>
                <td class="px-5 py-4">
                  <div
                    v-if="request.status === 'PENDING'"
                    class="flex gap-2"
                  >
                    <button
                      type="button"
                      class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      :disabled="invitationActionId === request.id"
                      @click="reviewRoomRequest(request.id, 'approve')"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      class="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                      :disabled="invitationActionId === request.id"
                      @click="reviewRoomRequest(request.id, 'reject')"
                    >
                      Reject
                    </button>
                  </div>
                  <span v-else class="text-xs text-slate-400">Processed</span>
                </td>
              </tr>
              <tr v-if="!roomJoinRequests.length">
                <td colspan="6" class="p-8 text-center text-slate-500">
                  No room join requests yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div
        class="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]"
      >
        <section
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="font-bold text-slate-900">Newly joined vs left</h3>
              <p class="mt-1 text-sm text-slate-500">
                Tenant movement over the last 8 months
              </p>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
              <span
                ><i
                  class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-brand-500"
                ></i
                >Newly joined</span
              ><span
                ><i
                  class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-200"
                ></i
                >Left</span
              >
            </div>
          </div>
          <div
            class="mt-8 flex h-56 items-end justify-around gap-2 border-b border-l border-slate-100 px-2 pb-0 pt-4"
          >
            <div
              v-for="month in monthlyMovement"
              :key="month.label"
              class="relative flex h-full flex-1 items-end justify-center gap-1"
            >
              <div
                class="w-3 rounded-t-md bg-brand-500 transition hover:bg-brand-700 sm:w-5"
                :style="{ height: `${(month.joined / movementMax) * 100}%` }"
                :title="`${month.joined} joined in ${month.label}`"
              ></div>
              <div
                class="w-3 rounded-t-md bg-blue-200 transition hover:bg-blue-300 sm:w-5"
                :style="{ height: `${(month.left / movementMax) * 100}%` }"
                :title="`${month.left} left in ${month.label}`"
              ></div>
              <span class="absolute -bottom-6 text-[10px] text-slate-400">{{
                month.label
              }}</span>
            </div>
          </div>
        </section>

        <section
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-bold">Occupancy status</h3>
              <p class="mt-1 text-sm text-slate-500">
                Rooms currently occupied
              </p>
            </div>
            <span class="text-sm font-bold text-brand-600"
              >{{ occupiedRooms }}/{{ rooms.length }}</span
            >
          </div>
          <div
            class="mx-auto mt-8 flex h-40 w-40 items-center justify-center rounded-full"
            :style="{
              background: `conic-gradient(#2563eb ${occupancyRate}%, #dbeafe 0)`,
            }"
          >
            <div
              class="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white"
            >
              <strong class="text-2xl">{{ occupancyRate }}%</strong
              ><span class="text-xs text-slate-400">occupied</span>
            </div>
          </div>
          <div class="mt-6 flex justify-center gap-5 text-xs text-slate-500">
            <span
              ><i
                class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-brand-500"
              ></i
              >Occupied</span
            ><span
              ><i
                class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-100"
              ></i
              >Available</span
            >
          </div>
        </section>
      </div>

      <div
        class="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(240px,0.8fr)]"
      >
        <section
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6"
          >
            <div>
              <h3 class="font-bold">Recent assignments</h3>
              <p class="mt-1 text-sm text-slate-500">
                Latest tenant room activity
              </p>
            </div>
            <NuxtLink
              to="/assignments"
              class="text-sm font-semibold text-brand-600"
              >View all</NuxtLink
            >
          </div>
          <div class="max-w-full overflow-x-auto">
            <table class="w-full min-w-[560px] text-left text-sm">
              <thead
                class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"
              >
                <tr>
                  <th class="px-5 py-3">Tenant</th>
                  <th class="px-5 py-3">Room no.</th>
                  <th class="px-5 py-3">Move-in date</th>
                  <th class="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="item in activity"
                  :key="item.id"
                  class="hover:bg-slate-50"
                >
                  <td class="px-5 py-4 font-semibold">{{ item.name }}</td>
                  <td class="px-5 py-4">{{ item.room }}</td>
                  <td class="px-5 py-4 text-slate-500">{{ item.date }}</td>
                  <td class="px-5 py-4">
                    <span
                      class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                      >{{ item.status }}</span
                    >
                  </td>
                </tr>
                <tr v-if="!activity.length">
                  <td colspan="4" class="p-8 text-center text-slate-500">
                    No assignments yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-slate-100 p-5"
          >
            <div>
              <h3 class="font-bold">Recent payments</h3>
              <p class="mt-1 text-sm text-slate-500">
                Latest collection activity
              </p>
            </div>
            <NuxtLink
              to="/payments"
              class="text-sm font-semibold text-brand-600"
              >View all</NuxtLink
            >
          </div>
          <div class="divide-y divide-slate-100">
            <div
              v-for="payment in payments.slice(0, 3)"
              :key="payment.id"
              class="flex items-center justify-between gap-3 p-4"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">
                  {{ tenantName(payment.tenantId) }}
                </p>
                <p class="text-xs text-slate-500">
                  ₱{{ payment.amount.toLocaleString() }} ·
                  {{ payment.paymentDate || "No payment date" }}
                </p>
              </div>
              <StatusBadge :value="payment.status" />
            </div>
            <p v-if="!payments.length" class="p-4 text-sm text-slate-500">
              No payment records yet.
            </p>
          </div>
        </section>
        <section
          class="rounded-2xl bg-brand-900 p-6 text-white shadow-lg shadow-brand-900/20"
        >
          <h3 class="font-bold">Quick actions</h3>
          <p class="mt-1 text-sm text-blue-100/70">
            Manage your most common tasks.
          </p>
          <div class="mt-5 space-y-2">
            <NuxtLink
              v-for="item in [
                { label: 'Add a new room', to: '/rooms' },
                { label: 'Assign a tenant', to: '/assignments' },
                { label: 'Create invitation', to: '/invitations' },
              ]"
              :key="item.to"
              :to="item.to"
              class="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white hover:text-brand-900"
              ><span>{{ item.label }}</span
              ><span>→</span></NuxtLink
            >
          </div>
        </section>
      </div>
    </div>
  </AdminShell>
</template>
