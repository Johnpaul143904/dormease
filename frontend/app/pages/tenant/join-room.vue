<script setup lang="ts">
import TenantShell from "~/components/layout/TenantShell.vue";

const data = useDormData();
const code = ref("");
const result = ref<{
  ok: boolean;
  message?: string;
  code?: string;
  room?: (typeof data.rooms.value)[number];
} | null>(null);
const notice = ref("");
const tenant = computed(() =>
  data.tenants.value.find((item) => item.id === data.currentTenantId.value),
);
onMounted(() => {
  void data.loadTenantData();
});
async function validate() {
  result.value = await data.joinWithInvitation(code.value);
}
async function confirmJoin() {
  if (!result.value?.ok || !result.value.code) return;
  try {
    await data.acceptInvitation(result.value.code);
    notice.value = "Room joined successfully.";
    result.value = null;
    code.value = "";
  } catch (error) {
    result.value = {
      ok: false,
      message:
        error instanceof Error ? error.message : "Unable to accept invitation.",
    };
  }
}
async function rejectInvitation() {
  if (!result.value?.ok || !result.value.code) return;
  try {
    await data.rejectInvitation(result.value.code);
    notice.value = "Invitation declined.";
    result.value = null;
    code.value = "";
  } catch (error) {
    result.value = {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to decline invitation.",
    };
  }
}
</script>
<template>
  <TenantShell
    ><template #title>Join a room</template>
    <div class="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 class="text-2xl font-bold">Join a room</h2>
        <p class="mt-1 text-sm text-slate-500">
          Enter an invitation code shared by your dorm administrator.
        </p>
      </div>
      <section
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div class="flex items-center gap-4 rounded-xl bg-brand-50 p-4">
          <span
            class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-xl text-white"
            >⌁</span
          >
          <div>
            <h3 class="font-bold">Invitation code</h3>
            <p class="text-sm text-slate-500">
              Review the room before accepting or declining.
            </p>
          </div>
        </div>
        <label class="mt-6 block text-sm font-medium"
          >Enter code<input
            v-model="code"
            class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-brand-500"
            placeholder="DE-8K4P2M"
            @keyup.enter="validate" /></label
        ><button
          class="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white"
          @click="validate"
        >
          Check invitation
        </button>
        <div
          v-if="result && !result.ok"
          class="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {{ result.message }}
        </div>
        <div
          v-if="result?.ok && result.room"
          class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
        >
          <p class="text-sm font-semibold text-emerald-700">Room found</p>
          <h3 class="mt-1 text-xl font-bold">
            {{ result.room.roomNumber }} · {{ result.room.building }}
          </h3>
          <p class="mt-1 text-sm text-slate-600">
            {{ result.room.currentOccupants }} of
            {{ result.room.capacity }} occupants · {{ result.room.roomType }} ·
            ₱{{ result.room.monthlyRate.toLocaleString() }}/month
          </p>
          <p class="mt-4 text-sm text-slate-600">
            Accepting assigns this room to
            <strong>{{ tenant?.fullName || "your account" }}</strong
            >.
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              class="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white"
              @click="confirmJoin"
            >
              Accept invitation</button
            ><button
              class="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700"
              @click="rejectInvitation"
            >
              Decline invitation
            </button>
          </div>
        </div>
        <div
          v-if="notice"
          class="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {{ notice }}
          <NuxtLink to="/tenant/dashboard" class="font-semibold underline"
            >Go to dashboard</NuxtLink
          >
        </div>
      </section>
    </div>
  </TenantShell>
</template>
