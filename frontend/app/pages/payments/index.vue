<script setup lang="ts">
import AdminShell from "~/components/layout/AdminShell.vue";
import GlobalSearchResults from "~/components/layout/GlobalSearchResults.vue";
import StatCard from "~/components/ui/StatCard.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import type {
  PaymentSubmission,
  PaymentSubmissionStatus,
} from "~/types/payment";

const operations = useOperations();
const { payments } = operations;
const { tenants } = useDormData();
const dormData = useDormData();
const route = useRoute();
onMounted(() => {
  void dormData.loadFromApi();
  void operations.loadFromApi();
  void operations.loadPaymentSubmissions().catch((error: unknown) => {
    notice.value =
      error instanceof Error
        ? error.message
        : "Unable to load payment verification submissions.";
  });
});
const search = ref("");
watch(
  () => route.query.search,
  (value) => {
    search.value = typeof value === "string" ? value : "";
  },
  { immediate: true },
);
const filter = ref("ALL");
const selected = ref<(typeof payments.value)[number] | null>(null);
const showForm = ref(false);
const notice = ref("");
const saving = ref(false);
const verificationFilter = ref<"ALL" | PaymentSubmissionStatus>("PENDING");
const verificationBusyId = ref<number | null>(null);
const rejectionSubmission = ref<PaymentSubmission | null>(null);
const rejectionRemarks = ref("");
const proofPreviewUrl = ref("");
const proofPreviewType = ref("");
const proofPreviewName = ref("");
const proofPreviewSubmissionId = ref<number | null>(null);
const filteredSubmissions = computed(() =>
  operations.paymentSubmissions.value.filter(
    (submission) =>
      verificationFilter.value === "ALL" ||
      submission.status === verificationFilter.value,
  ),
);
const paymentForm = reactive({
  tenantId: null as number | null,
  amount: 0,
  paymentMethod: "",
  description: "",
  paymentDate: "",
  dueDate: "",
  referenceNumber: "",
});
const tenantName = (id: number) =>
  tenants.value.find((tenant) => tenant.id === id)?.fullName ||
  "Tenant unavailable";
const filtered = computed(() =>
  payments.value.filter(
    (payment) =>
      `${tenantName(payment.tenantId)} ${payment.description} ${payment.referenceNumber || ""} ${payment.amount} ${payment.paymentMethod} ${payment.paymentDate || ""} ${payment.dueDate || ""} ${payment.status}`
        .toLocaleLowerCase()
        .includes(search.value.trim().toLocaleLowerCase()) &&
      (filter.value === "ALL" || payment.status === filter.value),
  ),
);
const stats = computed(() => [
  {
    label: "Total payments",
    value: payments.value.length,
    detail: "All recorded transactions",
    tone: "blue" as const,
  },
  {
    label: "Paid payments",
    value: payments.value.filter((item) => item.status === "PAID").length,
    detail: "Up to date",
    tone: "green" as const,
  },
  {
    label: "Pending payments",
    value: payments.value.filter(
      (item) => item.status === "PENDING" || item.status === "PARTIAL",
    ).length,
    detail: "Awaiting payment",
    tone: "amber" as const,
  },
  {
    label: "Overdue payments",
    value: payments.value.filter((item) => item.status === "OVERDUE").length,
    detail: "Needs follow-up",
    tone: "rose" as const,
  },
]);

async function createPayment() {
  notice.value = "";
  if (!paymentForm.tenantId) {
    notice.value = "Select a tenant.";
    return;
  }
  saving.value = true;
  try {
    await operations.createPayment({
      tenantId: paymentForm.tenantId,
      amount: paymentForm.amount,
      paymentMethod: paymentForm.paymentMethod,
      description: paymentForm.description,
      paymentDate: paymentForm.paymentDate || undefined,
      dueDate: paymentForm.dueDate || undefined,
      referenceNumber: paymentForm.referenceNumber || undefined,
    });
    showForm.value = false;
    notice.value = "Payment recorded as unpaid.";
    paymentForm.tenantId = null;
    paymentForm.amount = 0;
    paymentForm.paymentMethod = "";
    paymentForm.description = "";
    paymentForm.paymentDate = "";
    paymentForm.dueDate = "";
    paymentForm.referenceNumber = "";
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to record payment.";
  } finally {
    saving.value = false;
  }
}

