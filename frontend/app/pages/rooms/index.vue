<script setup lang="ts">
import AdminShell from "~/components/layout/AdminShell.vue";
import GlobalSearchResults from "~/components/layout/GlobalSearchResults.vue";

import type { RoomInput, RoomStatus } from "~/types/room";
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
const status = ref<"ALL" | RoomStatus>("ALL");
const building = ref("ALL");
const showForm = ref(false);
const editingId = ref<number | null>(null);
const notice = ref("");
const emptyForm = (): RoomInput => ({
  roomNumber: "",
  building: "",
  floor: 1,
  roomType: "Single",
  capacity: 1,
  monthlyRate: 0,
  status: "AVAILABLE",
  description: "",
});
const form = reactive<RoomInput>(emptyForm());
const buildings = computed(() => [
  ...new Set(data.rooms.value.map((room) => room.building)),
]);
const filteredRooms = computed(() =>
  data.rooms.value.filter(
    (room) =>
      `${room.roomNumber} ${room.building}`
        .concat(` ${room.floor} ${room.roomType} ${room.status} ${room.description}`)
        .toLocaleLowerCase()
        .includes(search.value.trim().toLocaleLowerCase()) &&
      (status.value === "ALL" || room.status === status.value) &&
      (building.value === "ALL" || room.building === building.value),
  ),
);
const stats = computed(() => [
  { label: "Total rooms", value: data.rooms.value.length },
  {
    label: "Available",
    value: data.rooms.value.filter((room) => room.status === "AVAILABLE")
      .length,
  },
  {
    label: "Occupied",
    value: data.rooms.value.filter(
      (room) => room.status === "OCCUPIED" || room.status === "FULL",
    ).length,
  },
  {
    label: "Full",
    value: data.rooms.value.filter((room) => room.status === "FULL").length,
  },
  {
    label: "Maintenance",
    value: data.rooms.value.filter((room) => room.status === "MAINTENANCE")
      .length,
  },
]);
function openForm(room?: (typeof data.rooms.value)[number]) {
  editingId.value = room?.id ?? null;
  Object.assign(form, room ? { ...room } : emptyForm());
  showForm.value = true;
}
async function saveRoom() {
  if (
    !form.roomNumber ||
    !form.building ||
    form.capacity < 1 ||
    form.monthlyRate < 0
  ) {
    notice.value = "Please complete the required room fields.";
    return;
  }
  const isEditing = editingId.value !== null;
  try {
    if (editingId.value) await data.updateRoom(editingId.value, form);
    else await data.createRoom(form);
    showForm.value = false;
    notice.value = isEditing ? "Room updated." : "Room created.";
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to save room.";
  }
}
async function deleteRoom(id: number) {
  if (!confirm("Delete this room?")) return;
  try {
    await data.deleteRoom(id);
    notice.value = "Room deleted.";
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to delete room.";
  }
}
function badge(value: string) {
  return value === "AVAILABLE"
    ? "bg-emerald-50 text-emerald-700"
    : value === "MAINTENANCE"
      ? "bg-amber-50 text-amber-700"
      : value === "FULL"
        ? "bg-rose-50 text-rose-700"
        : "bg-blue-50 text-blue-700";
}
</script>

