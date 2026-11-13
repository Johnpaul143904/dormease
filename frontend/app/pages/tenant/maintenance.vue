<script setup lang="ts">
import TenantShell from "~/components/layout/TenantShell.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import type { MaintenancePriority } from "~/types/maintenance";

const operations = useOperations();
const auth = useDormEaseAuth();
if (auth.role.value === "TENANT") operations.maintenance.value = [];
const showForm = ref(false);
const isSubmitting = ref(false);
const notice = ref("");
const pageError = ref("");
const publicFilter = ref<"ALL" | "IN_PROGRESS" | "RESOLVED">("ALL");
const form = reactive({
  title: "",
  description: "",
  priority: "MEDIUM" as MaintenancePriority,
});
const visibleAnnouncements = computed(() =>
  operations.publicMaintenance.value.filter(
    (announcement) =>
      publicFilter.value === "ALL" ||
      announcement.status === publicFilter.value,
  ),
);

onMounted(async () => {
  const results = await Promise.allSettled([
    operations.loadFromApi(true),
    operations.loadPublicMaintenance(),
  ]);
  const boardResult = results[1];
  if (boardResult.status === "rejected") {
    pageError.value =
      boardResult.reason instanceof Error
        ? boardResult.reason.message
        : "Unable to load public maintenance announcements.";
  }
});

async function submitRequest() {
  isSubmitting.value = true;
  notice.value = "";
  pageError.value = "";
  try {
    await operations.createTenantMaintenanceRequest(form);
    notice.value = "Your private maintenance request was submitted.";
    form.title = "";
    form.description = "";
    form.priority = "MEDIUM";
    showForm.value = false;
  } catch (error) {
    pageError.value =
      error instanceof Error ? error.message : "Unable to submit request.";
  } finally {
    isSubmitting.value = false;
  }
}

function statusLabel(status: string) {
  return status === "RESOLVED" ? "COMPLETED" : status.replaceAll("_", " ");
}
</script>

<template>
  <TenantShell>
    <template #title>Maintenance</template>
    <div class="mx-auto max-w-6xl space-y-8">
      <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 class="text-2xl font-bold">Maintenance</h2>
          <p class="mt-1 text-sm text-slate-500">
            View approved dormitory updates and track your private requests.
          </p>
        </div>
        <button
          class="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          @click="showForm = true"
        >
          + Submit a maintenance request
        </button>
      </header>

      <p
        v-if="notice"
        role="status"
        class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        {{ notice }}
      </p>
      <p
        v-if="pageError || operations.error.value"
        role="alert"
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        {{ pageError || operations.error.value }}
      </p>

      <section class="space-y-4">
        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p class="text-sm font-semibold text-brand-600">Shared with residents</p>
            <h3 class="mt-1 text-xl font-bold">Public maintenance board</h3>
            <p class="mt-1 text-sm text-slate-500">
              Only announcements reviewed and approved by the dorm team appear here.
            </p>
          </div>
          <label class="text-sm font-medium text-slate-600">
            Filter announcements
            <select
              v-model="publicFilter"
              class="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <option value="ALL">All</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Completed</option>
            </select>
          </label>
        </div>
        <div
          v-if="!visibleAnnouncements.length"
          class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"
        >
          No public maintenance announcements match this filter.
        </div>
        <div v-else class="grid gap-4 md:grid-cols-2">
          <article
            v-for="announcement in visibleAnnouncements"
            :key="`${announcement.title}-${announcement.createdAt}`"
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div class="flex items-start justify-between gap-3">
              <h4 class="text-lg font-bold">{{ announcement.title }}</h4>
              <StatusBadge :value="statusLabel(announcement.status)" />
            </div>
            <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {{ announcement.description }}
            </p>
            <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt class="text-slate-500">Affected location</dt>
              <dd class="font-medium">{{ announcement.location }}</dd>
              <dt class="text-slate-500">Posted</dt>
              <dd>{{ new Date(announcement.createdAt).toLocaleDateString() }}</dd>
              <dt class="text-slate-500">Last update</dt>
              <dd>{{ new Date(announcement.updatedAt).toLocaleDateString() }}</dd>
            </dl>
            <div
              v-if="announcement.updates.length"
              class="mt-5 border-t border-slate-100 pt-4"
            >
              <h5 class="text-xs font-bold uppercase tracking-wide text-slate-500">
                Progress updates
              </h5>
              <ol class="mt-3 space-y-2">
                <li
                  v-for="(update, index) in announcement.updates"
                  :key="`${update.status}-${update.createdAt}-${index}`"
                  class="flex items-center justify-between gap-3 text-sm"
                >
                  <span class="font-medium">{{ statusLabel(update.status) }}</span>
                  <time class="text-slate-500">{{
                    new Date(update.createdAt).toLocaleDateString()
                  }}</time>
                </li>
              </ol>
            </div>
          </article>
        </div>
      </section>

      <section class="space-y-4">
        <div>
          <p class="text-sm font-semibold text-brand-600">Private to your account</p>
          <h3 class="mt-1 text-xl font-bold">My requests</h3>
          <p class="mt-1 text-sm text-slate-500">
            Pending and rejected requests are visible only to you and authorized staff.
          </p>
        </div>
        <div
          v-if="!operations.maintenance.value.length"
          class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm"
        >
          You have not submitted any maintenance requests yet.
        </div>
        <div v-else class="space-y-3">
          <article
            v-for="request in operations.maintenance.value"
            :key="request.id"
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h4 class="font-semibold">{{ request.issue }}</h4>
                <p class="mt-1 text-sm text-slate-500">
                  {{ request.roomNumber ? `Room ${request.roomNumber} · ` : "" }}Submitted
                  {{ request.requestDate }}
                </p>
                <p class="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                  {{ request.description }}
                </p>
                <p class="mt-2 text-xs text-slate-500">
                  Priority: {{ request.priority }}
                </p>
              </div>
              <StatusBadge :value="statusLabel(request.status)" />
            </div>
            <ol
              v-if="request.history?.length"
              class="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3"
            >
              <li
                v-for="(update, index) in request.history"
                :key="`${update.status}-${update.createdAt}-${index}`"
                class="text-xs text-slate-500"
              >
                {{ statusLabel(update.status) }} ·
                {{ new Date(update.createdAt).toLocaleDateString() }}
              </li>
            </ol>
          </article>
        </div>
      </section>

      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center"
        @click.self="showForm = false"
      >
        <form
          class="max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
          @submit.prevent="submitRequest"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-xl font-bold">New maintenance request</h3>
              <p class="mt-1 text-sm text-slate-500">
                This request is private until it is approved for the public board.
              </p>
            </div>
            <button
              type="button"
              class="text-2xl text-slate-400"
              aria-label="Close"
              @click="showForm = false"
            >
              ×
            </button>
          </div>
          <label class="block text-sm font-medium"
            >Title
            <input
              v-model.trim="form.title"
              required
              minlength="3"
              maxlength="120"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            />
          </label>
          <label class="block text-sm font-medium"
            >Description
            <textarea
              v-model.trim="form.description"
              required
              minlength="3"
              maxlength="2000"
              rows="4"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            />
          </label>
          <label class="block text-sm font-medium"
            >Priority
            <select
              v-model="form.priority"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            >
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>URGENT</option>
            </select>
          </label>
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="w-full rounded-xl px-4 py-2.5 font-semibold text-slate-600 sm:w-auto"
              @click="showForm = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60 sm:w-auto"
            >
              {{ isSubmitting ? "Submitting…" : "Submit private request" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </TenantShell>
</template>