async function loadProof(
  submission: PaymentSubmission,
  download = false,
) {
  notice.value = "";
  try {
    const api = useApi();
    const blob = await api.request<Blob>(
      `/payments/submissions/${submission.id}/proof`,
      { responseType: "blob" },
    );
    const objectUrl = URL.createObjectURL(blob);
    if (download) {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = submission.proofFileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
      return;
    }
    if (proofPreviewUrl.value) URL.revokeObjectURL(proofPreviewUrl.value);
    proofPreviewUrl.value = objectUrl;
    proofPreviewType.value = submission.proofMimeType;
    proofPreviewName.value = submission.proofFileName;
    proofPreviewSubmissionId.value = submission.id;
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to open receipt.";
  }
}

async function verifySubmission(
  submission: PaymentSubmission,
  status: Extract<PaymentSubmissionStatus, "APPROVED" | "REJECTED">,
  remarks?: string,
) {
  verificationBusyId.value = submission.id;
  notice.value = "";
  try {
    await operations.verifyPaymentSubmission(submission.id, status, remarks);
    rejectionSubmission.value = null;
    rejectionRemarks.value = "";
    notice.value =
      status === "APPROVED"
        ? "Payment proof approved. The tenant balance was updated."
        : "Payment proof rejected. The tenant can resubmit it.";
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to verify payment proof.";
  } finally {
    verificationBusyId.value = null;
  }
}

function openRejectForm(submission: PaymentSubmission) {
  rejectionSubmission.value = submission;
  rejectionRemarks.value = "";
}

function closeProofPreview() {
  if (proofPreviewUrl.value) URL.revokeObjectURL(proofPreviewUrl.value);
  proofPreviewUrl.value = "";
  proofPreviewSubmissionId.value = null;
}

onBeforeUnmount(closeProofPreview);

