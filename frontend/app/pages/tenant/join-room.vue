<script setup lang="ts">
import TenantShell from "~/components/layout/TenantShell.vue";

const data = useDormData();
const code = ref("");
const result = ref<Awaited<ReturnType<typeof data.joinWithInvitation>> | null>(
  null,
);
const notice = ref("");
const isSubmitting = ref(false);

onMounted(() => {
  void data.loadTenantData();
  void data.loadMyRoomRequests().catch((error: unknown) => {
    notice.value =
      error instanceof Error
        ? error.message
        : "Unable to load your room requests.";
  });
});

async function validate() {
  notice.value = "";
  result.value = await data.joinWithInvitation(code.value);
}

async function requestToJoin() {
  if (!result.value?.ok) return;

  isSubmitting.value = true;
  notice.value = "";
  try {
    await data.submitJoinRequest(result.value.code);
    result.value = null;
    code.value = "";
    notice.value =
      "Request submitted. Your room assignment will be created after Admin approval.";
    try {
      await data.loadMyRoomRequests();
    } catch {
      notice.value += " Your request was sent, but the status list could not be refreshed.";
    }
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to submit your request.";
  } finally {
    isSubmitting.value = false;
  }
}

async function refreshRequests() {
  try {
    await data.loadMyRoomRequests();
    notice.value = "";
  } catch (error) {
    notice.value =
      error instanceof Error
        ? error.message
        : "Unable to refresh your room requests.";
  }
}

function requestStatusClass(status: string) {
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  if (status === "APPROVED" || status === "USED")
    return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}
</script>

<template>
  <TenantShell>
    <template #title>Join a room</template>
    <div class="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 class="text-2xl font-bold">Join a room</h2>
        <p class="mt-1 text-sm text-slate-500">
          Enter an invitation code shared by your dorm administrator.
        </p>
      </div>
      <section
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div class="flex items-center gap-4 rounded-xl bg-brand-50 p-4">
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-xl text-white"
            >⌁</span
          >
          <div>
            <h3 class="font-bold">Invitation code</h3>
            <p class="text-sm text-slate-500">
              Submitting a code sends a request for Admin approval.
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
          type="button"
          class="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white"
          @click="validate"
        >
          Check invitation
        </button>
        <div
          v-if="result && !result.ok"
          class="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          role="status"
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
            Your request will remain pending until an Admin reviews it. The room
            will not be assigned before approval.
          </p>
          <button
            type="button"
            class="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            :disabled="isSubmitting"
            @click="requestToJoin"
          >
            {{ isSubmitting ? "Submitting…" : "Request to join room" }}
          </button>
        </div>
        <div
          v-if="notice"
          class="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800"
          role="status"
        >
          {{ notice }}
        </div>
      </section>

      <section
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="font-bold">Your room requests</h3>
            <p class="mt-1 text-sm text-slate-500">
              Check the status of your invitation requests.
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="refreshRequests"
          >
            Refresh
          </button>
        </div>
        <div
          v-if="!data.myRoomRequests.value.length"
          class="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500"
        >
          You have not submitted any room requests.
        </div>
        <ul v-else class="mt-4 divide-y divide-slate-100">
          <li
            v-for="request in data.myRoomRequests.value"
            :key="request.id"
            class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <p class="font-semibold">
                {{ request.roomNumber || `Room ${request.roomId}` }}
                <span v-if="request.building" class="text-slate-500">
                  · {{ request.building }}
                </span>
              </p>
              <p class="break-all font-mono text-xs text-slate-500">
                {{ request.code }}
              </p>
              <p class="text-xs text-slate-500">
                Requested {{ request.createdDate }}
              </p>
            </div>
            <span
              class="self-start rounded-full px-2.5 py-1 text-xs font-semibold sm:self-auto"
              :class="requestStatusClass(request.status)"
            >
              {{ request.status }}
            </span>
          </li>
        </ul>
      </section>
    </div>
  </TenantShell>
</template>
