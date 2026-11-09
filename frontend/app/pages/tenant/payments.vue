<script setup lang="ts">
import TenantShell from "~/components/layout/TenantShell.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import type { Payment } from "~/types/payment";

const operations = useOperations();
const showSubmissionForm = ref(false);
const selectedPayment = ref<Payment | null>(null);
const receiptFile = ref<File | null>(null);
const receiptPreview = ref("");
const isSubmitting = ref(false);
const notice = ref("");
const formError = ref("");
const form = reactive({
  amount: 0,
  paymentMethod: "GCash",
  paymentDate: new Date().toISOString().slice(0, 10),
  referenceNumber: "",
});
const outstandingPayments = computed(() =>
  operations.payments.value.filter(
    (payment) => payment.amount - payment.amountPaid > 0.001,
  ),
);
const totalOutstanding = computed(() =>
  outstandingPayments.value.reduce(
    (total, payment) => total + payment.amount - payment.amountPaid,
    0,
  ),
);

onMounted(() => {
  void operations.loadFromApi(true);
});

function openSubmissionForm(payment: Payment) {
  if (receiptPreview.value) URL.revokeObjectURL(receiptPreview.value);
  selectedPayment.value = payment;
  receiptFile.value = null;
  receiptPreview.value = "";
  form.amount = Math.max(0, payment.amount - payment.amountPaid);
  form.paymentMethod = "GCash";
  form.paymentDate = new Date().toISOString().slice(0, 10);
  form.referenceNumber = "";
  formError.value = "";
  showSubmissionForm.value = true;
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (receiptPreview.value) URL.revokeObjectURL(receiptPreview.value);
  if (
    file &&
    (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      file.type,
    ) ||
      file.size > 5 * 1024 * 1024)
  ) {
    input.value = "";
    receiptFile.value = null;
    receiptPreview.value = "";
    formError.value =
      "Choose a JPG, PNG, WEBP, or PDF receipt no larger than 5 MB.";
    return;
  }
  receiptFile.value = file;
  receiptPreview.value = file ? URL.createObjectURL(file) : "";
  formError.value = "";
}

function closeSubmissionForm() {
  showSubmissionForm.value = false;
  if (receiptPreview.value) URL.revokeObjectURL(receiptPreview.value);
  receiptPreview.value = "";
  receiptFile.value = null;
}

async function submitProof() {
  if (!selectedPayment.value) return;
  if (!receiptFile.value) {
    formError.value = "Choose a receipt image or PDF before submitting.";
    return;
  }
  const pendingSubmission = selectedPayment.value.submissions.find(
    (submission) => submission.status === "PENDING",
  );
  if (pendingSubmission) {
    formError.value = "This payment already has a proof waiting for verification.";
    return;
  }
  const formData = new FormData();
  formData.append("amount", String(form.amount));
  formData.append("paymentMethod", form.paymentMethod);
  formData.append("paymentDate", form.paymentDate);
  formData.append("referenceNumber", form.referenceNumber.trim());
  formData.append("proof", receiptFile.value);

  isSubmitting.value = true;
  formError.value = "";
  notice.value = "";
  try {
    await operations.submitPaymentProof(selectedPayment.value.id, formData);
    notice.value = "Payment proof submitted and is waiting for admin verification.";
    closeSubmissionForm();
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : "Unable to submit payment proof.";
  } finally {
    isSubmitting.value = false;
  }
}

onBeforeUnmount(() => {
  if (receiptPreview.value) URL.revokeObjectURL(receiptPreview.value);
});
</script>

