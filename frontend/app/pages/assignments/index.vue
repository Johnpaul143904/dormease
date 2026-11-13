<script setup lang="ts">
import AdminShell from "~/components/layout/AdminShell.vue";
import GlobalSearchResults from "~/components/layout/GlobalSearchResults.vue";

const data = useDormData();
onMounted(data.loadFromApi);
const route = useRoute();
const search = ref("");
watch(
  () => route.query.search,
  (value) => {
    search.value = typeof value === "string" ? value : "";
  },
  { immediate: true },
);
const status = ref("ALL");
const showForm = ref(false);
const tenantId = ref<number | null>(null);
const roomId = ref<number | null>(null);
const moveInDate = ref(new Date().toISOString().slice(0, 10));
const notice = ref("");
const current = computed(() =>
  data.assignments.value.filter((item) => {
    const tenant = data.tenants.value.find((row) => row.id === item.tenantId);
    return (
      `${tenant?.fullName} ${data.rooms.value.find((row) => row.id === item.roomId)?.roomNumber} ${item.status} ${item.assignmentDate} ${item.moveInDate} ${item.moveOutDate || ""}`
        .toLocaleLowerCase()
        .includes(search.value.trim().toLocaleLowerCase()) &&
      (status.value === "ALL" || item.status === status.value)
    );
  }),
);
const availableRooms = computed(() =>
  data.rooms.value.filter(
    (room) =>
      room.status !== "MAINTENANCE" && room.currentOccupants < room.capacity,
  ),
);
const unassignedTenants = computed(() =>
  data.tenants.value.filter(
    (tenant) => !tenant.assignedRoomId && tenant.status !== "INACTIVE",
  ),
);
const labelTenant = (id: number) =>
  data.tenants.value.find((item) => item.id === id)?.fullName ||
  "Tenant unavailable";
const labelRoom = (id: number) => {
  const room = data.rooms.value.find((item) => item.id === id);
  return room ? `${room.roomNumber} · ${room.building}` : "Room unavailable";
};
async function assign() {
  if (!tenantId.value || !roomId.value) return;
  try {
    await data.assignTenant(tenantId.value, roomId.value, moveInDate.value);
    notice.value = "Tenant assigned successfully.";
    showForm.value = false;
    tenantId.value = null;
    roomId.value = null;
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to create assignment.";
  }
}
async function terminate(id: number) {
  try {
    await data.terminateAssignment(id);
    notice.value = "Assignment terminated.";
  } catch (error) {
    notice.value =
      error instanceof Error
        ? error.message
        : "Unable to terminate assignment.";
  }
}
</script>
<template>
  <AdminShell
    ><template #title>Room assignments</template>
    <div class="mx-auto max-w-7xl space-y-6">
      <div
        class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div>
          <h2 class="text-2xl font-bold">Room assignments</h2>
          <p class="mt-1 text-sm text-slate-500">
            Assign residents and track move-in history.
          </p>
        </div>
        <button
          class="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"
          @click="showForm = true"
        >
          + Assign tenant
        </button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="stat in [
            {
              label: 'Total assignments',
              value: data.assignments.value.length,
            },
            {
              label: 'Active',
              value: data.assignments.value.filter(
                (item) => item.status === 'ACTIVE',
              ).length,
            },
            {
              label: 'Pending',
              value: data.assignments.value.filter(
                (item) => item.status === 'PENDING',
              ).length,
            },
            {
              label: 'Completed',
              value: data.assignments.value.filter(
                (item) => item.status === 'COMPLETED',
              ).length,
            },
          ]"
          :key="stat.label"
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p class="text-sm text-slate-500">{{ stat.label }}</p>
          <p class="mt-2 text-2xl font-bold">{{ stat.value }}</p>
        </div>
      </div>
      <div
        v-if="notice"
        class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
      >
        {{ notice }}
      </div>
      <section
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div class="relative min-w-0 flex-1">
            <input
              v-model="search"
              type="search"
              aria-label="Search all modules or filter assignments"
              class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              placeholder="Search all modules or filter assignments..."
            />
            <GlobalSearchResults :query="search" />
          </div>
          <select
            v-model="status"
            class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:w-auto"
          >
            <option>ALL</option>
            <option>ACTIVE</option>
            <option>PENDING</option>
            <option>COMPLETED</option>
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[800px] text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th class="px-5 py-4">Tenant</th>
                <th class="px-5 py-4">Room</th>
                <th class="px-5 py-4">Assignment date</th>
                <th class="px-5 py-4">Move-in</th>
                <th class="px-5 py-4">Status</th>
                <th class="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in current" :key="item.id">
                <td class="px-5 py-4 font-semibold">
                  {{ labelTenant(item.tenantId) }}
                </td>
                <td class="px-5 py-4">{{ labelRoom(item.roomId) }}</td>
                <td class="px-5 py-4">{{ item.assignmentDate }}</td>
                <td class="px-5 py-4">{{ item.moveInDate }}</td>
                <td class="px-5 py-4">
                  <span
                    class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                    >{{ item.status }}</span
                  >
                </td>
                <td class="px-5 py-4 text-right">
                  <button
                    v-if="item.status === 'ACTIVE'"
                    class="font-semibold text-rose-600"
                    @click="terminate(item.id)"
                  >
                    Terminate
                  </button>
                </td>
              </tr>
              <tr v-if="!current.length">
                <td colspan="6" class="p-12 text-center text-slate-500">
                  No assignments match your search or filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center"
      >
        <div class="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
          <div class="flex justify-between">
            <div>
              <h3 class="text-xl font-bold">Assign tenant</h3>
              <p class="mt-1 text-sm text-slate-500">
                Only unassigned tenants and rooms with capacity are shown.
              </p>
            </div>
            <button class="text-2xl text-slate-400" @click="showForm = false">
              ×
            </button>
          </div>
          <div class="mt-6 space-y-4">
            <label class="block text-sm font-medium"
              >Tenant<select
                v-model="tenantId"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3"
              >
                <option :value="null">Select tenant</option>
                <option
                  v-for="tenant in unassignedTenants"
                  :key="tenant.id"
                  :value="tenant.id"
                >
                  {{ tenant.fullName }}
                </option>
              </select></label
            ><label class="block text-sm font-medium"
              >Available room<select
                v-model="roomId"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3"
              >
                <option :value="null">Select room</option>
                <option
                  v-for="room in availableRooms"
                  :key="room.id"
                  :value="room.id"
                >
                  {{ room.roomNumber }} · {{ room.building }} ({{
                    room.capacity - room.currentOccupants
                  }}
                  slot{{
                    room.capacity - room.currentOccupants === 1 ? "" : "s"
                  }})
                </option>
              </select></label
            ><label class="block text-sm font-medium"
              >Move-in date<input
                v-model="moveInDate"
                type="date"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3"
            /></label>
          </div>
          <button
            class="mt-6 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white"
            @click="assign"
          >
            Confirm assignment
          </button>
        </div>
      </div>
    </div>
  </AdminShell>
</template>
