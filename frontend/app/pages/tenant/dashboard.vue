<script setup lang="ts">
import TenantShell from "~/components/layout/TenantShell.vue";

const data = useDormData();
const auth = useDormEaseAuth();
onMounted(() => {
  void data.loadTenantData();
});
const tenant = computed(() =>
  data.tenants.value.find((item) => item.id === data.currentTenantId.value),
);
const room = computed(() =>
  data.rooms.value.find((item) => item.id === tenant.value?.assignedRoomId),
);
const assignment = computed(() =>
  data.assignments.value.find(
    (item) => item.tenantId === tenant.value?.id && item.status === "ACTIVE",
  ),
);
</script>
<template>
  <TenantShell
    ><template #title>My dashboard</template>
    <div class="mx-auto max-w-6xl space-y-8">
      <div>
        <p class="text-sm font-semibold text-brand-600">
          Welcome back,
          {{ auth.user.value?.fullName?.split(" ")[0] || "Tenant" }}
        </p>
        <h2 class="mt-1 text-3xl font-bold tracking-tight">
          Your residence at a glance.
        </h2>
        <p class="mt-2 text-slate-500">
          Keep track of your room and stay details.
        </p>
      </div>
      <section
        v-if="room"
        class="overflow-hidden rounded-2xl bg-brand-900 p-6 text-white shadow-xl shadow-brand-900/20 sm:p-8"
      >
        <div
          class="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"
        >
          <div>
            <p
              class="text-sm font-semibold uppercase tracking-widest text-blue-200"
            >
              Assigned room
            </p>
            <h3 class="mt-3 text-4xl font-bold">{{ room.roomNumber }}</h3>
            <p class="mt-2 text-blue-100">
              {{ room.building }} · {{ room.roomType }} room
            </p>
          </div>
          <NuxtLink
            to="/tenant/room"
            class="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-brand-700"
            >View room details</NuxtLink
          >
        </div>
        <div
          class="mt-8 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3"
        >
          <div>
            <p class="text-sm text-blue-200">Capacity</p>
            <p class="mt-1 font-semibold">
              {{ room.currentOccupants }} / {{ room.capacity }} occupants
            </p>
          </div>
          <div>
            <p class="text-sm text-blue-200">Move-in date</p>
            <p class="mt-1 font-semibold">
              {{ assignment?.moveInDate || "—" }}
            </p>
          </div>
          <div>
            <p class="text-sm text-blue-200">Status</p>
            <p class="mt-1 font-semibold">{{ assignment?.status || "—" }}</p>
          </div>
        </div>
      </section>
      <section
        v-else
        class="rounded-2xl border border-dashed border-brand-200 bg-brand-50 p-8 text-center"
      >
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm"
        >
          ⌁
        </div>
        <h3 class="mt-5 text-xl font-bold">You haven’t joined a room yet</h3>
        <p class="mx-auto mt-2 max-w-md text-slate-600">
          Contact your dorm administrator to ask about available rooms.
        </p>
      </section>
      <div class="grid gap-5 sm:grid-cols-3">
        <div
          v-for="item in [
            {
              label: 'Monthly rent',
              value: room ? `₱${room.monthlyRate.toLocaleString()}` : '—',
            },
            { label: 'Room building', value: room?.building || 'Not assigned' },
            { label: 'Email address', value: auth.user.value?.email || '—' },
          ]"
          :key="item.label"
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p class="text-sm text-slate-500">{{ item.label }}</p>
          <p class="mt-2 text-xl font-bold">{{ item.value }}</p>
        </div>
      </div>
    </div>
  </TenantShell>
</template>
