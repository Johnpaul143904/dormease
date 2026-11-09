<script setup lang="ts">
import AdminShell from "~/components/layout/AdminShell.vue";
import GlobalSearchResults from "~/components/layout/GlobalSearchResults.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import type {
  MaintenanceRequest,
  MaintenanceStatus,
} from "~/types/maintenance";

const operations = useOperations();
const dormData = useDormData();
const route = useRoute();
const search = ref("");
const filter = ref<"ALL" | MaintenanceStatus>("ALL");
const selectedId = ref<number | null>(null);
const approvingId = ref<number | null>(null);
const pageNotice = ref("");
const pageError = ref("");
const isSaving = ref(false);
const approvalForm = reactive({
  announcementTitle: "",
  announcementDescription: "",
  publicLocation: "",
});
const announcementForm = reactive({
  announcementTitle: "",
  announcementDescription: "",
  publicLocation: "",
});
const maintenance = computed(() => operations.maintenance.value);
const selected = computed(
  () => maintenance.value.find((request) => request.id === selectedId.value) ?? null,
);
const tenantName = (request: MaintenanceRequest) =>
  request.tenantName ||
  dormData.tenants.value.find((tenant) => tenant.id === request.tenantId)
    ?.fullName ||
  "Tenant unavailable";
const roomLabel = (request: MaintenanceRequest) =>
  request.roomNumber
    ? `${request.roomNumber}${request.building ? ` · ${request.building}` : ""}`
    : dormData.rooms.value.find((room) => room.id === request.roomId)
        ?.roomNumber || "Room unavailable";
const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return maintenance.value.filter((request) => {
    const matchesSearch =
      !query ||
      [
        request.issue,
        request.description,
        request.announcementTitle,
        request.announcementDescription,
        request.publicLocation,
        tenantName(request),
        request.tenantEmail,
        request.roomNumber,
        request.building,
        request.priority,
        request.status,
        request.requestDate,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    return (
      matchesSearch && (filter.value === "ALL" || request.status === filter.value)
    );
  });
});
const stats = computed(() => [
  { label: "Pending", value: count("PENDING"), tone: "amber" as const },
  { label: "Approved", value: count("APPROVED"), tone: "blue" as const },
  { label: "In progress", value: count("IN_PROGRESS"), tone: "violet" as const },
  { label: "Completed", value: count("RESOLVED"), tone: "green" as const },
  { label: "Rejected", value: count("REJECTED"), tone: "rose" as const },
]);

function count(status: MaintenanceStatus) {
  return maintenance.value.filter((request) => request.status === status).length;
}

function statusLabel(status: string) {
  return status === "RESOLVED" ? "COMPLETED" : status.replaceAll("_", " ");
}

function showDetails(request: MaintenanceRequest) {
  selectedId.value = request.id;
  announcementForm.announcementTitle =
    request.announcementTitle || "Maintenance notice";
  announcementForm.announcementDescription =
    request.announcementDescription || "";
  announcementForm.publicLocation = request.publicLocation || "";
}

function openApproval(request: MaintenanceRequest) {
  approvingId.value = request.id;
  approvalForm.announcementTitle = "Maintenance notice";
  approvalForm.announcementDescription = "";
  approvalForm.publicLocation = "";
}

async function approveRequest() {
  if (approvingId.value === null) return;
  isSaving.value = true;
  pageNotice.value = "";
  pageError.value = "";
  try {
    await operations.approveMaintenance(approvingId.value, approvalForm);
    pageNotice.value = "Request approved and published to the public board.";
    approvingId.value = null;
  } catch (error) {
    pageError.value =
      error instanceof Error ? error.message : "Unable to approve request.";
  } finally {
    isSaving.value = false;
  }
}

async function rejectRequest(request: MaintenanceRequest) {
  if (!window.confirm(`Reject the private request "${request.issue}"?`)) return;
  pageNotice.value = "";
  pageError.value = "";
  try {
    await operations.rejectMaintenance(request.id);
    pageNotice.value = "Request rejected. It remains private.";
  } catch (error) {
    pageError.value =
      error instanceof Error ? error.message : "Unable to reject request.";
  }
}

