<script setup lang="ts">
import TenantShell from "~/components/layout/TenantShell.vue";

const data = useDormData();
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
    ><template #title>My assigned room</template>
    <div class="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 class="text-2xl font-bold">My assigned room</h2>
        <p class="mt-1 text-sm text-slate-500">
          Your current room and assignment details.
        </p>
      </div>
      <section
        v-if="room"
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-semibold text-brand-600">
              {{ room.building }}
            </p>
            <h3 class="mt-1 text-4xl font-bold">{{ room.roomNumber }}</h3>
            <p class="mt-2 text-slate-500">
              {{ room.roomType }} room · {{ room.description }}
            </p>
          </div>
          <span
            class="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"
            >{{ assignment?.status || "—" }}</span
          >
        </div>
        <div
          class="mt-8 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-3"
        >
          <div>
            <p class="text-xs uppercase tracking-wider text-slate-400">
              Capacity
            </p>
            <p class="mt-1 text-lg font-bold">
              {{ room.currentOccupants }} / {{ room.capacity }}
            </p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wider text-slate-400">
              Monthly rate
            </p>
            <p class="mt-1 text-lg font-bold">
              ₱{{ room.monthlyRate.toLocaleString() }}
            </p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wider text-slate-400">
              Move-in date
            </p>
            <p class="mt-1 text-lg font-bold">
              {{ assignment?.moveInDate || "—" }}
            </p>
          </div>
        </div>
      </section>
      <section
        v-else
        class="rounded-2xl border border-dashed border-slate-300 p-10 text-center"
      >
        <h3 class="text-xl font-bold">No room assigned</h3>
        <p class="mt-2 text-sm text-slate-500">
          Room assignment details will appear here once they are added by an
          administrator.
        </p>
      </section>
    </div>
  </TenantShell>
</template>