<template>
  <AdminShell
    ><template #title>Rooms management</template>
    <div class="mx-auto max-w-7xl space-y-6">
      <div
        class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div>
          <h2 class="text-2xl font-bold">Rooms</h2>
          <p class="mt-1 text-sm text-slate-500">
            Manage availability, pricing, and occupancy.
          </p>
        </div>
        <button
          class="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          @click="openForm()"
        >
          + Add room
        </button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p class="text-sm text-slate-500">{{ stat.label }}</p>
          <p class="mt-2 text-2xl font-bold">{{ stat.value }}</p>
        </div>
      </div>
      <div
        v-if="notice"
        class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      >
        {{ notice }}
        <button class="float-right font-bold" @click="notice = ''">×</button>
      </div>
      <section
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div
          class="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row"
        >
          <div class="relative flex-1">
            <input
              v-model="search"
              type="search"
              aria-label="Search all modules or filter rooms"
              class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500"
              placeholder="Search all modules or filter rooms..."
            />
            <GlobalSearchResults :query="search" />
          </div>
          <select
            v-model="status"
            class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:w-auto"
          >
            <option value="ALL">All statuses</option>
            <option
              v-for="item in ['AVAILABLE', 'OCCUPIED', 'FULL', 'MAINTENANCE']"
              :key="item"
              :value="item"
            >
              {{ item }}
            </option></select
          ><select
            v-model="building"
            class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:w-auto"
          >
            <option value="ALL">All buildings</option>
            <option v-for="item in buildings" :key="item">{{ item }}</option>
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px] text-left text-sm">
            <thead
              class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"
            >
              <tr>
                <th class="px-5 py-4">Room</th>
                <th class="px-5 py-4">Building / floor</th>
                <th class="px-5 py-4">Type</th>
                <th class="px-5 py-4">Occupancy</th>
                <th class="px-5 py-4">Monthly rate</th>
                <th class="px-5 py-4">Status</th>
                <th class="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="room in filteredRooms"
                :key="room.id"
                class="hover:bg-slate-50"
              >
                <td class="px-5 py-4 font-bold">{{ room.roomNumber }}</td>
                <td class="px-5 py-4">
                  <span class="block font-medium">{{ room.building }}</span
                  ><span class="text-xs text-slate-500"
                    >Floor {{ room.floor }}</span
                  >
                </td>
                <td class="px-5 py-4">{{ room.roomType }}</td>
                <td class="px-5 py-4">
                  {{ room.currentOccupants }} / {{ room.capacity }}
                </td>
                <td class="px-5 py-4">
                  ₱{{ room.monthlyRate.toLocaleString() }}
                </td>
                <td class="px-5 py-4">
                  <span
                    class="rounded-full px-2.5 py-1 text-xs font-semibold"
                    :class="badge(room.status)"
                    >{{ room.status }}</span
                  >
                </td>
                <td class="px-5 py-4">
                  <div class="flex gap-3">
                    <button
                      class="font-semibold text-brand-600"
                      @click="openForm(room)"
                    >
                      Edit</button
                    ><button
                      class="font-semibold text-rose-600"
                      @click="deleteRoom(room.id)"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filteredRooms.length">
                <td colspan="7" class="px-5 py-12 text-center text-slate-500">
                  No rooms match your filters.
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
        <form
          class="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
          @submit.prevent="saveRoom"
        >
          <div class="flex justify-between">
            <div>
              <h3 class="text-xl font-bold">
                {{ editingId ? "Edit room" : "Add room" }}
              </h3>
              <p class="mt-1 text-sm text-slate-500">
                Room details are stored in the dormitory database.
              </p>
            </div>
            <button
              type="button"
              class="text-2xl text-slate-400"
              @click="showForm = false"
            >
              ×
            </button>
          </div>
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <label class="text-sm font-medium"
              >Room number<input
                v-model="form.roomNumber"
                required
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                placeholder="A-103" /></label
            ><label class="text-sm font-medium"
              >Building<input
                v-model="form.building"
                required
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                placeholder="Maple Hall" /></label
            ><label class="text-sm font-medium"
              >Floor<input
                v-model.number="form.floor"
                min="1"
                type="number"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label
            ><label class="text-sm font-medium"
              >Room type<select
                v-model="form.roomType"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              >
                <option>Single</option>
                <option>Double</option>
                <option>Shared</option>
              </select></label
            ><label class="text-sm font-medium"
              >Maximum capacity<input
                v-model.number="form.capacity"
                min="1"
                type="number"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label
            ><label class="text-sm font-medium"
              >Monthly rate<input
                v-model.number="form.monthlyRate"
                min="0"
                type="number"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label
            ><label class="text-sm font-medium"
              >Status<select
                v-model="form.status"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              >
                <option>AVAILABLE</option>
                <option>OCCUPIED</option>
                <option>FULL</option>
                <option>MAINTENANCE</option>
              </select></label
            ><label class="text-sm font-medium sm:col-span-2"
              >Description<textarea
                v-model="form.description"
                rows="3"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              ></textarea>
            </label>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 font-semibold text-slate-600"
              @click="showForm = false"
            >
              Cancel</button
            ><button
              class="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white"
            >
              Save room
            </button>
          </div>
        </form>
      </div>
    </div>
  </AdminShell>
</template>