<template>
  <TenantShell>
    <template #title>My payments</template>
    <div class="mx-auto max-w-6xl space-y-8">
      <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 class="text-2xl font-bold">My payments</h2>
          <p class="mt-1 text-sm text-slate-500">
            Review your balance, submit receipts, and follow verification progress.
          </p>
        </div>
        <div class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Outstanding balance
          </p>
          <p class="mt-1 text-xl font-bold text-amber-950">
            ₱{{ totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
          </p>
        </div>
      </header>

      <div
        v-if="notice"
        role="status"
        class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
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

      <section class="space-y-4">
        <div>
          <h3 class="text-xl font-bold">Outstanding payments</h3>
          <p class="mt-1 text-sm text-slate-500">
            Submit a receipt for each bill. Your balance changes only after staff approves it.
          </p>
        </div>
        <div
          v-if="!outstandingPayments.length"
          class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm"
        >
          No outstanding payments.
        </div>
        <div v-else class="grid gap-4 lg:grid-cols-2">
          <article
            v-for="payment in outstandingPayments"
            :key="payment.id"
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h4 class="font-semibold">{{ payment.description }}</h4>
                <p class="mt-1 text-sm text-slate-500">
                  Payment #{{ payment.id }} · Due
                  {{ payment.dueDate || "date not set" }}
                </p>
              </div>
              <StatusBadge :value="payment.status" />
            </div>
            <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt class="text-slate-500">Bill amount</dt>
                <dd class="mt-1 font-semibold">₱{{ payment.amount.toLocaleString() }}</dd>
              </div>
              <div>
                <dt class="text-slate-500">Paid and verified</dt>
                <dd class="mt-1 font-semibold">₱{{ payment.amountPaid.toLocaleString() }}</dd>
              </div>
              <div class="col-span-2 rounded-lg bg-amber-50 p-3">
                <dt class="text-amber-800">Amount due</dt>
                <dd class="mt-1 text-lg font-bold text-amber-950">
                  ₱{{ (payment.amount - payment.amountPaid).toLocaleString() }}
                </dd>
              </div>
            </dl>
            <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p
                v-if="payment.submissions.some((item) => item.status === 'PENDING')"
                class="text-sm font-medium text-amber-700"
              >
                Proof pending verification
              </p>
              <button
                :disabled="payment.submissions.some((item) => item.status === 'PENDING')"
                class="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                @click="openSubmissionForm(payment)"
              >
                {{
                  payment.submissions.some((item) => item.status === "REJECTED")
                    ? "Resubmit proof"
                    : "Submit payment proof"
                }}
              </button>
            </div>
          </article>
        </div>
      </section>

      <section class="space-y-4">
        <div>
          <h3 class="text-xl font-bold">Payment submission history</h3>
          <p class="mt-1 text-sm text-slate-500">
            Each submission is retained, including rejected proofs and remarks.
          </p>
        </div>
        <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table class="w-full min-w-[850px] text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th class="px-5 py-4">Bill</th>
                <th class="px-5 py-4">Submitted</th>
                <th class="px-5 py-4">Amount / method</th>
                <th class="px-5 py-4">Reference</th>
                <th class="px-5 py-4">Verification</th>
                <th class="px-5 py-4">Receipt</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <template v-for="payment in operations.payments.value" :key="payment.id">
                <tr
                  v-for="submission in payment.submissions"
                  :key="submission.id"
                >
                  <td class="px-5 py-4">{{ payment.description }}</td>
                  <td class="px-5 py-4">
                    {{ new Date(submission.createdAt).toLocaleDateString() }}
                  </td>
                  <td class="px-5 py-4">
                    ₱{{ submission.amount.toLocaleString() }} · {{ submission.paymentMethod }}
                  </td>
                  <td class="px-5 py-4 font-mono">{{ submission.referenceNumber }}</td>
                  <td class="px-5 py-4">
                    <StatusBadge :value="submission.status" />
                    <p
                      v-if="submission.status === 'REJECTED' && submission.rejectionRemarks"
                      class="mt-2 max-w-xs whitespace-normal text-xs text-rose-700"
                    >
                      {{ submission.rejectionRemarks }}
                    </p>
                    <p
                      v-if="submission.verifiedAt"
                      class="mt-1 text-xs text-slate-500"
                    >
                      {{ new Date(submission.verifiedAt).toLocaleDateString() }}
                      <span v-if="submission.verifiedBy">
                        · {{ submission.verifiedBy.fullName }}
                      </span>
                    </p>
                  </td>
                  <td class="px-5 py-4">{{ submission.proofFileName }}</td>
                </tr>
              </template>
              <tr
                v-if="!operations.payments.value.some((payment) => payment.submissions.length)"
              >
                <td colspan="6" class="p-10 text-center text-slate-500">
                  No payment proofs submitted yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-xl font-bold">All payment records</h3>
        <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table class="w-full min-w-[700px] text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th class="px-5 py-4">Description</th>
                <th class="px-5 py-4">Amount</th>
                <th class="px-5 py-4">Due date</th>
                <th class="px-5 py-4">Date paid</th>
                <th class="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="payment in operations.payments.value" :key="`all-${payment.id}`">
                <td class="px-5 py-4 font-medium">{{ payment.description }}</td>
                <td class="px-5 py-4">₱{{ payment.amount.toLocaleString() }}</td>
                <td class="px-5 py-4">{{ payment.dueDate || "—" }}</td>
                <td class="px-5 py-4">{{ payment.paymentDate || "—" }}</td>
                <td class="px-5 py-4"><StatusBadge :value="payment.status" /></td>
              </tr>
              <tr v-if="!operations.payments.value.length">
                <td colspan="5" class="p-10 text-center text-slate-500">
                  No payment records yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div
        v-if="showSubmissionForm && selectedPayment"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        @click.self="closeSubmissionForm"
      >
        <form
          class="max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          @submit.prevent="submitProof"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-xl font-bold">Submit payment proof</h3>
              <p class="mt-1 text-sm text-slate-500">
                {{ selectedPayment.description }} · balance ₱{{
                  (selectedPayment.amount - selectedPayment.amountPaid).toLocaleString()
                }}
              </p>
            </div>
            <button type="button" class="text-2xl text-slate-400" aria-label="Close" @click="closeSubmissionForm">
              ×
            </button>
          </div>
          <label class="block text-sm font-medium">
            Payment method
            <select v-model="form.paymentMethod" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5">
              <option>GCash</option>
              <option>Bank Transfer</option>
              <option>Cash</option>
              <option>Other</option>
            </select>
          </label>
          <label class="block text-sm font-medium">
            Amount paid
            <input v-model.number="form.amount" type="number" min="0.01" step="0.01" :max="selectedPayment.amount - selectedPayment.amountPaid" required class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
          </label>
          <label class="block text-sm font-medium">
            Payment date
            <input v-model="form.paymentDate" type="date" :max="new Date().toISOString().slice(0, 10)" required class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
          </label>
          <label class="block text-sm font-medium">
            Transaction / reference number
            <input v-model.trim="form.referenceNumber" required minlength="2" maxlength="120" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
          </label>
          <label class="block text-sm font-medium">
            Receipt (JPG, JPEG, PNG, WEBP, PDF · max 5 MB)
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" required class="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-sm" @change="handleFileChange" />
          </label>
          <div v-if="receiptFile" class="rounded-xl border border-slate-200 p-3">
            <p class="mb-2 text-sm font-medium">{{ receiptFile.name }}</p>
            <img v-if="receiptFile.type.startsWith('image/')" :src="receiptPreview" alt="Receipt preview" class="max-h-64 w-full rounded-lg object-contain" />
            <iframe v-else :src="receiptPreview" title="PDF receipt preview" class="h-64 w-full rounded-lg border" />
          </div>
          <p v-if="formError" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {{ formError }}
          </p>
          <div class="flex justify-end gap-3">
            <button type="button" class="rounded-xl px-4 py-2.5 font-semibold text-slate-600" @click="closeSubmissionForm">
              Cancel
            </button>
            <button type="submit" :disabled="isSubmitting" class="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
              {{ isSubmitting ? "Submitting…" : "Submit for verification" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </TenantShell>
</template>