function printPaymentRecord() {
  if (!selected.value) return;
  const payment = selected.value;
  const tenant = tenants.value.find((item) => item.id === payment.tenantId);
  const printWindow = window.open("", "_blank", "width=800,height=700");
  if (!printWindow) {
    notice.value = "Allow pop-ups to print the payment record.";
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html><head><title>DormEase payment record</title>
    <style>
      body{font:16px Arial,sans-serif;color:#0f172a;margin:40px}
      main{max-width:640px;margin:auto;border:1px solid #cbd5e1;border-radius:12px;padding:32px}
      h1{margin:0 0 6px;font-size:24px}p{color:#475569}
      table{width:100%;border-collapse:collapse;margin-top:24px}
      td{padding:12px 4px;border-bottom:1px solid #e2e8f0}
      td:first-child{color:#64748b;width:40%}
      @media print{body{margin:0}main{border:0}}
    </style></head>
    <body><main><h1>DormEase payment record</h1>
    <p>Official record of a payment in the DormEase system.</p>
    <table><tbody id="record-details"></tbody></table>
    </main></body></html>`);
  printWindow.document.close();

  const rows: Array<[string, string]> = [
    ["Record number", `PAY-${payment.id}`],
    ["Tenant", tenant?.fullName || "Tenant unavailable"],
    ["Email", tenant?.email || "—"],
    ["Description", payment.description ?? ""],
    ["Amount", `₱${payment.amount.toLocaleString()}`],
    ["Payment method", payment.paymentMethod],
    ["Reference number", payment.referenceNumber || "—"],
    ["Payment date", payment.paymentDate || "Not recorded"],
    ["Due date", payment.dueDate || "—"],
    ["Status", payment.status],
  ];
  const tableBody = printWindow.document.getElementById("record-details");
  for (const [label, value] of rows) {
    const row = printWindow.document.createElement("tr");
    const heading = printWindow.document.createElement("td");
    const content = printWindow.document.createElement("td");
    heading.textContent = label;
    content.textContent = value;
    row.append(heading, content);
    tableBody?.append(row);
  }
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}
</script>
<template>
  <AdminShell
    ><template #title>Payments</template>
    <div class="mx-auto max-w-[1400px] space-y-6">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p class="text-sm font-semibold text-brand-600">Finance</p>
          <h2 class="mt-1 text-3xl font-bold">Payment management</h2>
          <p class="mt-2 text-slate-500">Track recorded rent payments.</p>
        </div>
        <button
          class="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"
          @click="showForm = true"
        >
          + Record payment
        </button>
      </div>
      <div
        v-if="notice"
        role="status"
        class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"
      >
        {{ notice }}
      </div>
      <div
        v-if="operations.error.value"
        role="alert"
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        {{ operations.error.value }}
      </div>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard v-for="stat in stats" :key="stat.label" v-bind="stat" />
      </div>
      <section
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div
          class="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center"
        >
          <div class="relative min-w-0 flex-1">
            <input
              v-model="search"
              type="search"
              aria-label="Search all modules or filter payments"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
              placeholder="Search all modules or filter payments..."
            />
            <GlobalSearchResults :query="search" />
          </div>
          <select
            v-model="filter"
            class="rounded-xl border border-slate-200 px-3 py-3 text-sm"
          >
            <option>ALL</option>
            <option>PAID</option>
            <option>PENDING</option>
            <option>PARTIAL</option>
            <option>OVERDUE</option>
            <option>CANCELLED</option>
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[800px] text-left text-sm">
            <thead
              class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"
            >
              <tr>
                <th class="px-5 py-4">Tenant</th>
                <th class="px-5 py-4">Description</th>
                <th class="px-5 py-4">Amount</th>
                <th class="px-5 py-4">Payment method</th>
                <th class="px-5 py-4">Payment date</th>
                <th class="px-5 py-4">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="payment in filtered"
                :key="payment.id"
                class="transition hover:bg-slate-50"
              >
                <td class="px-5 py-4 font-semibold">
                  {{ tenantName(payment.tenantId) }}
                </td>
                <td class="px-5 py-4 text-slate-600">
                  {{ payment.description }}
                </td>
                <td class="px-5 py-4 font-semibold">
                  ₱{{ payment.amount.toLocaleString() }}
                </td>
                <td class="px-5 py-4 text-slate-500">
                  {{ payment.paymentMethod }}
                </td>
                <td class="px-5 py-4 text-slate-500">
                  {{ payment.paymentDate || "—" }}
                </td>
                <td class="px-5 py-4">
                  <StatusBadge :value="payment.status" />
                </td>
                <td class="px-5 py-4 text-right">
                  <button
                    class="font-semibold text-brand-600"
                    @click="selected = payment"
                  >
                    Details
                  </button>
                </td>
              </tr>
              <tr v-if="!filtered.length">
                <td colspan="7" class="p-12 text-center text-slate-500">
                  No payment records match your filters.
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
          class="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center"
        >
          <div>
            <h3 class="text-xl font-bold">Payment verification</h3>
            <p class="mt-1 text-sm text-slate-500">
              Review uploaded receipts. Only approval updates the payment balance.
            </p>
          </div>
          <label class="text-sm font-medium text-slate-600">
            Status
            <select
              v-model="verificationFilter"
              class="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All</option>
            </select>
          </label>
        </div>
        <div
          v-if="!filteredSubmissions.length"
          class="p-10 text-center text-sm text-slate-500"
        >
          No payment submissions match this filter.
        </div>
        <div v-else class="divide-y divide-slate-100">
          <article
            v-for="submission in filteredSubmissions"
            :key="submission.id"
            class="grid gap-5 p-5 lg:grid-cols-[1fr_auto]"
          >
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tenant
                </p>
                <p class="mt-1 font-semibold">
                  {{ submission.tenant?.user.fullName || "Tenant unavailable" }}
                </p>
                <p class="text-sm text-slate-500">
                  {{ submission.tenant?.user.email }}
                </p>
                <p class="text-sm text-slate-500">
                  {{ submission.tenant?.contactNumber || "No phone recorded" }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment details
                </p>
                <p class="mt-1 font-semibold">
                  {{ submission.payment?.description || `Payment #${submission.paymentId}` }}
                </p>
                <p class="text-sm text-slate-600">
                  Submitted ₱{{ submission.amount.toLocaleString() }} via
                  {{ submission.paymentMethod }}
                </p>
                <p class="text-sm text-slate-500">
                  Bill ₱{{ Number(submission.payment?.amount || 0).toLocaleString() }}
                  · paid ₱{{ Number(submission.payment?.amountPaid || 0).toLocaleString() }}
                  · due {{ submission.payment?.dueDate?.slice(0, 10) || "—" }}
                </p>
                <p class="mt-1 text-sm text-slate-500">
                  Paid {{ submission.paymentDate.slice(0, 10) }} · Ref
                  <span class="font-mono">{{ submission.referenceNumber }}</span>
                </p>
              </div>
              <div class="sm:col-span-2">
                <div class="flex flex-wrap items-center gap-3">
                  <StatusBadge :value="submission.status" />
                  <span class="text-xs text-slate-500">
                    Submitted {{ new Date(submission.createdAt).toLocaleString() }}
                  </span>
                  <span
                    v-if="submission.verifiedAt"
                    class="text-xs text-slate-500"
                  >
                    Verified {{ new Date(submission.verifiedAt).toLocaleString() }}
                    <span v-if="submission.verifiedBy">
                      by {{ submission.verifiedBy.fullName }}
                    </span>
                  </span>
                </div>
                <p
                  v-if="submission.rejectionRemarks"
                  class="mt-2 text-sm text-rose-700"
                >
                  Rejection remarks: {{ submission.rejectionRemarks }}
                </p>
                <details
                  v-if="submission.auditTrail?.length"
                  class="mt-3 text-sm"
                >
                  <summary class="cursor-pointer font-semibold text-slate-600">
                    Verification history
                  </summary>
                  <ul class="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
                    <li
                      v-for="entry in submission.auditTrail"
                      :key="`${entry.createdAt}-${entry.status}`"
                    >
                      <span class="font-medium">{{ entry.status }}</span>
                      · {{ new Date(entry.createdAt).toLocaleString() }}
                      <span v-if="entry.changedBy">
                        · {{ entry.changedBy.fullName }}
                      </span>
                      <p v-if="entry.remarks" class="text-slate-500">
                        {{ entry.remarks }}
                      </p>
                    </li>
                  </ul>
                </details>
                <button
                  class="mt-3 mr-3 text-sm font-semibold text-brand-700 underline"
                  @click="loadProof(submission)"
                >
                  Preview receipt
                </button>
                <button
                  class="mt-3 text-sm font-semibold text-brand-700 underline"
                  @click="loadProof(submission, true)"
                >
                  Download receipt
                </button>
              </div>
            </div>
            <div
              v-if="submission.status === 'PENDING'"
              class="flex flex-wrap items-start gap-2 lg:justify-end"
            >
              <button
                :disabled="verificationBusyId === submission.id"
                class="h-fit rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                @click="verifySubmission(submission, 'APPROVED')"
              >
                Approve
              </button>
              <button
                :disabled="verificationBusyId === submission.id"
                class="h-fit rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"
                @click="openRejectForm(submission)"
              >
                Reject
              </button>
            </div>
          </article>
        </div>
      </section>
      <div
        v-if="selected"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        @click.self="selected = null"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div class="flex justify-between">
            <div>
              <p class="text-sm text-brand-600">Payment details</p>
              <h3 class="mt-1 text-xl font-bold">
                {{ tenantName(selected.tenantId) }}
              </h3>
            </div>
            <button class="text-2xl text-slate-400" @click="selected = null">
              ×
            </button>
          </div>
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p class="text-xs uppercase text-slate-400">Amount</p>
              <p class="mt-1 font-bold">
                ₱{{ selected.amount.toLocaleString() }}
              </p>
            </div>
            <div>
              <p class="text-xs uppercase text-slate-400">Status</p>
              <StatusBadge :value="selected.status" />
            </div>
            <div>
              <p class="text-xs uppercase text-slate-400">Payment method</p>
              <p class="mt-1 font-medium">{{ selected.paymentMethod }}</p>
            </div>
            <div>
              <p class="text-xs uppercase text-slate-400">Payment date</p>
              <p class="mt-1 font-medium">
                {{ selected.paymentDate || "Not recorded" }}
              </p>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              @click="printPaymentRecord"
            >
              Print record
            </button>
            <button
              class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
              @click="selected = null"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        @click.self="showForm = false"
      >
        <form
          class="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          @submit.prevent="createPayment"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-xl font-bold">Record payment</h3>
              <p class="mt-1 text-sm text-slate-500">
                New records start unpaid. Update their status after confirming
                payment.
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
            >Tenant<select
              v-model="paymentForm.tenantId"
              required
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            >
              <option :value="null">Select tenant</option>
              <option
                v-for="tenant in tenants"
                :key="tenant.id"
                :value="tenant.id"
              >
                {{ tenant.fullName }} · {{ tenant.email }}
              </option>
            </select></label
          >
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="text-sm font-medium"
              >Amount<input
                v-model.number="paymentForm.amount"
                required
                type="number"
                min="0.01"
                step="0.01"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            /></label>
            <label class="text-sm font-medium"
              >Payment method<input
                v-model.trim="paymentForm.paymentMethod"
                required
                minlength="2"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                placeholder="Cash, bank transfer..."
            /></label>
            <label class="text-sm font-medium"
              >Payment date<input
                v-model="paymentForm.paymentDate"
                type="date"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            /></label>
            <label class="text-sm font-medium"
              >Due date<input
                v-model="paymentForm.dueDate"
                type="date"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            /></label>
            <label class="text-sm font-medium sm:col-span-2"
              >Description<input
                v-model.trim="paymentForm.description"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                placeholder="Monthly rent..."
            /></label>
            <label class="text-sm font-medium sm:col-span-2"
              >Reference number (optional)<input
                v-model.trim="paymentForm.referenceNumber"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            /></label>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 font-semibold text-slate-600"
              @click="showForm = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ saving ? "Saving..." : "Save payment" }}
            </button>
          </div>
        </form>
      </div>
      <div
        v-if="rejectionSubmission"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"
        @click.self="rejectionSubmission = null"
      >
        <form
          class="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          @submit.prevent="
            verifySubmission(
              rejectionSubmission!,
              'REJECTED',
              rejectionRemarks,
            )
          "
        >
          <div>
            <h3 class="text-xl font-bold">Reject payment proof</h3>
            <p class="mt-1 text-sm text-slate-500">
              Explain what the tenant needs to correct before resubmitting.
            </p>
          </div>
          <label class="block text-sm font-medium">
            Rejection remarks
            <textarea
              v-model.trim="rejectionRemarks"
              required
              minlength="3"
              maxlength="1000"
              rows="4"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            />
          </label>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 font-semibold text-slate-600"
              @click="rejectionSubmission = null"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="verificationBusyId === rejectionSubmission.id"
              class="rounded-xl bg-rose-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            >
              Confirm rejection
            </button>
          </div>
        </form>
      </div>
      <div
        v-if="proofPreviewUrl"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4"
        @click.self="closeProofPreview"
      >
        <section
          class="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white p-5 shadow-2xl"
        >
          <div class="flex items-center justify-between gap-4">
            <h3 class="truncate font-semibold">{{ proofPreviewName }}</h3>
            <button
              class="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100"
              @click="closeProofPreview"
            >
              Close
            </button>
          </div>
          <img
            v-if="proofPreviewType.startsWith('image/')"
            :src="proofPreviewUrl"
            :alt="`Receipt preview ${proofPreviewSubmissionId}`"
            class="mt-4 max-h-[78vh] w-full rounded-lg object-contain"
          />
          <iframe
            v-else
            :src="proofPreviewUrl"
            title="Payment proof PDF preview"
            class="mt-4 min-h-[70vh] w-full rounded-lg border"
          />
        </section>
      </div>
    </div>
  </AdminShell>
</template>