async function changeStatus(
  request: MaintenanceRequest,
  status: Extract<MaintenanceStatus, "IN_PROGRESS" | "RESOLVED">,
) {
  pageNotice.value = "";
  pageError.value = "";
  try {
    await operations.updateMaintenanceStatus(request.id, status);
    pageNotice.value = `Request marked ${statusLabel(status).toLowerCase()}.`;
  } catch (error) {
    pageError.value =
      error instanceof Error ? error.message : "Unable to update request status.";
  }
}

async function saveAnnouncement() {
  if (!selected.value) return;
  pageNotice.value = "";
  pageError.value = "";
  try {
    await operations.updateMaintenanceAnnouncement(selected.value.id, {
      announcementTitle: announcementForm.announcementTitle,
      announcementDescription: announcementForm.announcementDescription,
      publicLocation: announcementForm.publicLocation,
    });
    pageNotice.value = "Public announcement updated.";
  } catch (error) {
    pageError.value =
      error instanceof Error ? error.message : "Unable to update announcement.";
  }
}

watch(
  () => route.query.search,
  (value) => {
    search.value = typeof value === "string" ? value : "";
  },
  { immediate: true },
);

onMounted(() => {
  void dormData.loadFromApi();
  void operations.loadFromApi();
});
</script>

<template>
  <AdminShell>
    <template #title>Maintenance</template>
    <div class="mx-auto max-w-[1400px] space-y-6">
      <header>
        <p class="text-sm font-semibold text-brand-600">Operations</p>
        <h2 class="mt-1 text-3xl font-bold">Maintenance management</h2>
        <p class="mt-2 text-slate-500">
          Review private requests, publish approved announcements, and track progress.
        </p>
      </header>

      <p
        v-if="pageNotice"
        role="status"
        class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        {{ pageNotice }}
      </p>
      <p
        v-if="pageError || operations.error.value"
        role="alert"
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        {{ pageError || operations.error.value }}
      </p>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p class="text-sm text-slate-500">{{ stat.label }}</p>
          <p class="mt-2 text-2xl font-bold">{{ stat.value }}</p>
        </div>
      </div>

      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row">
          <div class="relative min-w-0 flex-1">
            <input
              v-model="search"
              type="search"
              aria-label="Search all modules or filter maintenance requests"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
              placeholder="Search all modules or filter maintenance..."
            />
            <GlobalSearchResults :query="search" />
          </div>
          <select
            v-model="filter"
            aria-label="Filter maintenance requests by status"
            class="rounded-xl border border-slate-200 px-3 py-3 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div v-if="operations.loading.value" class="p-10 text-center text-slate-500">
          Loading maintenance requests...
        </div>
        <div v-else-if="!filtered.length" class="p-12 text-center text-slate-500">
          No maintenance requests match your filters.
        </div>
        <div v-else class="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="request in filtered"
            :key="request.id"
            class="flex flex-col rounded-xl border border-slate-200 p-5"
          >
            <div class="flex items-start justify-between gap-3">
              <button
                class="text-left font-semibold text-brand-700 hover:underline"
                @click="showDetails(request)"
              >
                {{ request.issue }}
              </button>
              <StatusBadge :value="statusLabel(request.status)" />
            </div>
            <p class="mt-3 line-clamp-3 text-sm text-slate-600">
              {{ request.description }}
            </p>
            <p class="mt-3 text-sm font-medium">
              {{ tenantName(request) }}
            </p>
            <p class="text-xs text-slate-500">
              {{ request.tenantEmail }} · Room {{ roomLabel(request) }}
            </p>
            <p class="mt-2 text-xs text-slate-500">
              {{ request.priority }} priority · Submitted {{ request.requestDate }}
            </p>
            <div class="mt-auto flex flex-wrap gap-2 pt-5">
              <button
                class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                @click="showDetails(request)"
              >
                View details & history
              </button>
              <template v-if="request.status === 'PENDING'">
                <button
                  class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                  @click="openApproval(request)"
                >
                  Approve & publish
                </button>
                <button
                  class="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                  @click="rejectRequest(request)"
                >
                  Reject
                </button>
              </template>
              <button
                v-if="request.status === 'APPROVED'"
                class="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
                @click="changeStatus(request, 'IN_PROGRESS')"
              >
                Mark in progress
              </button>
              <button
                v-if="request.status === 'APPROVED' || request.status === 'IN_PROGRESS'"
                class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                @click="changeStatus(request, 'RESOLVED')"
              >
                Mark completed
              </button>
            </div>
          </article>
        </div>
      </section>

      <div
        v-if="approvingId !== null"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        @click.self="approvingId = null"
      >
        <form
          class="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          @submit.prevent="approveRequest"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-xl font-bold">Approve public announcement</h3>
              <p class="mt-1 text-sm text-slate-500">
                Only these announcement fields are visible to other tenants.
              </p>
            </div>
            <button type="button" class="text-2xl text-slate-400" @click="approvingId = null">
              ×
            </button>
          </div>
          <label class="block text-sm font-medium">
            Public title
            <input
              v-model.trim="approvalForm.announcementTitle"
              maxlength="120"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              placeholder="Maintenance notice"
            />
          </label>
          <label class="block text-sm font-medium">
            Public description
            <textarea
              v-model.trim="approvalForm.announcementDescription"
              maxlength="2000"
              rows="4"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              placeholder="Add resident-safe information about the work."
            />
          </label>
          <label class="block text-sm font-medium">
            Affected location
            <input
              v-model.trim="approvalForm.publicLocation"
              maxlength="160"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              placeholder="Use a general area; do not enter a tenant's room number."
            />
          </label>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 font-semibold text-slate-600"
              @click="approvingId = null"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSaving"
              class="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            >
              {{ isSaving ? "Approving…" : "Approve & publish" }}
            </button>
          </div>
        </form>
      </div>

      <div
        v-if="selected"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        @click.self="selectedId = null"
      >
        <section class="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <div class="flex justify-between gap-4">
            <div>
              <p class="text-sm text-brand-600">Private request details</p>
              <h3 class="mt-1 text-xl font-bold">{{ selected.issue }}</h3>
            </div>
            <button class="text-2xl text-slate-400" aria-label="Close details" @click="selectedId = null">
              ×
            </button>
          </div>
          <div class="grid gap-3 text-sm sm:grid-cols-2">
            <p><span class="text-slate-500">Submitter:</span> {{ tenantName(selected) }}</p>
            <p><span class="text-slate-500">Email:</span> {{ selected.tenantEmail || "—" }}</p>
            <p><span class="text-slate-500">Contact:</span> {{ selected.tenantContactNumber || "—" }}</p>
            <p><span class="text-slate-500">Room:</span> {{ roomLabel(selected) }}</p>
            <p><span class="text-slate-500">Priority:</span> {{ selected.priority }}</p>
            <p><span class="text-slate-500">Status:</span> {{ statusLabel(selected.status) }}</p>
          </div>
          <div>
            <h4 class="text-sm font-semibold">Private request description</h4>
            <p class="mt-1 whitespace-pre-wrap text-sm text-slate-600">{{ selected.description }}</p>
          </div>
          <div v-if="selected.isPublic" class="space-y-3 border-t border-slate-100 pt-4">
            <h4 class="font-semibold">Public announcement</h4>
            <label class="block text-sm font-medium">
              Title
              <input v-model.trim="announcementForm.announcementTitle" maxlength="120" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label class="block text-sm font-medium">
              Public description
              <textarea v-model.trim="announcementForm.announcementDescription" maxlength="2000" rows="3" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label class="block text-sm font-medium">
              Public location
              <input v-model.trim="announcementForm.publicLocation" maxlength="160" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <button class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white" @click="saveAnnouncement">
              Save public update
            </button>
          </div>
          <div class="border-t border-slate-100 pt-4">
            <h4 class="font-semibold">Request history</h4>
            <ol v-if="selected.history?.length" class="mt-3 space-y-3">
              <li v-for="(entry, index) in selected.history" :key="`${entry.status}-${entry.createdAt}-${index}`" class="flex justify-between gap-4 text-sm">
                <span>
                  <strong>{{ statusLabel(entry.status) }}</strong>
                  <span v-if="entry.changedBy?.fullName" class="text-slate-500"> by {{ entry.changedBy.fullName }}</span>
                  <span v-if="entry.note" class="block text-slate-500">{{ entry.note }}</span>
                </span>
                <time class="shrink-0 text-slate-500">{{ new Date(entry.createdAt).toLocaleString() }}</time>
              </li>
            </ol>
            <p v-else class="mt-2 text-sm text-slate-500">No status changes recorded.</p>
          </div>
        </section>
      </div>
    </div>
  </AdminShell>
</template>
